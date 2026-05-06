import YahooFinance from 'yahoo-finance2'
import type { MarketData, HistorialIngreso, HistorialPrecio, HistorialFCF } from './types'

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return 'N/D'
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(decimals)}B`
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(decimals)}M`
  return n.toFixed(decimals)
}

function pct(n: number | null | undefined): string {
  if (n == null) return 'N/D'
  return `${(n * 100).toFixed(2)}%`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

function calcDcf(fcf: number | null, growthRate: number): number | null {
  if (fcf == null || fcf <= 0) return null
  const wacc = 0.10
  const terminalGrowth = 0.03
  const years = 5
  let dcfVal = 0
  let projected = fcf
  for (let y = 1; y <= years; y++) {
    projected *= (1 + Math.min(growthRate, 0.40))
    dcfVal += projected / Math.pow(1 + wacc, y)
  }
  const terminalValue = (projected * (1 + terminalGrowth)) / (wacc - terminalGrowth)
  dcfVal += terminalValue / Math.pow(1 + wacc, years)
  return dcfVal
}

export async function fetchMarketData(ticker: string): Promise<MarketData> {
  const yf = new YahooFinance()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchOptions = { signal: AbortSignal.timeout(20_000) } as any
  const [quote, summary, historico] = await Promise.all([
    yf.quote(ticker, {}, fetchOptions) as Promise<AnyRecord>,
    (async (): Promise<AnyRecord | null> => {
      try {
        return await (yf.quoteSummary(ticker, {
          modules: [
            'summaryProfile',
            'financialData',
            'defaultKeyStatistics',
            'incomeStatementHistory',
            'cashflowStatementHistory',
            'price',
            'recommendationTrend',
            'assetProfile',
          ],
        }, fetchOptions) as Promise<AnyRecord>)
      } catch { return null }
    })(),
    (async (): Promise<AnyRecord[]> => {
      try {
        const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        return await (yf.historical(ticker, {
          period1: from,
          period2: new Date(),
          interval: '1d',
        }) as unknown as Promise<AnyRecord[]>)
      } catch { return [] }
    })(),
  ])

  const profile    = (summary?.summaryProfile ?? summary?.assetProfile ?? {}) as AnyRecord
  const financial  = (summary?.financialData ?? {}) as AnyRecord
  const keyStats   = (summary?.defaultKeyStatistics ?? {}) as AnyRecord
  const incomeList = (summary?.incomeStatementHistory?.incomeStatementHistory ?? []) as AnyRecord[]
  const recTrend   = (summary?.recommendationTrend?.trend ?? []) as AnyRecord[]
  const cashflows  = (summary?.cashflowStatementHistory?.cashflowStatements ?? []) as AnyRecord[]
  const latestRec  = recTrend[0] ?? {}

  const historial: HistorialIngreso[] = incomeList.slice(0, 3).map((s) => {
    const _gp  = (s.grossProfit   as number | null) ?? null
    const _rev = (s.totalRevenue  as number | null) ?? null
    const _cog = (s.costOfRevenue as number | null) ?? null
    return {
      año:          new Date(s.endDate as string | number).getFullYear(),
      revenue:      _rev,
      gross_profit: (_gp !== null && _gp !== 0) ? _gp : (_rev !== null && _cog !== null) ? _rev - _cog : _gp,
      net_income:   (s.netIncome as number | null) ?? null,
    }
  })

  // Revenue growth rate from historial (CAGR over available years)
  let revenueGrowthRate = 0.08 // default 8%
  if (historial.length >= 2) {
    const newest = historial[0]?.revenue
    const oldest = historial[historial.length - 1]?.revenue
    if (newest != null && oldest != null && oldest > 0) {
      const years = historial.length - 1
      revenueGrowthRate = Math.pow(newest / oldest, 1 / years) - 1
    }
  }

  // FCF history from cash flow statements
  const fcfHistory: HistorialFCF[] = cashflows.slice(0, 3).map((c) => {
    const cfo   = (c.totalCashFromOperatingActivities as number | null) ?? null
    const capex = (c.capitalExpenditures as number | null) ?? null
    // Yahoo stores capex as negative; FCF = CFO + capex (which subtracts it)
    const fcf   = (cfo != null && capex != null) ? cfo + capex : cfo
    return {
      año:   new Date(c.endDate as string | number).getFullYear(),
      cfo,
      capex,
      fcf,
    }
  })

  // Latest FCF: prefer cashflow statement, then Yahoo's financialData.freeCashflow
  const latestFcf = fcfHistory[0]?.fcf ?? (financial.freeCashflow as number | null) ?? null

  // DCF valuation
  const dcfValue = calcDcf(latestFcf, revenueGrowthRate)

  // Margen bruto: Yahoo's grossMargins (decimal) with fallback from historial
  const latestYear = historial[0]
  const calculatedMargen = (
    latestYear?.gross_profit != null && latestYear?.revenue != null && latestYear.revenue !== 0
  ) ? latestYear.gross_profit / latestYear.revenue : null

  const historialPrecios: HistorialPrecio[] = historico.map((h) => ({
    fecha:  (h.date as Date).toISOString().split('T')[0],
    cierre: (h.close as number) ?? 0,
  })).filter((h) => h.cierre > 0)

  return {
    ticker:            (quote.symbol as string)   ?? ticker.toUpperCase(),
    empresa:           (quote.longName as string)  ?? (quote.shortName as string) ?? ticker.toUpperCase(),
    bolsa:             (quote.fullExchangeName as string) ?? (quote.exchange as string) ?? 'N/D',
    precio_actual:     (quote.regularMarketPrice as number | null) ?? null,
    precio_52w_alto:   (quote.fiftyTwoWeekHigh as number | null)  ?? null,
    precio_52w_bajo:   (quote.fiftyTwoWeekLow as number | null)   ?? null,
    market_cap:        (quote.marketCap as number | null) ?? null,
    beta:              (keyStats.beta as number | null) ?? null,
    shares_outstanding:(keyStats.sharesOutstanding as number | null) ?? null,
    moneda:            (quote.currency as string | null) ?? null,
    sector:            (profile.sector as string | null) ?? null,
    industria:         (profile.industry as string | null) ?? null,
    descripcion:       (profile.longBusinessSummary as string | null) ?? null,
    pe_ratio:          (quote.trailingPE as number | null) ?? null,
    ps_ratio:          (keyStats.priceToSalesTrailing12Months as number | null) ?? null,
    ev_ebitda:         (keyStats.enterpriseToEbitda as number | null) ?? null,
    margen_bruto:      (financial.grossMargins as number | null) ?? calculatedMargen,
    margen_neto:       (financial.profitMargins as number | null) ?? null,
    margen_operacional:(financial.operatingMargins as number | null) ?? null,
    eps:               (keyStats.trailingEps as number | null) ?? null,
    deuda_total:       (financial.totalDebt as number | null) ?? null,
    caja_total:        (financial.totalCash as number | null) ?? null,
    precio_objetivo:   (financial.targetMeanPrice as number | null) ?? null,
    recomendacion:     (financial.recommendationKey as string | null) ?? null,
    strong_buy:  (latestRec.strongBuy  as number) ?? 0,
    buy:         (latestRec.buy        as number) ?? 0,
    hold:        (latestRec.hold       as number) ?? 0,
    sell:        (latestRec.sell       as number) ?? 0,
    strong_sell: (latestRec.strongSell as number) ?? 0,
    historial_ingresos: historial,
    historial_precios:  historialPrecios,
    free_cashflow:     latestFcf,
    fcf_history:       fcfHistory,
    dcf_value:         dcfValue,
    revenue_growth_rate: revenueGrowthRate,
  }
}

export function buildDataContext(md: MarketData): string {
  const totalAnalistas = md.strong_buy + md.buy + md.hold + md.sell + md.strong_sell
  const cur = md.moneda ?? 'USD'

  const fcfLines = md.fcf_history.length > 0
    ? md.fcf_history.map(
        (f) => `  ${f.año}: CFO=${fmt(f.cfo)} | CapEx=${fmt(f.capex)} | FCF Libre=${fmt(f.fcf)}`
      )
    : ['  No disponible']

  const sharesM = md.shares_outstanding != null ? md.shares_outstanding / 1e6 : null
  const dcfPerShare = (md.dcf_value != null && sharesM != null && sharesM > 0)
    ? md.dcf_value / (sharesM * 1e6)
    : null

  const lines = [
    `EMPRESA: ${md.empresa}`,
    `TICKER: ${md.ticker}`,
    `BOLSA: ${md.bolsa}`,
    `MONEDA: ${cur}`,
    `SECTOR: ${md.sector ?? 'N/D'}`,
    `INDUSTRIA: ${md.industria ?? 'N/D'}`,
    '',
    'PRECIO Y RANGO:',
    `  Precio Actual: ${md.precio_actual != null ? `${cur} ${md.precio_actual.toFixed(2)}` : 'N/D'}`,
    `  52w Máximo: ${md.precio_52w_alto != null ? `${cur} ${md.precio_52w_alto.toFixed(2)}` : 'N/D'}`,
    `  52w Mínimo: ${md.precio_52w_bajo != null ? `${cur} ${md.precio_52w_bajo.toFixed(2)}` : 'N/D'}`,
    `  Market Cap: ${fmt(md.market_cap)}`,
    `  Acciones en Circulación: ${fmt(md.shares_outstanding)}`,
    `  Beta: ${md.beta?.toFixed(2) ?? 'N/D'}`,
    '',
    'VALORACIÓN:',
    `  P/E (TTM): ${md.pe_ratio?.toFixed(2) ?? 'N/D'}`,
    `  P/S (TTM): ${md.ps_ratio?.toFixed(2) ?? 'N/D'}`,
    `  EV/EBITDA: ${md.ev_ebitda?.toFixed(2) ?? 'N/D'}`,
    '',
    'FINANCIEROS (TTM):',
    `  Margen Bruto: ${pct(md.margen_bruto)}`,
    `  Margen Neto: ${pct(md.margen_neto)}`,
    `  Margen Operacional: ${pct(md.margen_operacional)}`,
    `  EPS: ${md.eps?.toFixed(2) ?? 'N/D'}`,
    '',
    'BALANCE:',
    `  Deuda Total: ${fmt(md.deuda_total)}`,
    `  Caja y Equivalentes: ${fmt(md.caja_total)}`,
    '',
    'HISTÓRICO ANUAL DE INGRESOS:',
    ...md.historial_ingresos.map(
      (h) =>
        `  ${h.año}: Revenue=${fmt(h.revenue)} | Gross Profit=${fmt(h.gross_profit)} | Net Income=${fmt(h.net_income)}`
    ),
    '',
    'FLUJO DE CAJA LIBRE (FCF):',
    `  FCF TTM/Último: ${fmt(md.free_cashflow)}`,
    ...fcfLines,
    ...(dcfPerShare != null ? [`  DCF Estimado por Acción (WACC 10%, g terminal 3%, CAGR ingresos ${(md.revenue_growth_rate! * 100).toFixed(1)}%): ${cur} ${dcfPerShare.toFixed(2)}`] : []),
    '',
    'ANALISTAS:',
    `  Precio Objetivo Consenso: ${md.precio_objetivo != null ? `${cur} ${md.precio_objetivo.toFixed(2)}` : 'N/D'}`,
    `  Recomendación: ${md.recomendacion?.toUpperCase() ?? 'N/D'}`,
    `  Strong Buy: ${md.strong_buy} | Buy: ${md.buy} | Hold: ${md.hold} | Sell: ${md.sell} | Strong Sell: ${md.strong_sell} (total: ${totalAnalistas})`,
    '',
    'DESCRIPCIÓN DEL NEGOCIO:',
    md.descripcion ? md.descripcion.slice(0, 2000) : 'N/D',
  ]

  return lines.join('\n')
}
