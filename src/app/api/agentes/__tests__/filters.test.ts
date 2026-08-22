import { describe, it, expect } from 'vitest'

// ── Pure math functions copied from route handlers ──────────────────────────
// (mirrors src/app/api/agentes/forecast/route.ts)

function linearRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length
  const sumX = (n * (n - 1)) / 2
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = y.reduce((acc, val, i) => acc + i * val, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function ewma(prices: number[], alpha = 0.3): number {
  return prices.reduce((prev, curr) => alpha * curr + (1 - alpha) * prev)
}

function forecastResult(closes: number[]): { forecastReturn: number; pass: boolean } {
  const lastPrice = closes[closes.length - 1]
  const last60 = closes.slice(-Math.min(60, closes.length))
  const last30 = closes.slice(-Math.min(30, closes.length))
  const { slope, intercept } = linearRegression(last60)
  const linearForecast = intercept + slope * (last60.length - 1 + 30)
  const ewmaVal = ewma(last30, 0.3)
  const ewmaTrend = last30[0] > 0 ? (ewmaVal - last30[0]) / last30[0] : 0
  const ewmaForecast = ewmaVal * (1 + ewmaTrend)
  const forecastPrice = linearForecast * 0.6 + ewmaForecast * 0.4
  const forecastReturn = lastPrice > 0 ? (forecastPrice - lastPrice) / lastPrice : 0
  return { forecastReturn, pass: forecastReturn >= 0.02 }
}

// (mirrors src/app/api/agentes/momentum/route.ts)

function calcRSI(closes: number[], period = 14): number {
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

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [prices[0]]
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

function calcMACD(closes: number[]): { macd: number; signal: number; pass: boolean } {
  if (closes.length < 35) return { macd: 0, signal: 0, pass: false }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i]).slice(25)
  const signalLine = calcEMA(macdLine, 9)
  const last = macdLine.length - 1
  const macd = macdLine[last]
  const signal = signalLine[last]
  return { macd, signal, pass: macd > signal }
}

// ── Test data generators ────────────────────────────────────────────────────

const bearish60 = Array.from({ length: 60 }, (_, i) => 200 - i * (50 / 59))  // $200 → $150
const bullish60 = Array.from({ length: 60 }, (_, i) => 100 + i * (40 / 59))  // $100 → $140
const flat60    = Array.from({ length: 60 }, () => 100)

const declining30 = Array.from({ length: 30 }, (_, i) => 100 - i * 2)  // $100 → $42
const rising30    = Array.from({ length: 30 }, (_, i) => 100 + i * 2)  // $100 → $158

// 50-day series for MACD (need ≥35)
const bearish50 = Array.from({ length: 50 }, (_, i) => 200 - i * (60 / 49))
const bullish50 = Array.from({ length: 50 }, (_, i) => 100 + i * (60 / 49))

// ── linearRegression tests ──────────────────────────────────────────────────

describe('linearRegression', () => {
  it('slope = 1 for perfectly ascending data [1,2,3,4,5]', () => {
    const { slope, intercept } = linearRegression([1, 2, 3, 4, 5])
    expect(slope).toBeCloseTo(1, 5)
    expect(intercept).toBeCloseTo(1, 5)
  })

  it('slope = -1 for perfectly descending data [5,4,3,2,1]', () => {
    const { slope, intercept } = linearRegression([5, 4, 3, 2, 1])
    expect(slope).toBeCloseTo(-1, 5)
    expect(intercept).toBeCloseTo(5, 5)
  })

  it('slope = 0 for flat data', () => {
    const { slope } = linearRegression([10, 10, 10, 10, 10])
    expect(slope).toBeCloseTo(0, 5)
  })

  it('projects bearish stock lower at day +30 (negative slope)', () => {
    const { slope, intercept } = linearRegression(bearish60)
    const lastIdx = bearish60.length - 1
    const projected = intercept + slope * (lastIdx + 30)
    expect(projected).toBeLessThan(bearish60[lastIdx])
  })

  it('projects bullish stock higher at day +30 (positive slope)', () => {
    const { slope, intercept } = linearRegression(bullish60)
    const lastIdx = bullish60.length - 1
    const projected = intercept + slope * (lastIdx + 30)
    expect(projected).toBeGreaterThan(bullish60[lastIdx])
  })
})

// ── ewma tests ──────────────────────────────────────────────────────────────

describe('ewma', () => {
  it('single-step: 0.3 * curr + 0.7 * prev', () => {
    expect(ewma([100, 110], 0.3)).toBeCloseTo(103, 5)
  })

  it('returns last price if array has one element', () => {
    expect(ewma([100])).toBe(100)
  })

  it('EWMA of declining series is below starting price', () => {
    const val = ewma([100, 90, 80, 70], 0.3)
    expect(val).toBeLessThan(100)
  })

  it('EWMA of ascending series is above starting price', () => {
    const val = ewma([100, 110, 120, 130], 0.3)
    expect(val).toBeGreaterThan(100)
  })
})

// ── Forecast integration tests ──────────────────────────────────────────────

describe('forecast filter (regresión lineal + EWMA)', () => {
  it('BEARISH stock fails (forecastReturn < 0.02)', () => {
    const { forecastReturn, pass } = forecastResult(bearish60)
    expect(forecastReturn).toBeLessThan(0.02)
    expect(pass).toBe(false)
  })

  it('BULLISH stock passes (forecastReturn ≥ 0.02)', () => {
    const { forecastReturn, pass } = forecastResult(bullish60)
    expect(forecastReturn).toBeGreaterThanOrEqual(0.02)
    expect(pass).toBe(true)
  })

  it('FLAT stock fails (no upside projected)', () => {
    const { pass } = forecastResult(flat60)
    expect(pass).toBe(false)
  })

  it('forecastReturn is negative for declining stock', () => {
    const { forecastReturn } = forecastResult(bearish60)
    expect(forecastReturn).toBeLessThan(0)
  })
})

// ── calcRSI tests ───────────────────────────────────────────────────────────

describe('calcRSI', () => {
  it('returns 50 when fewer than period+1 prices provided', () => {
    expect(calcRSI([100, 110], 14)).toBe(50)
  })

  it('RSI < 50 for steadily declining prices (bearish momentum)', () => {
    const rsi = calcRSI(declining30, 14)
    expect(rsi).toBeLessThan(50)
  })

  it('RSI > 50 for steadily rising prices (bullish momentum)', () => {
    const rsi = calcRSI(rising30, 14)
    expect(rsi).toBeGreaterThan(50)
  })

  it('RSI = 50 for flat prices (neutral, no bias)', () => {
    const rsi = calcRSI(Array(20).fill(100), 14)
    expect(rsi).toBe(50)
  })

  it('RSI = 100 for all-up prices (extreme overbought)', () => {
    const allUp = Array.from({ length: 20 }, (_, i) => 100 + i)
    const rsi = calcRSI(allUp, 14)
    expect(rsi).toBe(100)
  })
})

// ── calcEMA tests ───────────────────────────────────────────────────────────

describe('calcEMA', () => {
  it('first element equals first price', () => {
    const ema = calcEMA([10, 20, 30], 3)
    expect(ema[0]).toBe(10)
  })

  it('k = 0.5 for period=3: EMA[1] = 0.5*20 + 0.5*10 = 15', () => {
    const ema = calcEMA([10, 20, 30], 3)
    expect(ema[1]).toBeCloseTo(15, 5)
  })

  it('k = 0.5 for period=3: EMA[2] = 0.5*30 + 0.5*15 = 22.5', () => {
    const ema = calcEMA([10, 20, 30], 3)
    expect(ema[2]).toBeCloseTo(22.5, 5)
  })

  it('EMA of ascending series trends upward', () => {
    const prices = Array.from({ length: 20 }, (_, i) => i + 1)
    const ema = calcEMA(prices, 5)
    expect(ema[ema.length - 1]).toBeGreaterThan(ema[0])
  })
})

// ── calcMACD tests ──────────────────────────────────────────────────────────

describe('calcMACD', () => {
  it('returns zeros for series shorter than 35', () => {
    const { macd, signal } = calcMACD([100, 110, 120])
    expect(macd).toBe(0)
    expect(signal).toBe(0)
  })

  it('BEARISH stock: macd < signal (sell signal)', () => {
    const { pass } = calcMACD(bearish50)
    expect(pass).toBe(false)
  })

  it('BULLISH stock: macd > signal (buy signal)', () => {
    const { pass } = calcMACD(bullish50)
    expect(pass).toBe(true)
  })
})

// ── Guarda de prima de los agentes de opciones ──────────────────────────────
// (refleja el paso de cadena de AgenteGamma.tsx y AgenteTheta.tsx)

/**
 * La prima es el precio de entrada de una posición en opciones. Sin horquilla
 * ni cruce reciente el contrato se descarta: guardarlo con prima 0 falsearía el
 * rendimiento e impediría calcular la rentabilidad al liquidar.
 */
function primaDeEntrada(c: { mid: number | null; lastPrice: number | null }): number | null {
  const premium = c.mid ?? c.lastPrice ?? null
  return premium == null || premium <= 0 ? null : premium
}

describe('guarda de prima (agentes de opciones)', () => {
  it('usa el punto medio de la horquilla cuando existe', () => {
    expect(primaDeEntrada({ mid: 3.4, lastPrice: 9.9 })).toBe(3.4)
  })

  it('cae al último cruce cuando no hay horquilla', () => {
    expect(primaDeEntrada({ mid: null, lastPrice: 2.15 })).toBe(2.15)
  })

  it('descarta el contrato sin horquilla ni cruce', () => {
    expect(primaDeEntrada({ mid: null, lastPrice: null })).toBeNull()
  })

  it('descarta la prima cero en lugar de guardarla como entrada', () => {
    expect(primaDeEntrada({ mid: 0, lastPrice: null })).toBeNull()
    expect(primaDeEntrada({ mid: null, lastPrice: 0 })).toBeNull()
  })

  it('descarta una prima negativa', () => {
    expect(primaDeEntrada({ mid: -1, lastPrice: null })).toBeNull()
  })
})
