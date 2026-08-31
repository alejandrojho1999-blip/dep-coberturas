/**
 * Precio y velas de los activos vigilados.
 *
 * Se ataca directamente el endpoint `v8/finance/chart` de Yahoo, igual que
 * `src/lib/options/technical-zones.ts`: la librería `yahoo-finance2` necesita
 * cookie y crumb, y el motor de alertas corre en un cron donde una negociación
 * extra de credenciales es una fuente más de fallos y de segundos perdidos.
 *
 * Una misma llamada devuelve el histórico diario (para el ATR) y el último
 * precio de mercado, así que no hace falta cotizar aparte.
 */

import type { Vela } from '@/lib/alertas/atr'

export interface CotizacionActivo {
  ticker: string
  precio: number
  velas: Vela[]
  /** Momento del último precio conocido, en ISO. */
  precioAt: string
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/**
 * Histórico diario de un año y último precio.
 *
 * `regularMarketPrice` del bloque `meta` es el precio en vivo cuando el mercado
 * está abierto y el último cierre cuando no lo está; se prefiere al último
 * cierre de la serie porque las velas del día en curso llegan con retraso.
 */
export async function cotizar(ticker: string, timeoutMs = 9000): Promise<CotizacionActivo> {
  const encoded = encodeURIComponent(ticker.toUpperCase())
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1y&interval=1d`

  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Yahoo chart devolvió ${res.status} para ${ticker}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`Yahoo chart sin datos para ${ticker}`)

  const timestamps: number[] = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}

  const velas: Vela[] = timestamps
    .map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      high: Number(quote.high?.[i]),
      low: Number(quote.low?.[i]),
      close: Number(quote.close?.[i]),
    }))
    .filter((v: Vela) => [v.high, v.low, v.close].every(Number.isFinite))

  const precio = Number(result.meta?.regularMarketPrice ?? velas.at(-1)?.close)
  if (!Number.isFinite(precio) || precio <= 0) {
    throw new Error(`Yahoo chart sin precio utilizable para ${ticker}`)
  }

  const marketTime = Number(result.meta?.regularMarketTime)
  const precioAt = Number.isFinite(marketTime)
    ? new Date(marketTime * 1000).toISOString()
    : new Date().toISOString()

  return { ticker, precio, velas, precioAt }
}

/**
 * Cotiza varios activos en paralelo tolerando fallos.
 *
 * Que Yahoo no sirva la plata no puede impedir que salga la alerta del oro: los
 * fallos se devuelven aparte para registrarlos, no para abortar.
 */
export async function cotizarVarios(
  tickers: string[],
): Promise<{ cotizaciones: CotizacionActivo[]; errores: string[] }> {
  const settled = await Promise.allSettled(tickers.map((t) => cotizar(t)))
  const cotizaciones: CotizacionActivo[] = []
  const errores: string[] = []

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') cotizaciones.push(r.value)
    else errores.push(`${tickers[i]}: ${(r.reason as Error).message}`)
  })

  return { cotizaciones, errores }
}
