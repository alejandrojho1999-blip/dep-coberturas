import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** Techo de símbolos por petición, para no agotar `maxDuration`. */
const MAX_TICKERS = 60

interface RequestBody {
  tickers?: unknown
  from?: unknown
}

interface DailyClose {
  date: string
  close: number
}

/** Día natural de una barra diaria, en formato `YYYY-MM-DD`. */
function isoDay(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10)
}

function parseTickers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const t = item.trim().toUpperCase()
    if (t) seen.add(t)
  }
  return [...seen].slice(0, MAX_TICKERS)
}

/**
 * Cierres diarios de cada ticker desde `from`, indexados por símbolo.
 *
 * Es lo que permite reconstruir la curva de equity de los portafolios sin
 * guardar snapshots: cada carga revalora la cartera día a día contra el precio
 * real de cada sesión. Un símbolo que Yahoo no devuelva se omite en silencio,
 * igual que en el resto de rutas de precios, para que un ticker deslistado no
 * tumbe el dashboard entero.
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

  const tickers = parseTickers(body.tickers)
  const from = typeof body.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.from)
    ? body.from
    : null
  if (!tickers.length) return Response.json({})
  if (!from) return Response.json({ error: 'from debe ser una fecha YYYY-MM-DD' }, { status: 400 })

  const result: Record<string, DailyClose[]> = {}
  const yf = new YahooFinance()

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const chart = await yf.chart(
          ticker,
          { period1: from, interval: '1d' },
          // El AbortSignal tiene que ir anidado en `fetchOptions`: un `signal`
          // suelto lo descarta la librería en silencio.
          { fetchOptions: { signal: AbortSignal.timeout(15_000) } },
        )

        // `adjclose` corrige splits y dividendos; sin ella un split partiría la
        // curva del portafolio por la mitad de un día para otro.
        const serie = chart.quotes
          .map((q) => ({ date: isoDay(q.date), close: q.adjclose ?? q.close }))
          .filter((q): q is DailyClose => q.close != null)

        if (serie.length) result[ticker] = serie
      } catch { /* símbolo sin histórico disponible: se omite */ }
    })
  )

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
