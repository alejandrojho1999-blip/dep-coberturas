// lib/yahoo-financials.ts
// Fetches comprehensive financial data from Yahoo Finance quoteSummary API

// ── Crumb auth (Yahoo Finance requires crumb + session cookie since 2024) ──────
let _crumbCache: { crumb: string; cookie: string; at: number } | null = null

function extractCookies(headers: Headers): string {
  const setCookies: string[] =
    typeof (headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (headers as { getSetCookie: () => string[] }).getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')!]
        : []
  return setCookies.map((c) => c.split(';')[0]).join('; ')
}

export async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (_crumbCache && Date.now() - _crumbCache.at < 3_600_000) return _crumbCache

  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  const baseHeaders = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  }

  // 1. Use fc.yahoo.com — more reliable cookie source than finance.yahoo.com
  let cookie = ''
  try {
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: baseHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    cookie = extractCookies(r1.headers)
  } catch {
    // fallback: try finance.yahoo.com directly
    try {
      const r1b = await fetch('https://finance.yahoo.com/', {
        headers: baseHeaders,
        signal: AbortSignal.timeout(8000),
      })
      cookie = extractCookies(r1b.headers)
    } catch { /* continue without cookies */ }
  }

  // 2. Get crumb — try query2 first, then query1
  let crumb = ''
  for (const host of ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']) {
    try {
      const r2 = await fetch(`${host}/v1/test/getcrumb`, {
        headers: { 'User-Agent': ua, Accept: '*/*', ...(cookie ? { Cookie: cookie } : {}) },
        signal: AbortSignal.timeout(8000),
      })
      const text = (await r2.text()).trim()
      // Valid crumb is a short alphanumeric string, not HTML
      if (text && !text.startsWith('<') && text.length < 50) {
        crumb = text
        break
      }
    } catch { /* try next host */ }
  }

  if (!crumb) throw new Error('No se pudo obtener crumb de Yahoo Finance')

  _crumbCache = { crumb, cookie, at: Date.now() }
  return _crumbCache
}

export interface TickerFinancials {
  ticker: string
  empresa: string
  bolsa: string
  sector: string
  industria: string
  descripcion: string
  // Price
  precioActual: number
  rango52Min: number
  rango52Max: number
  beta: number
  // Valuation
  marketCap: number      // in billions
  enterpriseValue: number
  peTrailing: number | null
  peForward: number | null
  psRatio: number | null
  evEbitda: number | null
  // Financials TTM
  revenueTTM: number    // in billions
  ebitda: number | null // in billions
  margenBruto: number | null
  margenOperativo: number | null
  margenNeto: number | null
  epsTrailing: number | null
  epsForward: number | null
  // Balance
  debtToEquity: number | null
  pegRatio: number | null
  deudaTotal: number | null
  caja: number | null
  acciones: number | null // in millions
  // Annual history [[year, revenue, grossProfit, netIncome]]
  historico: Array<[string, string, string, string]>
  // Analysts
  numAnalistas: number
  consenso: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
  precioObjetivoMedio: number | null
  precioObjetivoMediana: number | null
  precioObjetivoMax: number | null
  precioObjetivoMin: number | null
}

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val == null || isNaN(val)) return 'N/D'
  return val.toFixed(decimals)
}

function fmtB(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return 'N/D'
  return (val / 1e9).toFixed(2)
}

function fmtM(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return 'N/D'
  return (val / 1e6).toFixed(0)
}

function safeNum(val: unknown): number | null {
  const n = Number(val)
  return isFinite(n) ? n : null
}

export async function fetchTickerFinancials(ticker: string): Promise<TickerFinancials> {
  const modules = [
    'price',
    'summaryDetail',
    'defaultKeyStatistics',
    'financialData',
    'incomeStatementHistory',
    'recommendationTrend',
    'assetProfile',
  ].join('%2C')

  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

  // Try with crumb; if 401, invalidate cache and retry once
  let res: Response | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) _crumbCache = null // force fresh crumb on retry
    const { crumb, cookie } = await getYahooCrumb()
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`
    res = await fetch(url, {
      headers: { 'User-Agent': ua, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      signal: AbortSignal.timeout(12000),
    })
    if (res.status !== 401) break
  }
  if (!res) throw new Error(`No response from Yahoo Finance for ${ticker}`)
  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${ticker}`)

  const json = await res.json()
  const result = json?.quoteSummary?.result?.[0]
  if (!result) throw new Error(`No data found for ticker ${ticker}`)

  const price        = result.price ?? {}
  const summary      = result.summaryDetail ?? {}
  const keyStats     = result.defaultKeyStatistics ?? {}
  const finData      = result.financialData ?? {}
  const incomeHist   = result.incomeStatementHistory?.incomeStatementHistory ?? []
  const recTrend     = result.recommendationTrend?.trend ?? []
  const profile      = result.assetProfile ?? {}

  // Analyst consensus from most recent period
  const rec0 = recTrend[0] ?? {}
  const strongBuy  = safeNum(rec0.strongBuy)  ?? 0
  const buy        = safeNum(rec0.buy)        ?? 0
  const hold       = safeNum(rec0.hold)       ?? 0
  const sell       = safeNum(rec0.sell)       ?? 0
  const strongSell = safeNum(rec0.strongSell) ?? 0
  const totalRec = strongBuy + buy + hold + sell + strongSell
  let consenso = 'N/D'
  if (totalRec > 0) {
    const bullish = strongBuy + buy
    const bearish = sell + strongSell
    if (bullish / totalRec >= 0.6) consenso = 'BUY'
    else if (bearish / totalRec >= 0.4) consenso = 'SELL'
    else consenso = 'HOLD'
  }

  // Annual history (last 3 years)
  const historico: Array<[string, string, string, string]> = incomeHist
    .slice(0, 3)
    .map((stmt: Record<string, { raw?: number }>) => {
      const endDate = new Date((stmt.endDate?.raw ?? 0) * 1000).getFullYear().toString()
      const rev  = stmt.totalRevenue?.raw
      const gp   = stmt.grossProfit?.raw
      const ni   = stmt.netIncome?.raw
      return [
        endDate,
        rev != null ? `US$${(rev / 1e9).toFixed(2)}B` : 'N/D',
        gp  != null ? `US$${(gp  / 1e9).toFixed(2)}B` : 'N/D',
        ni  != null ? `US$${(ni  / 1e9).toFixed(2)}B` : 'N/D',
      ] as [string, string, string, string]
    })

  return {
    ticker: (price.symbol ?? ticker).toUpperCase(),
    empresa: price.longName ?? price.shortName ?? ticker,
    bolsa: price.exchangeName ?? price.exchange ?? 'N/D',
    sector: profile.sector ?? 'N/D',
    industria: profile.industry ?? 'N/D',
    descripcion: (profile.longBusinessSummary ?? '').slice(0, 500),
    precioActual: safeNum(price.regularMarketPrice?.raw) ?? 0,
    rango52Min: safeNum(summary.fiftyTwoWeekLow?.raw) ?? 0,
    rango52Max: safeNum(summary.fiftyTwoWeekHigh?.raw) ?? 0,
    beta: safeNum(summary.beta?.raw) ?? 0,
    marketCap: safeNum(price.marketCap?.raw) ?? 0,
    enterpriseValue: safeNum(keyStats.enterpriseValue?.raw) ?? 0,
    peTrailing: safeNum(summary.trailingPE?.raw),
    peForward: safeNum(keyStats.forwardPE?.raw),
    psRatio: safeNum(keyStats.priceToSalesTrailing12Months?.raw),
    evEbitda: safeNum(keyStats.enterpriseToEbitda?.raw),
    revenueTTM: safeNum(finData.totalRevenue?.raw) ?? 0,
    ebitda: safeNum(finData.ebitda?.raw),
    margenBruto: safeNum(finData.grossMargins?.raw) != null ? (safeNum(finData.grossMargins.raw)! * 100) : null,
    margenOperativo: safeNum(finData.operatingMargins?.raw) != null ? (safeNum(finData.operatingMargins.raw)! * 100) : null,
    margenNeto: safeNum(finData.profitMargins?.raw) != null ? (safeNum(finData.profitMargins.raw)! * 100) : null,
    epsTrailing: safeNum(keyStats.trailingEps?.raw),
    epsForward: safeNum(keyStats.forwardEps?.raw),
    debtToEquity: (() => {
      // Use Yahoo's D/E directly if available (it's already a ratio)
      const yahooDE = safeNum(keyStats.debtToEquity?.raw)
      if (yahooDE != null && yahooDE >= 0) return yahooDE
      
      // Fallback: Calculate from Enterprise Value
      const ev = safeNum(keyStats.enterpriseValue?.raw) ?? 0
      const mktCap = safeNum(price.marketCap?.raw) ?? 0
      const debt = safeNum(keyStats.totalDebt?.raw) ?? 0
      const cash = safeNum(finData.totalCash?.raw) ?? 0
      
      if (ev > 0 && mktCap > 0) {
        // Net Debt = EV - Market Cap (approximation of debt - cash)
        const netDebt = ev - mktCap
        const equity = mktCap
        if (equity > 0) return netDebt / equity
      }
      
      // Final fallback: total debt to market cap
      if (debt > 0 && mktCap > 0) {
        return debt / mktCap
      }
      
      return null
    })(),
    pegRatio: safeNum(keyStats.pegRatio?.raw),
    deudaTotal: safeNum(keyStats.totalDebt?.raw),
    caja: safeNum(finData.totalCash?.raw),
    acciones: safeNum(keyStats.sharesOutstanding?.raw),
    historico,
    numAnalistas: totalRec,
    consenso,
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    precioObjetivoMedio: safeNum(finData.targetMeanPrice?.raw),
    precioObjetivoMediana: safeNum(finData.targetMedianPrice?.raw),
    precioObjetivoMax: safeNum(finData.targetHighPrice?.raw),
    precioObjetivoMin: safeNum(finData.targetLowPrice?.raw),
  }
}

export function buildDataBlock(d: TickerFinancials): string {
  return `=== DATOS REALES DE MERCADO (fuente: Yahoo Finance — NO modificar estas cifras) ===

EMPRESA: ${d.empresa} | Ticker: ${d.ticker} | Bolsa: ${d.bolsa}
Sector: ${d.sector} | Industria: ${d.industria}

PRECIO Y RANGO:
  Precio actual:       US$${fmt(d.precioActual)}
  Rango 52 semanas:    US$${fmt(d.rango52Min)} – US$${fmt(d.rango52Max)}
  Beta:                ${fmt(d.beta)}

VALORACIÓN:
  Cap. de mercado:     US$${fmtB(d.marketCap)}B
  Enterprise Value:    US$${fmtB(d.enterpriseValue)}B
  P/E Trailing:        ${d.peTrailing != null ? fmt(d.peTrailing) + 'x' : 'N/D'}  |  P/E Forward: ${d.peForward != null ? fmt(d.peForward) + 'x' : 'N/D'}
  P/S Ratio:           ${d.psRatio != null ? fmt(d.psRatio) + 'x' : 'N/D'}  |  EV/EBITDA:   ${d.evEbitda != null ? fmt(d.evEbitda) + 'x' : 'N/D'}

FINANCIEROS (TTM):
  Revenue TTM:  US$${fmtB(d.revenueTTM)}B  |  EBITDA: ${d.ebitda != null ? 'US$' + fmtB(d.ebitda) + 'B' : 'N/D'}
  Margen Bruto: ${d.margenBruto != null ? fmt(d.margenBruto) + '%' : 'N/D'}  |  Margen Operativo: ${d.margenOperativo != null ? fmt(d.margenOperativo) + '%' : 'N/D'}  |  Margen Neto: ${d.margenNeto != null ? fmt(d.margenNeto) + '%' : 'N/D'}
  EPS Trailing: ${d.epsTrailing != null ? 'US$' + fmt(d.epsTrailing) : 'N/D'}   |  EPS Forward: ${d.epsForward != null ? 'US$' + fmt(d.epsForward) : 'N/D'}

BALANCE:
  Deuda Total: ${d.deudaTotal != null ? 'US$' + fmtB(d.deudaTotal) + 'B' : 'N/D'}  |  Caja: ${d.caja != null ? 'US$' + fmtB(d.caja) + 'B' : 'N/D'}  |  Acciones: ${d.acciones != null ? fmtM(d.acciones) + 'M' : 'N/D'}

HISTÓRICO ANUAL:
${d.historico.map(([y, r, g, n]) => `  - ${y}: Revenue=${r} | Gross Profit=${g} | Net Income=${n}`).join('\n')}

ANALISTAS (${d.numAnalistas} analistas):
  Consenso: ${d.consenso}
  Strong Buy:${d.strongBuy} | Buy:${d.buy} | Hold:${d.hold} | Sell:${d.sell} | Strong Sell:${d.strongSell}
  Precio objetivo: Medio=US$${d.precioObjetivoMedio != null ? fmt(d.precioObjetivoMedio) : 'N/D'} | Mediana=US$${d.precioObjetivoMediana != null ? fmt(d.precioObjetivoMediana) : 'N/D'} | Max=US$${d.precioObjetivoMax != null ? fmt(d.precioObjetivoMax) : 'N/D'} | Min=US$${d.precioObjetivoMin != null ? fmt(d.precioObjetivoMin) : 'N/D'}

DESCRIPCIÓN: ${d.descripcion}
===============================================================================`
}

// ── Batch financials fetch (with delay to avoid rate limiting) ────────────────
export async function fetchBatchFinancials(
  tickers: string[],
  batchSize = 12,
  delayMs = 1200,
): Promise<TickerFinancials[]> {
  const results: TickerFinancials[] = []
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map((t) => fetchTickerFinancials(t)),
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value)
    }
    if (i + batchSize < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return results
}

// ── Batch current-price fetch (uses same crumb auth) ─────────────────────────
export async function fetchLivePrices(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {}
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  const prices: Record<string, number> = {}
  try {
    let res: Response | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1) _crumbCache = null
      const { crumb, cookie } = await getYahooCrumb()
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(tickers.join(','))}&crumb=${encodeURIComponent(crumb)}`
      res = await fetch(url, {
        headers: { 'User-Agent': ua, Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        signal: AbortSignal.timeout(10000),
      })
      if (res.status !== 401) break
    }
    if (!res || !res.ok) return prices
    const data = await res.json()
    for (const quote of data?.quoteResponse?.result ?? []) {
      if (quote.symbol && typeof quote.regularMarketPrice === 'number') {
        prices[quote.symbol] = quote.regularMarketPrice
      }
    }
  } catch { /* return partial results on error */ }
  return prices
}
