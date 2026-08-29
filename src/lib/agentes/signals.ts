/**
 * Funciones puras de las señales técnicas de los agentes Peter y Small.
 *
 * Extraídas de `src/app/api/agentes/forecast/route.ts` y
 * `src/app/api/agentes/momentum/route.ts` para poder reutilizarlas desde el
 * motor de backtest (`src/lib/backtest/engine.ts`) sin duplicar la lógica.
 * Las rutas siguen siendo las dueñas de la E/S (auth + Yahoo); aquí solo vive
 * el cálculo.
 */

// ── Ventanas de histórico que piden las rutas (días naturales) ──────────────
export const FORECAST_LOOKBACK_DIAS = 100
export const MOMENTUM_LOOKBACK_DIAS = 75

// ── Umbrales ────────────────────────────────────────────────────────────────
export const FORECAST_UMBRAL = 0.02   // +2 % proyectado a 30 sesiones
export const MOMENTUM_MIN_SCORE = 2   // 2 de 3 indicadores

export interface ForecastResult {
  lastPrice: number
  forecastPrice: number
  /** En porcentaje, igual que la respuesta de la ruta (ej. 3.41 = +3,41 %). */
  forecastReturn: number
  pass: boolean
}

export interface MomentumResult {
  rsi: number
  macd: number
  signal: number
  volumeTrend: number
  score: number
  pass: boolean
}

export function linearRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length
  const sumX = (n * (n - 1)) / 2
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = y.reduce((acc, val, i) => acc + i * val, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export function ewma(prices: number[], alpha = 0.3): number {
  return prices.reduce((prev, curr) => alpha * curr + (1 - alpha) * prev)
}

/**
 * Proyección a 30 sesiones: 60 % regresión lineal sobre 60 cierres +
 * 40 % EWMA(α=0,3) sobre 30 cierres.
 *
 * Devuelve `null` si no hay al menos 30 cierres, igual que la ruta (que
 * simplemente omite el ticker del resultado).
 */
export function computeForecast(closes: number[]): ForecastResult | null {
  if (closes.length < 30) return null

  const lastPrice = closes[closes.length - 1]
  const last60 = closes.slice(-Math.min(60, closes.length))
  const last30 = closes.slice(-Math.min(30, closes.length))

  // Regresión lineal: proyecta 30 sesiones hacia delante
  const { slope, intercept } = linearRegression(last60)
  const linearForecast = intercept + slope * (last60.length - 1 + 30)

  // EWMA: proyecta hacia delante el momentum de los últimos 30 días
  const ewmaVal = ewma(last30, 0.3)
  const ewmaTrend = last30[0] > 0 ? (ewmaVal - last30[0]) / last30[0] : 0
  const ewmaForecast = ewmaVal * (1 + ewmaTrend)

  // Ensemble: 60 % lineal + 40 % momentum
  const forecastPrice = linearForecast * 0.6 + ewmaForecast * 0.4
  const forecastReturn = lastPrice > 0 ? (forecastPrice - lastPrice) / lastPrice : 0

  return {
    lastPrice: parseFloat(lastPrice.toFixed(2)),
    forecastPrice: parseFloat(forecastPrice.toFixed(2)),
    forecastReturn: parseFloat((forecastReturn * 100).toFixed(2)),
    pass: forecastReturn >= FORECAST_UMBRAL,
  }
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map(c => (c > 0 ? c : 0))
  const losses = changes.map(c => (c < 0 ? -c : 0))

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [prices[0]]
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

export function calcMACD(closes: number[]): { macd: number; signal: number } {
  if (closes.length < 35) return { macd: 0, signal: 0 }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i]).slice(25)
  const signalLine = calcEMA(macdLine, 9)
  const last = macdLine.length - 1
  return {
    macd: parseFloat(macdLine[last].toFixed(4)),
    signal: parseFloat(signalLine[last].toFixed(4)),
  }
}

/**
 * RSI-14 en (50, 75) + MACD sobre su señal + volumen 5d/20d ≥ 1,1.
 * Pasa con 2 de 3.
 *
 * Devuelve `null` si faltan datos (<30 cierres o <20 volúmenes), igual que la
 * ruta.
 */
export function computeMomentum(closes: number[], volumes: number[]): MomentumResult | null {
  if (closes.length < 30 || volumes.length < 20) return null

  const rsi = calcRSI(closes, 14)
  const { macd, signal } = calcMACD(closes)

  const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volumeTrend = vol20 > 0 ? vol5 / vol20 : 1

  const rsiPass = rsi > 50 && rsi < 75
  const macdPass = macd > signal
  const volPass = volumeTrend >= 1.1

  const score = (rsiPass ? 1 : 0) + (macdPass ? 1 : 0) + (volPass ? 1 : 0)

  return {
    rsi: parseFloat(rsi.toFixed(1)),
    macd,
    signal,
    volumeTrend: parseFloat(volumeTrend.toFixed(2)),
    score,
    pass: score >= MOMENTUM_MIN_SCORE,
  }
}
