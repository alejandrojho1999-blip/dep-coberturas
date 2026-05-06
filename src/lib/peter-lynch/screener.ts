import YahooFinance from 'yahoo-finance2'

export interface ScreenerResult {
  ticker: string
  name: string
  sector: string
  pe_historico: number | null
  pe_proyectado: number | null
  deuda_capital: number | null
  crecimiento_eps: number | null
  peg: number | null
  market_cap: number | null
  criteria: {
    pe_historico: boolean
    pe_proyectado: boolean
    deuda_capital: boolean
    crecimiento_eps: boolean
    peg: boolean
    market_cap: boolean
  }
  score: number
}

const SP500_NASDAQ100_TICKERS = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','BRK-B','JPM','UNH',
  'V','MA','AVGO','XOM','LLY','JNJ','PG','HD','ABBV','KO',
  'PEP','MRK','MCD','BAC','GS','WMT','ORCL','CRM','ADBE','ACN',
  'COST','TMO','CSCO','NFLX','LIN','TXN','AMAT','AMD','QCOM','PM',
  'HON','UNP','RTX','CAT','DE','IBM','GE','LOW','AMGN','GILD',
  'SBUX','ISRG','NOW','PANW','CRWD','MU','LRCX','KLAC','MRVL','ADI',
  'REGN','VRTX','ZTS','CVS','MCK','ELV','INTC','MDLZ','ON','MELI',
  'COIN','DDOG','ZS','ENPH','FSLR','SE','SNOW','BMY','PFE','ABBV',
]

let cache: { data: ScreenerResult[]; ts: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

async function fetchBatch(tickers: string[]): Promise<ScreenerResult[]> {
  const yf = new YahooFinance()
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const summary = await yf.quoteSummary(ticker, {
        modules: ['defaultKeyStatistics', 'financialData', 'price', 'summaryProfile'],
      })

      const ks = summary.defaultKeyStatistics
      const fd = summary.financialData
      const pr = summary.price
      const sp = summary.summaryProfile

      const trailingPE = (ks?.trailingPE as number | null | undefined) ?? null
      const forwardPE  = (ks?.forwardPE  as number | null | undefined) ?? null
      const pegRatio   = (ks?.pegRatio   as number | null | undefined) ?? null
      const debtToEquity = (fd?.debtToEquity as number | null | undefined) ?? null
      const earningsGrowth = (fd?.earningsGrowth as number | null | undefined) ?? null
      const marketCap  = (pr?.marketCap  as number | null | undefined) ?? null
      const name       = (pr?.longName   as string | undefined) ?? (pr?.shortName as string | undefined) ?? ticker
      const sector     = (sp?.sector     as string | undefined) ?? '—'

      const criteria = {
        pe_historico:    trailingPE   != null && trailingPE   < 25,
        pe_proyectado:   forwardPE    != null && forwardPE    < 15,
        deuda_capital:   debtToEquity != null && debtToEquity < 35,
        crecimiento_eps: earningsGrowth != null && earningsGrowth > 0.15,
        peg:             pegRatio     != null && pegRatio     < 2,
        market_cap:      marketCap    != null && marketCap    > 5_000_000_000,
      }

      const score = Object.values(criteria).filter(Boolean).length

      return {
        ticker,
        name,
        sector,
        pe_historico: trailingPE,
        pe_proyectado: forwardPE,
        deuda_capital: debtToEquity,
        crecimiento_eps: earningsGrowth,
        peg: pegRatio,
        market_cap: marketCap,
        criteria,
        score,
      } satisfies ScreenerResult
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ScreenerResult> => r.status === 'fulfilled')
    .map((r) => r.value)
}

export async function runScreener(): Promise<ScreenerResult[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data

  const uniqueTickers = [...new Set(SP500_NASDAQ100_TICKERS)]
  const BATCH_SIZE = 10
  const all: ScreenerResult[] = []

  for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
    const batch = uniqueTickers.slice(i, i + BATCH_SIZE)
    const batchResults = await fetchBatch(batch)
    all.push(...batchResults)
    if (i + BATCH_SIZE < uniqueTickers.length) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  const sorted = all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.market_cap ?? 0) - (a.market_cap ?? 0)
  })

  cache = { data: sorted, ts: Date.now() }
  return sorted
}
