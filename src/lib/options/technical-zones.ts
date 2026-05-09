export interface PriceCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TechnicalZones {
  candles: PriceCandle[]
  support: number | null
  resistance: number | null
  sma50: number | null
  sma200: number | null
  range52WeekLow: number | null
  range52WeekHigh: number | null
  technicalBias: 'bullish' | 'neutral' | 'bearish'
  notes: string[]
}

export async function fetchTechnicalZones(ticker: string, spot: number): Promise<TechnicalZones> {
  const encoded = encodeURIComponent(ticker.toUpperCase())
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1y&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(9000),
  })
  if (!res.ok) throw new Error(`Yahoo chart returned ${res.status} for ${ticker}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const timestamps: number[] = result?.timestamp ?? []
  const quote = result?.indicators?.quote?.[0] ?? {}
  const candles: PriceCandle[] = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: Number(quote.open?.[i]),
      high: Number(quote.high?.[i]),
      low: Number(quote.low?.[i]),
      close: Number(quote.close?.[i]),
      volume: Number(quote.volume?.[i]),
    }))
    .filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite))

  return analyzeTechnicalZones(candles, spot)
}

export function analyzeTechnicalZones(candles: PriceCandle[], spot: number): TechnicalZones {
  const closes = candles.map((c) => c.close)
  const lows = candles.map((c) => c.low)
  const highs = candles.map((c) => c.high)
  const support = findNearestLevel(lows, spot, 'below')
  const resistance = findNearestLevel(highs, spot, 'above')
  const sma50 = average(closes.slice(-50))
  const sma200 = average(closes.slice(-200))
  const range52WeekLow = lows.length ? Math.min(...lows) : null
  const range52WeekHigh = highs.length ? Math.max(...highs) : null
  const notes: string[] = []

  if (support != null) notes.push(`Soporte estimado cerca de $${support.toFixed(2)}`)
  if (resistance != null) notes.push(`Resistencia estimada cerca de $${resistance.toFixed(2)}`)
  if (sma50 != null && sma200 != null) {
    notes.push(`SMA50 ${sma50 > sma200 ? 'sobre' : 'bajo'} SMA200`)
  }

  let technicalBias: TechnicalZones['technicalBias'] = 'neutral'
  if (sma50 != null && sma200 != null && spot > sma50 && sma50 > sma200) technicalBias = 'bullish'
  if (sma50 != null && sma200 != null && spot < sma50 && sma50 < sma200) technicalBias = 'bearish'

  return {
    candles: candles.slice(-90),
    support,
    resistance,
    sma50,
    sma200,
    range52WeekLow,
    range52WeekHigh,
    technicalBias,
    notes,
  }
}

function findNearestLevel(values: number[], spot: number, side: 'below' | 'above'): number | null {
  const filtered = values.filter((v) => Number.isFinite(v) && (side === 'below' ? v < spot : v > spot))
  if (!filtered.length) return null
  const rounded = filtered.map((v) => Number(v.toFixed(1)))
  const counts = new Map<number, number>()
  for (const value of rounded) counts.set(value, (counts.get(value) ?? 0) + 1)
  const clustered = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([value, count]) => ({ value, count, distance: Math.abs(value - spot) }))
    .sort((a, b) => b.count - a.count || a.distance - b.distance)
  if (clustered[0]) return clustered[0].value
  return filtered.reduce((best, value) => Math.abs(value - spot) < Math.abs(best - spot) ? value : best, filtered[0])
}

function average(values: number[]): number | null {
  const clean = values.filter(Number.isFinite)
  if (!clean.length) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}
