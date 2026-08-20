import YahooFinance from 'yahoo-finance2'
import { buildOccSymbol, contractKey, type OptionContractRef } from '@/lib/options/occ-symbol'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QuoteAny = Record<string, any>

interface RequestBody {
  contracts?: unknown
}

function parseContracts(raw: unknown): OptionContractRef[] {
  if (!Array.isArray(raw)) return []
  const out: OptionContractRef[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const c = item as Record<string, unknown>
    const ticker = typeof c.ticker === 'string' ? c.ticker : null
    const expiration = typeof c.expiration === 'string' ? c.expiration : null
    const strike = typeof c.strike === 'number' ? c.strike : null
    const type = c.type === 'PUT' ? 'PUT' : c.type === 'CALL' ? 'CALL' : null
    if (!ticker || !expiration || strike == null || !type) continue
    out.push({ ticker, expiration, strike, type })
  }
  return out.slice(0, 50)
}

/**
 * Devuelve la prima actual de cada contrato de opción, indexada por
 * `contractKey`. Los contratos ilíquidos o inexistentes se omiten del mapa
 * en lugar de fallar toda la petición.
 */
export async function POST(request: Request): Promise<Response> {
  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return Response.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  const contracts = parseContracts(body.contracts)
  if (!contracts.length) return Response.json({})

  const result: Record<string, number> = {}

  await Promise.allSettled(
    contracts.map(async (contract) => {
      const symbol = buildOccSymbol(contract)
      if (!symbol) return
      try {
        const yf = new YahooFinance()
        // El signal va dentro de `fetchOptions`: es el único campo que la
        // librería reenvía a fetch(), un `signal` suelto se descarta.
        const q = await yf.quote(symbol, {}, {
          fetchOptions: { signal: AbortSignal.timeout(8_000) },
        }) as QuoteAny
        // Para opciones el mid bid/ask es más representativo que el último
        // cruce, que puede ser de hace días en contratos poco líquidos.
        const bid = q?.bid as number | undefined
        const ask = q?.ask as number | undefined
        const last = q?.regularMarketPrice as number | undefined
        const price = (bid != null && ask != null && bid > 0 && ask >= bid)
          ? (bid + ask) / 2
          : (last != null && last > 0 ? last : null)
        if (price != null) result[contractKey(contract)] = price
      } catch { /* skip failed contracts */ }
    })
  )

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
