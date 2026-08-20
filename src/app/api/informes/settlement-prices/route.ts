import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface RequestBody {
  contracts?: unknown
}

interface SettlementQuery {
  ticker: string
  /** Fecha de vencimiento en formato ISO `YYYY-MM-DD`. */
  expiration: string
}

/** Día natural de una barra diaria, en formato `YYYY-MM-DD`. */
function isoDay(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10)
}

/** Clave con la que el cliente indexa el resultado. */
function queryKey(q: SettlementQuery): string {
  return `${q.ticker.toUpperCase()}|${q.expiration}`
}

function parseQueries(raw: unknown): SettlementQuery[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SettlementQuery[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const c = item as Record<string, unknown>
    const ticker = typeof c.ticker === 'string' ? c.ticker.trim().toUpperCase() : null
    const expiration = typeof c.expiration === 'string' ? c.expiration.trim() : null
    if (!ticker || !expiration || !/^\d{4}-\d{2}-\d{2}$/.test(expiration)) continue
    const key = `${ticker}|${expiration}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ticker, expiration })
  }
  return out.slice(0, 50)
}

/**
 * Devuelve el cierre del subyacente en la fecha de vencimiento de cada
 * contrato, indexado por `TICKER|YYYY-MM-DD`.
 *
 * Yahoo no cotiza contratos ya vencidos, así que para liquidarlos hace falta
 * saber dónde quedó la acción ese día. Si el vencimiento cae en fin de semana
 * o festivo se toma el último cierre disponible antes de esa fecha.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return Response.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  const queries = parseQueries(body.contracts)
  if (!queries.length) return Response.json({})

  const result: Record<string, number> = {}

  await Promise.allSettled(
    queries.map(async (q) => {
      try {
        const expiry = new Date(`${q.expiration}T00:00:00.000Z`)
        if (Number.isNaN(expiry.getTime())) return
        // Ventana de 10 días hacia atrás: cubre fines de semana y festivos
        // largos sin traer más datos de los necesarios.
        const period1 = new Date(expiry.getTime() - 10 * 86_400_000)
        // period2 es exclusivo, así que se pide un día extra para incluir
        // el propio día de vencimiento.
        const period2 = new Date(expiry.getTime() + 86_400_000)

        const yf = new YahooFinance()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(q.ticker, {
          period1, period2, interval: '1d',
        }) as Array<{ date: Date; close: number | null }>

        // Último cierre que no supere la fecha de vencimiento. La comparación
        // es por día natural, no por timestamp: las barras diarias llevan la
        // hora de apertura del mercado, así que comparar contra la medianoche
        // del vencimiento descartaría el propio día en que expira el contrato.
        const usable = hist
          .filter((h) => h.close != null && isoDay(h.date) <= q.expiration)
          .sort((a, b) => isoDay(a.date).localeCompare(isoDay(b.date)))

        const close = usable.at(-1)?.close
        if (close != null) result[queryKey(q)] = close
      } catch { /* contrato sin histórico disponible: se omite */ }
    })
  )

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
