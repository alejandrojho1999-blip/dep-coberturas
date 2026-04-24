import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export interface FREDObservation {
  date: string   // 'YYYY-MM-DD'
  value: number
}

export interface FREDSeriesMap {
  YIELD_10Y: FREDObservation[]
  FED_RATE: FREDObservation[]
  VIX: FREDObservation[]
}

function getQuarterKey(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() // 0-indexed
  const quarter = Math.floor(month / 3)
  return `${year}-Q${quarter}`
}

function resampleToQuarterly(observations: FREDObservation[]): FREDObservation[] {
  const quarterMap = new Map<string, FREDObservation>()
  for (const obs of observations) {
    const key = getQuarterKey(obs.date)
    quarterMap.set(key, obs) // last one wins — FRED data is sorted ascending
  }
  return Array.from(quarterMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchFREDSeries(
  seriesId: string,
  startDate: string,
  endDate: string,
): Promise<FREDObservation[]> {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) {
    throw new Error(
      'FRED_API_KEY no está configurada. Obtén una gratis en https://fred.stlouisfed.org/docs/api/api_key.html y agrégala en Vercel → Settings → Environment Variables.',
    )
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    observation_start: startDate,
    observation_end: endDate,
    file_type: 'json',
    api_key: apiKey,
  })

  const url = `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`FRED API error for series ${seriesId}: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as {
    observations: Array<{ date: string; value: string }>
  }

  const observations: FREDObservation[] = data.observations
    .filter((obs) => obs.value !== '.')
    .map((obs) => ({ date: obs.date, value: parseFloat(obs.value) }))

  return resampleToQuarterly(observations)
}

// VIX comes from Yahoo Finance (^VIX) — avoids FRED VIXCLS 500 errors
async function fetchVIXFromYahoo(startDate: string, endDate: string): Promise<FREDObservation[]> {
  const result = await yahooFinance.historical('^VIX', {
    period1: startDate,
    period2: endDate,
    interval: '1d',
  }) as { date: Date; close: number }[]

  const observations: FREDObservation[] = result
    .filter((r) => r.close != null && isFinite(r.close))
    .map((r) => ({
      date: r.date.toISOString().split('T')[0],
      value: r.close,
    }))

  return resampleToQuarterly(observations)
}

export async function fetchMacroData(
  startDate: string,
  endDate?: string,
): Promise<FREDSeriesMap> {
  const today = new Date().toISOString().split('T')[0]
  const end = endDate ?? today

  const [YIELD_10Y, FED_RATE, VIX] = await Promise.all([
    fetchFREDSeries('DGS10', startDate, end),
    fetchFREDSeries('FEDFUNDS', startDate, end),
    fetchVIXFromYahoo(startDate, end),
  ])

  return { YIELD_10Y, FED_RATE, VIX }
}
