import yahooFinance from 'yahoo-finance2'

export interface PriceObservation {
  date: string             // quarter-end date 'YYYY-MM-DD'
  close: number
  logReturn: number        // log(P_t / P_{t-1})
  futureReturn: number | null  // log return shifted by -horizon quarters
}

interface HistoricalRow {
  date: Date
  close: number
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getQuarterKey(date: Date): string {
  const year = date.getFullYear()
  const quarter = Math.floor(date.getMonth() / 3)
  return `${year}-Q${quarter}`
}

function resampleToQuarterly(rows: HistoricalRow[]): HistoricalRow[] {
  // Group by quarter, take the last row (sorted ascending)
  const quarterMap = new Map<string, HistoricalRow>()

  for (const row of rows) {
    const key = getQuarterKey(row.date)
    quarterMap.set(key, row) // last one wins
  }

  return Array.from(quarterMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  )
}

export async function fetchStockData(
  ticker: string,
  startDate: string,
  endDate?: string,
  horizon = 2
): Promise<PriceObservation[]> {
  const today = new Date().toISOString().split('T')[0]
  const end = endDate ?? today

  const rawData = await yahooFinance.historical(ticker, {
    period1: startDate,
    period2: end,
    interval: '1d',
  })

  // Filter rows that have a valid close price
  const validRows: HistoricalRow[] = rawData
    .filter((row) => row.close != null && !isNaN(row.close))
    .map((row) => ({ date: row.date, close: row.close }))

  // Resample to quarterly
  const quarterly = resampleToQuarterly(validRows)

  if (quarterly.length === 0) {
    return []
  }

  // Compute log returns
  const logReturns: (number | null)[] = quarterly.map((row, i) => {
    if (i === 0) return null
    return Math.log(row.close / quarterly[i - 1].close)
  })

  // Build observations with future returns
  const observations: PriceObservation[] = quarterly.map((row, i) => {
    const logReturn = logReturns[i] ?? NaN
    const futureIdx = i + horizon
    const futureReturn =
      futureIdx < logReturns.length && logReturns[futureIdx] !== null
        ? (logReturns[futureIdx] as number)
        : null

    return {
      date: toDateString(row.date),
      close: row.close,
      logReturn,
      futureReturn,
    }
  })

  return observations
}
