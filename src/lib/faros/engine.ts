import YahooFinance from 'yahoo-finance2'

export type FarosState = 'SÓLIDO' | 'LÍQUIDO' | 'GAS' | 'PLASMA'
export type FarosRegime =
  | 'INSTITUTIONAL_ACCUMULATION'
  | 'HIGH_MOMENTUM'
  | 'CONSOLIDATION'
  | 'DISTRIBUTION_BEAR'
  | 'STRUCTURAL_BREAK'
export type FarosSignal = 'BUY' | 'HOLD' | 'SELL' | 'CASH'

export interface FarosResult {
  ticker: string
  price: number
  state: FarosState
  regime: FarosRegime
  zScore: number
  reynoldsPercentile: number
  entropy: number
  alphaFlow: number
  psi: number
  signal: FarosSignal
  momentum5d: number
  name: string
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function stdDev(arr: number[]): number {
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length)
}

function percentileRank(arr: number[], value: number): number {
  const below = arr.filter((v) => v < value).length
  return (below / arr.length) * 100
}

function shannonEntropy(hist: number[]): number {
  const total = hist.reduce((s, v) => s + v, 0)
  if (total === 0) return 0
  return hist.reduce((s, v) => {
    const p = (v + 1) / (total + hist.length)
    return s - p * Math.log2(p)
  }, 0)
}

function histogram(values: number[], bins: number): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = (max - min) / bins || 1
  const h = new Array<number>(bins).fill(0)
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), bins - 1)
    h[idx]++
  }
  return h
}

export async function analyzeFaros(ticker: string): Promise<FarosResult> {
  const yf = new YahooFinance()
  const period2 = new Date()
  const period1 = new Date(period2.getTime() - 380 * 24 * 60 * 60 * 1000)

  const [bars, quote] = await Promise.all([
    yf.historical(ticker, { period1, period2, interval: '1d' }),
    yf.quote(ticker),
  ])

  if (bars.length < 30) throw new Error(`Datos insuficientes para ${ticker}`)

  const sorted = [...bars].sort((a, b) => b.date.getTime() - a.date.getTime())
  const closes  = sorted.map((b) => b.adjClose ?? b.close)
  const highs   = sorted.map((b) => b.high)
  const lows    = sorted.map((b) => b.low)
  const volumes = sorted.map((b) => b.volume ?? 0)

  const currentPrice = closes[0]
  const window20 = closes.slice(0, 20)
  const mu20     = mean(window20)
  const sigma20  = stdDev(window20) || 0.0001
  const zScore   = (currentPrice - mu20) / sigma20

  // State
  let state: FarosState
  if (zScore < -1.5) state = 'PLASMA'
  else if (Math.abs(zScore) > 3.0) state = 'GAS'
  else if (zScore > 0.5 && zScore < 2.0) state = 'LÍQUIDO'
  else if (Math.abs(zScore) < 0.5) state = 'SÓLIDO'
  else state = 'LÍQUIDO'

  // Momentum 5d
  const momentum5d = closes.length >= 5 ? (closes[0] - closes[4]) / closes[4] : 0

  // Reynolds calculation for each day
  const vol20mean = mean(volumes.slice(0, 20))
  const vol20std  = stdDev(volumes.slice(0, 20)) || 1
  const density   = vol20mean / vol20std

  const charLength = sigma20 / currentPrice

  const spreads20 = sorted.slice(0, 20).map((_, i) => (highs[i] - lows[i]) / (closes[i] || 1))
  const avgSpread = mean(spreads20)

  const amihudValues = sorted.slice(0, 20).map((_, i) => {
    const ret = i < sorted.length - 1 ? Math.abs((closes[i] - closes[i + 1]) / closes[i + 1]) : 0
    const vol = volumes[i]
    const px  = closes[i]
    return vol > 0 && px > 0 ? (ret / (vol * px)) * 1e8 : 0
  })
  const amihudAvg = mean(amihudValues)

  const viscosity = Math.max((avgSpread * 0.5) + (amihudAvg * 0.5), 1e-9)
  const reynoldsRaw = (density * Math.abs(momentum5d) * charLength) / viscosity

  // Rolling Reynolds percentile over available history
  const allReynolds: number[] = []
  const histLen = Math.min(sorted.length, 252)
  for (let i = 0; i < histLen - 20; i++) {
    const slice = closes.slice(i, i + 20)
    const vm    = mean(volumes.slice(i, i + 20))
    const vs    = stdDev(volumes.slice(i, i + 20)) || 1
    const d     = vm / vs
    const m5    = slice.length >= 5 ? Math.abs((slice[0] - slice[4]) / slice[4]) : 0
    const cl    = (stdDev(slice) || 0.0001) / slice[0]
    const sp    = mean(sorted.slice(i, i + 20).map((_, j) => (highs[i + j] - lows[i + j]) / (closes[i + j] || 1)))
    const visc  = Math.max(sp * 0.5 + 0.0001, 1e-9)
    allReynolds.push((d * m5 * cl) / visc)
  }
  const reynoldsPercentile = allReynolds.length > 0 ? percentileRank(allReynolds, reynoldsRaw) : 50

  // Shannon entropy on volume distribution
  const relVolumes = volumes.slice(0, 20).map((v) => v / (vol20mean || 1))
  const H          = shannonEntropy(histogram(relVolumes, 10))
  const H_norm     = Math.min(H / Math.log2(10), 1)

  // alpha flow
  const pArtificial = Math.max(0, (reynoldsPercentile - 70) / 30) * (1 - H_norm)
  const alphaFlow   = H_norm * (1 - pArtificial)

  // Momentum vector
  const M = (1 + momentum5d) * (1 + H_norm) - 1

  // Ψ governance
  const gamma          = 0.5
  const topologyFactor = state === 'LÍQUIDO' ? 1 : 0.2
  const rePct          = Math.max(reynoldsPercentile / 100, 1e-6)
  const rawPsi         = Math.tanh((M * alphaFlow) / (Math.pow(rePct, gamma) + 1e-9))
  const psi            = Math.max(0, Math.min(1, rawPsi * topologyFactor))

  // Regime
  let regime: FarosRegime
  let signal: FarosSignal
  if (reynoldsPercentile > 75 && momentum5d <= 0.10) {
    regime = 'STRUCTURAL_BREAK'; signal = 'CASH'
  } else if (reynoldsPercentile > 75 && momentum5d > 0.10) {
    regime = 'HIGH_MOMENTUM'; signal = 'BUY'
  } else if (momentum5d > 0.02) {
    regime = 'INSTITUTIONAL_ACCUMULATION'; signal = 'BUY'
  } else if (momentum5d < -0.05) {
    regime = 'DISTRIBUTION_BEAR'; signal = 'SELL'
  } else {
    regime = 'CONSOLIDATION'; signal = 'HOLD'
  }

  const name = (quote.longName ?? quote.shortName ?? ticker) as string

  return {
    ticker,
    price: currentPrice,
    state,
    regime,
    zScore,
    reynoldsPercentile,
    entropy: H_norm,
    alphaFlow,
    psi,
    signal,
    momentum5d,
    name,
  }
}
