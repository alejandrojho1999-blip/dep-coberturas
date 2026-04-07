export interface FREDObservation {
  date: string   // 'YYYY-MM-DD'
  value: number  // NaN if missing ('.' in FRED)
}

export interface FREDSeriesMap {
  YIELD_10Y: FREDObservation[]
  FED_RATE: FREDObservation[]
  VIX: FREDObservation[]
}

const FRED_SERIES_IDS: Record<keyof FREDSeriesMap, string> = {
  YIELD_10Y: 'DGS10',
  FED_RATE: 'FEDFUNDS',
  VIX: 'VIXCLS',
}

function getQuarterKey(date: string): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth() // 0-indexed
  const quarter = Math.floor(month / 3)
  return `${year}-Q${quarter}`
}

function resampleToQuarterly(observations: FREDObservation[]): FREDObservation[] {
  // Group by quarter, take the last observation in each quarter
  const quarterMap = new Map<string, FREDObservation>()

  for (const obs of observations) {
    const key = getQuarterKey(obs.date)
    // Always overwrite — last one wins since FRED data is sorted ascending
    quarterMap.set(key, obs)
  }

  return Array.from(quarterMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
}

export async function fetchFREDSeries(
  seriesId: string,
  startDate: string,
  endDate: string
): Promise<FREDObservation[]> {
  const apiKey = process.env.FRED_API_KEY
  const params = new URLSearchParams({
    series_id: seriesId,
    observation_start: startDate,
    observation_end: endDate,
    file_type: 'json',
    ...(apiKey ? { api_key: apiKey } : {}),
  })

  const url = `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `FRED API error for series ${seriesId}: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as {
    observations: Array<{ date: string; value: string }>
  }

  const observations: FREDObservation[] = data.observations
    .filter((obs) => obs.value !== '.')
    .map((obs) => ({
      date: obs.date,
      value: parseFloat(obs.value),
    }))

  return resampleToQuarterly(observations)
}

export async function fetchMacroData(
  startDate: string,
  endDate?: string
): Promise<FREDSeriesMap> {
  const today = new Date().toISOString().split('T')[0]
  const end = endDate ?? today

  const [YIELD_10Y, FED_RATE, VIX] = await Promise.all([
    fetchFREDSeries(FRED_SERIES_IDS.YIELD_10Y, startDate, end),
    fetchFREDSeries(FRED_SERIES_IDS.FED_RATE, startDate, end),
    fetchFREDSeries(FRED_SERIES_IDS.VIX, startDate, end),
  ])

  return { YIELD_10Y, FED_RATE, VIX }
}
