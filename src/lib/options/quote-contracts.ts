import YahooFinance from 'yahoo-finance2'
import { buildOccSymbol, contractKey, type OptionContractRef } from './occ-symbol'

/**
 * Cotización de contratos de opción contra Yahoo Finance.
 *
 * Vivía dentro de `/api/informes/option-prices`. Se extrajo aquí porque el
 * servidor necesita cotizar contratos sin hacerse una petición HTTP a sí mismo:
 * en serverless eso es una segunda función, una segunda cold start y una ruta
 * más por la que se puede perder la sesión.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QuoteAny = Record<string, any>

/** Tope por lote, el mismo que aplicaba el route handler. */
export const MAX_CONTRACTS = 50

/**
 * Precio de referencia de un contrato a partir de su cotización.
 *
 * Para opciones el mid bid/ask es más representativo que el último cruce, que
 * en contratos poco líquidos puede ser de días atrás. Devuelve `null` cuando no
 * hay ninguna referencia utilizable.
 */
export function referencePrice(quote: {
  bid?: number
  ask?: number
  regularMarketPrice?: number
}): number | null {
  const { bid, ask, regularMarketPrice: last } = quote
  if (bid != null && ask != null && bid > 0 && ask >= bid) return (bid + ask) / 2
  if (last != null && last > 0) return last
  return null
}

/**
 * Prima actual de cada contrato, indexada por `contractKey`.
 *
 * Los contratos ilíquidos o inexistentes se omiten del mapa en lugar de hacer
 * fallar toda la petición: quien lo consume debe tratar la ausencia como "no
 * hay dato", nunca como precio cero.
 */
export async function quoteContracts(
  contracts: OptionContractRef[],
  signal?: AbortSignal
): Promise<Record<string, number>> {
  const batch = contracts.slice(0, MAX_CONTRACTS)
  const result: Record<string, number> = {}

  await Promise.allSettled(
    batch.map(async (contract) => {
      const symbol = buildOccSymbol(contract)
      if (!symbol) return
      try {
        const yf = new YahooFinance()
        // El signal va dentro de `fetchOptions`: es el único campo que la
        // librería reenvía a fetch(), un `signal` suelto se descarta.
        const q = await yf.quote(symbol, {}, {
          fetchOptions: { signal: signal ?? AbortSignal.timeout(8_000) },
        }) as QuoteAny
        const price = referencePrice({
          bid: q?.bid as number | undefined,
          ask: q?.ask as number | undefined,
          regularMarketPrice: q?.regularMarketPrice as number | undefined,
        })
        if (price != null) result[contractKey(contract)] = price
      } catch { /* skip failed contracts */ }
    })
  )

  return result
}

/**
 * Interpreta la lista de contratos que llega en el cuerpo de una petición.
 * Descarta en silencio lo que no tenga los cuatro campos con el tipo correcto.
 */
export function parseContracts(raw: unknown): OptionContractRef[] {
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
  return out.slice(0, MAX_CONTRACTS)
}
