import YahooFinance from 'yahoo-finance2'
import {
  computeForecast,
  computeMomentum,
  FORECAST_LOOKBACK_DIAS,
  MOMENTUM_LOOKBACK_DIAS,
  type ForecastResult,
  type MomentumResult,
} from './signals'

/**
 * Descarga de históricos de Yahoo para las señales de los agentes.
 *
 * `signals.ts` guarda el cálculo puro; aquí vive la E/S que lo alimenta. Se
 * extrajo de `api/agentes/forecast` y `api/agentes/momentum` cuando la cascada
 * pasó a poder ejecutarse también sin sesión, desde el cron: el endpoint con
 * sesión y el trabajo programado tienen que leer exactamente los mismos
 * cierres, o las recomendaciones de uno y otro dejarían de ser comparables.
 *
 * Un ticker que Yahoo no sirve no aparece en el resultado. Devolver un hueco es
 * deliberado: el llamador ya distingue «no pasó el filtro» de «no hay datos», y
 * rellenarlo con ceros inventaría una señal.
 */

/** Un ticker sin datos suficientes se omite del mapa, no se falsea. */
export async function forecastDeTickers(
  tickers: string[],
): Promise<Record<string, ForecastResult>> {
  if (!tickers.length) return {}

  const yf = new YahooFinance()
  const period1 = new Date(Date.now() - FORECAST_LOOKBACK_DIAS * 24 * 60 * 60 * 1000)
  const results: Record<string, ForecastResult> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)

        const forecast = computeForecast(closes)
        if (forecast) results[ticker] = forecast
      } catch (e) {
        console.error(`[forecast] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return results
}

/** Un ticker sin datos suficientes se omite del mapa, no se falsea. */
export async function momentumDeTickers(
  tickers: string[],
): Promise<Record<string, MomentumResult>> {
  if (!tickers.length) return {}

  const yf = new YahooFinance()
  const period1 = new Date(Date.now() - MOMENTUM_LOOKBACK_DIAS * 24 * 60 * 60 * 1000)
  const results: Record<string, MomentumResult> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null; volume: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)
        const volumes = hist.map(h => h.volume).filter((v): v is number => v != null)

        const momentum = computeMomentum(closes, volumes)
        if (momentum) results[ticker] = momentum
      } catch (e) {
        console.error(`[momentum] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return results
}

/** Normaliza el `?tickers=` de las rutas: mayúsculas, sin huecos ni vacíos. */
export function parsearTickers(param: string | null): string[] {
  return (param ?? '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
}
