import YahooFinance from 'yahoo-finance2'

export interface ScreenerResult {
  ticker: string
  name: string
  sector: string
  price: number | null
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

// S&P 500 + NASDAQ 100 — universo large-cap (443 tickers)
export const SP500_NASDAQ100_TICKERS = [
  // Mega-cap tech / NASDAQ 100 core
  'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','AVGO','ORCL',
  'CRM','ADBE','AMD','QCOM','TXN','INTC','MU','LRCX','KLAC','AMAT',
  'ADI','MRVL','ON','MCHP','FTNT','CDNS','SNPS','ANSS','NFLX','CSCO',
  'IBM','NOW','PANW','CRWD','DDOG','ZS','SNOW','PLTR','NET','TEAM',
  'OKTA','HUBS','VEEV','WDAY','PAYC','PAYX','ADP','FIS','FISV','GPN',
  'CTSH','ACN','HPQ','HPE','STX','WDC','NTAP','ANET','ZBRA','CDW',
  'AKAM','GDDY','GEN','FFIV','JKHY','LDOS','KEYS','TER','EPAM',
  // Communication Services
  'DIS','CMCSA','T','VZ','TMUS','CHTR','PARA','WBD','FOX','FOXA',
  'NWSA','NWS','TTWO','EA','LYV','OMC','IPG','MTCH','IAC',
  // Consumer Discretionary
  'HD','MCD','NKE','SBUX','LOW','TJX','BKNG','MAR','HLT','YUM',
  'CMG','DHI','LEN','PHM','NVR','ROST','TGT','WMT','COST','DG',
  'DLTR','BBY','KMX','AN','ORLY','AZO','APTV','GM','F','ABNB',
  'UBER','EXPE','ETSY','EBAY','RCL','CCL','NCLH','LVS','WYNN','MGM',
  'HAS','MAT','POOL','TSCO','ULTA','GPC','LKQ','BWA','LEA',
  // Consumer Staples
  'PG','KO','PEP','MDLZ','KHC','GIS','CAG','SJM','HRL','CPB',
  'MKC','CL','CHD','CLX','EL','KMB','PM','MO','STZ','TAP',
  'WBA','CVS','MCK','ABC','CAH','SYY','KR','COTY',
  // Healthcare
  'UNH','LLY','JNJ','ABT','TMO','DHR','MRK','ABBV','BMY','PFE',
  'AMGN','GILD','BIIB','VRTX','REGN','MRNA','ZTS','IDXX','EW','STE',
  'BAX','BDX','BSX','SYK','MDT','HOLX','ALGN','RMD','ISRG','DXCM',
  'PODD','CI','HUM','CNC','MOH','HCA','UHS','INCY','ALNY','BMRN',
  'EXAS','ILMN','IQV','CRL','TECH','HSIC','LH','DGX','RVTY','GEHC',
  'EHC','ELV',
  // Financials
  'BRK-B','JPM','BAC','WFC','C','GS','MS','BLK','SCHW','AXP',
  'V','MA','COF','DFS','SYF','AIG','PRU','MET','AFL','ALL',
  'PGR','TRV','CB','MMC','AON','MSCI','ICE','CME','NDAQ','CBOE',
  'BX','KKR','APO','BEN','IVZ','TROW','STT','BK','NTRS','RF',
  'HBAN','KEY','CFG','FITB','ZION','MTB','PNC','USB','TFC',
  'WAL','CMA','HWC','SNV','WTFC','BOKF','FFIN',
  // Industrials
  'HON','UNP','RTX','CAT','DE','GE','MMM','LMT','NOC','GD',
  'BA','EMR','ETN','ROK','PH','ITW','DOV','FTV','AME','XYL',
  'CARR','OTIS','TT','JCI','ALLE','SWK','SNA','GWW','AOS','IR',
  'TDG','HEI','TDY','CW','SAIC','BAH','CHRW','XPO','UPS','FDX',
  'JBHT','WERN','CSX','NSC','ODFL','RHI','CPRT','VRSK','CSGP',
  'EXPD','BWXT','HII','LHX','TXT','AXON','WM','RSG','SRCL','CTAS',
  // Energy
  'XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','OXY','DVN',
  'PXD','HAL','BKR','KMI','WMB','OKE','LNG','HES','APA','MRO',
  'NOV','FANG','CTRA',
  // Utilities
  'NEE','DUK','SO','D','AEP','EXC','SRE','ES','ED','XEL',
  'AWK','PEG','EIX','ETR','CNP','PPL','AES','NI','LNT','WEC',
  'DTE','CMS','ATO','EVRG','ENPH','FSLR',
  // Real Estate
  'AMT','PLD','CCI','EQIX','PSA','WELL','O','SPG','DLR','AVB',
  'EQR','VTR','BXP','KIM','REG','WY','ELS','SUI','MAA','CPT',
  'NNN','VICI','GLPI','SBAC','IRM',
  // Materials
  'LIN','APD','ECL','SHW','FCX','NEM','NUE','STLD','RS','VMC',
  'MLM','PPG','RPM','CE','DD','DOW','LYB','EMN','ALB','FMC',
  'IFF','PKG','IP','WRK','CF','MOS','NTR','SEE',
  // NASDAQ 100 adicionales
  'MELI','PDD','ASML','FAST','MNST','KDP','MSTR','COIN',
  'SE',
]

// S&P 600 + Russell 2000 — universo small/mid-cap (307 tickers)
export const SMALL_CAP_TICKERS = [
  // ── S&P 600 · Technology ─────────────────────────────────────────
  'QLYS','TNET','BL','SPSC','CEVA','DIOD','POWI','SMTC','SLAB','OSIS',
  'VIAV','HLIT','CRUS','CALX','CCOI','NSIT','ICFI','EXPO','KFRC','MMS',
  'PRFT','FORR','CSGS','NCNO','NOVT','RBBN','JAMF','ALKT','CLFD','COHU',
  'ACMR','MTSI','FORM','LSPD','TASK','MCBC','CSWI',
  // ── S&P 600 · Industrials ────────────────────────────────────────
  'POWL','MTRN','KTOS','AVAV','TREX','ESNT','ROCK','ITRI','GMS','CVCO',
  'AIN','HXL','BCPC','WMS','STRL','IBP','HURN','AIMC','ACCO','ARCB',
  'NARI','PGNY','MGRC','MRCY','UFPT','SAIA','PRMW','HLIO','CECO','NNBR',
  'LYTS','NRC','SPXC','TISI','BMI','VRRM','REVG','SMRT','ARIS',
  // ── S&P 600 · Healthcare ─────────────────────────────────────────
  'ACAD','INVA','HALO','SEM','ASGN','AMSF','LMAT','MLAB','MMSI','OMCL',
  'PRCT','CUTR','CERT','EVBG','INSP','IRTC','PCRX','TGTX','XRAY','PDCO',
  'PACB','ICAD','LNTH','MGLN','NEOG','NKTR','PNTG','PRVA','SDGR','TMDX',
  'AXNX','NVCR','NVST','MDGL','MNMD','SGMO',
  // ── S&P 600 · Financials ─────────────────────────────────────────
  'CATY','CVBF','EFSC','FCF','FFBC','FULT','HBT','HTLF','IBOC','INDB',
  'LKFN','RNST','SFBS','STBA','WAFD','WSBC','WSFS','SEIC','PRAA','BSVN',
  'CBAN','CCBG','CHCO','FBMS','FFIN','FMBH','GBCI','HWC','HTBK','INBK',
  'NBTB','NWBI','PFBC','PEBO','SRCE','TCBK','TOWN','TRMK','UMBF',
  // ── S&P 600 · Consumer Discretionary ────────────────────────────
  'BOOT','CAKE','CHUY','DIN','JACK','MNRO','MUSA','THO','WGO','PLCE',
  'SBH','HIBB','GSHD','UFPI','KRUS','FNKO','VSCO','WRLD','CONN','LCUT',
  'HAYW','EVGO','SFIX','LGND','FRPT','CLAR',
  // ── S&P 600 · Energy ─────────────────────────────────────────────
  'MGY','MTDR','REX','SM','TALO','VAALCO','SBOW','STNG','CIVI','NOG',
  'OII','RES','WHD','DINO','NGL','BATL','SND',
  // ── S&P 600 · Materials ──────────────────────────────────────────
  'HWKN','IOSP','KOP','NGVT','PRLB','TROX','MTUS','ASIX',
  'RYAM','SLCA','SXT','TREC','WOR','SUL',
  // ── S&P 600 · Consumer Staples ───────────────────────────────────
  'JJSF','MGPI','POST','SMPL','TWNK','UNFI','CHEF','OLLI','LANC','BGS',
  'NATR','VITL','NRDS','MAMA',
  // ── S&P 600 · Utilities ──────────────────────────────────────────
  'MGEE','ARTNA','MSEX','SJW','YORW','AWR','CWCO',
  // ── Russell 2000 · Technology ────────────────────────────────────
  'CRSR','DFIN','EVTC','EXTR','FLGT','HIMX','INMD','MODN','NOVA',
  'OPFI','OSUR','HCKT','CCSI','CNXN','IMXI','LQDT','DOMO',
  // ── Russell 2000 · Industrials ───────────────────────────────────
  'APOG','ASTE','CMCO','CNMD','CVLG','EPAC','ESE','GLDD','GEF',
  'HEES','IES','JELD','JOUT','KMT','LBRT','LCII','MATX','MRTN',
  'ORN','OTTR','HTLD','HAYN','DLTH',
  // ── Russell 2000 · Healthcare ────────────────────────────────────
  'CORT','DVAX','EYE','HRMY','IART','MNKD','HCAT','HROW','KRYS',
  'MRUS','RXRX',
  // ── Russell 2000 · Financials ────────────────────────────────────
  'CASS','CCRN','EIG','EZPW','GHLD','GLP','GPRE','GSBC','HASI',
  'HOPE','HRTG','JRVR','KFY','MLKN','ESSA','NRIM','FSBC','FBIZ',
  // ── Russell 2000 · Consumer ──────────────────────────────────────
  'CENT','FIZZ','FELE','GDEN','JBSS','LOVE','HOFT','LNDC',
  // ── Russell 2000 · Energy / Materials ────────────────────────────
  'CENX',
]

export interface ScreenerOptions {
  peTrailing: number
  peForward: number
  debtRatio: number
  epsGrowth: number
  pegMax: number
  marketCapMin: number
  marketCapMax: number
}

export const LARGE_CAP_OPTIONS: ScreenerOptions = {
  peTrailing: 25, peForward: 15, debtRatio: 0.35,
  epsGrowth: 0.15, pegMax: 2,
  marketCapMin: 5_000_000_000, marketCapMax: Infinity,
}

export const SMALL_CAP_OPTIONS: ScreenerOptions = {
  peTrailing: 20, peForward: 18, debtRatio: 0.5,
  epsGrowth: 0.15, pegMax: 1.5,
  marketCapMin: 100_000_000, marketCapMax: 2_000_000_000,
}

/**
 * Entrada mínima para evaluar los 6 criterios de Lynch, ya calculada.
 * El screener en vivo la construye desde Yahoo `quoteSummary`; el motor de
 * backtest (`src/lib/backtest/engine.ts`) la construye desde el panel
 * point-in-time. Ambos comparten `evaluarCriterios` para que no puedan
 * divergir.
 */
export interface ScreenerFeatures {
  trailingPE: number | null
  forwardPE: number | null
  debtToEquity: number | null
  earningsGrowth: number | null
  pegRatio: number | null
  marketCap: number | null
}

export type ScreenerCriteria = ScreenerResult['criteria']

/** Los 6 criterios booleanos de Lynch. Fuente única de verdad de los umbrales. */
export function evaluarCriterios(f: ScreenerFeatures, opts: ScreenerOptions): ScreenerCriteria {
  return {
    pe_historico:    f.trailingPE     != null && f.trailingPE     > 0 && f.trailingPE     < opts.peTrailing,
    pe_proyectado:   f.forwardPE      != null && f.forwardPE      > 0 && f.forwardPE      < opts.peForward,
    deuda_capital:   f.debtToEquity   != null && f.debtToEquity   >= 0 && f.debtToEquity  < opts.debtRatio,
    crecimiento_eps: f.earningsGrowth != null && f.earningsGrowth > opts.epsGrowth,
    peg:             f.pegRatio       != null && f.pegRatio       > 0 && f.pegRatio       < opts.pegMax,
    market_cap:      f.marketCap      != null && f.marketCap      >= opts.marketCapMin && f.marketCap <= opts.marketCapMax,
  }
}

/** Nº de criterios cumplidos (0-6). Empatado con el `score` del screener. */
export function contarScore(criteria: ScreenerCriteria): number {
  return Object.values(criteria).filter(Boolean).length
}

/** Deuda neta sobre capitalización, acotada a 0 por abajo. */
export function calcDebtToMarketCap(
  totalDebt: number | null,
  totalCash: number | null,
  marketCap: number | null,
): number | null {
  if (totalDebt == null) return null
  const netDebt = totalDebt - (totalCash ?? 0)
  if (marketCap == null || marketCap <= 0) return null
  return Math.max(0, netDebt) / marketCap
}

let cache: { data: ScreenerResult[]; ts: number } | null = null
let cacheSmall: { data: ScreenerResult[]; ts: number } | null = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000  // 6 horas

/** Primer ejercicio que se pide a Yahoo; solo hacen falta los dos últimos. */
const FUNDAMENTALS_DESDE = '2018-01-01'

/**
 * Crecimiento del beneficio entre los dos últimos ejercicios de una serie
 * ordenada de más antiguo a más reciente. `null` si no hay dos cifras válidas.
 */
export function crecimientoAnual(netIncomes: number[]): number | null {
  if (netIncomes.length < 2) return null
  const previo = netIncomes[netIncomes.length - 2]
  const actual = netIncomes[netIncomes.length - 1]
  if (previo === 0) return null
  return (actual - previo) / Math.abs(previo)
}

async function fetchBatch(tickers: string[], opts: ScreenerOptions): Promise<ScreenerResult[]> {
  const yf = new YahooFinance()
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      // `incomeStatementHistory` viene vacío para muchos valores desde nov-2024
      // (el propio yahoo-finance2 lo avisa por consola). `fundamentalsTimeSeries`
      // es el reemplazo que sí devuelve la serie de resultados.
      const [summary, financials] = await Promise.all([
        yf.quoteSummary(ticker, {
          modules: ['defaultKeyStatistics', 'financialData', 'price', 'summaryProfile', 'summaryDetail'],
        }),
        yf.fundamentalsTimeSeries(ticker, {
          period1: FUNDAMENTALS_DESDE, type: 'annual', module: 'financials',
        }).catch(() => [] as Array<Record<string, unknown>>),
      ])

      const ks = summary.defaultKeyStatistics
      const fd = summary.financialData
      const pr = summary.price
      const sp = summary.summaryProfile
      const sd = summary.summaryDetail

      const trailingPE = (sd?.trailingPE as number | null | undefined)
        ?? (ks?.trailingPE as number | null | undefined) ?? null
      const forwardPE  = (sd?.forwardPE  as number | null | undefined)
        ?? (ks?.forwardPE  as number | null | undefined) ?? null
      const pegRatio   = (ks?.pegRatio   as number | null | undefined) ?? null

      // `fundamentalsTimeSeries` devuelve los ejercicios de más antiguo a más
      // reciente, al revés que el difunto `incomeStatementHistory`.
      const netIncomes = (financials as Array<Record<string, unknown>>)
        .map(r => r.netIncome)
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

      let earningsGrowth = crecimientoAnual(netIncomes)
      earningsGrowth ??= (fd?.earningsGrowth as number | null | undefined) ?? null

      const marketCap = (pr?.marketCap as number | null | undefined) ?? null
      const totalDebt = (fd?.totalDebt as number | null | undefined) ?? null
      const totalCash = (fd?.totalCash as number | null | undefined) ?? null
      const debtToEquity = calcDebtToMarketCap(totalDebt, totalCash, marketCap)
      const currentPrice = (pr?.regularMarketPrice as number | null | undefined) ?? null
      const name         = (pr?.longName   as string | undefined) ?? (pr?.shortName as string | undefined) ?? ticker
      const sector       = (sp?.sector     as string | undefined) ?? '—'

      const criteria = evaluarCriterios(
        { trailingPE, forwardPE, debtToEquity, earningsGrowth, pegRatio, marketCap },
        opts,
      )

      const score = contarScore(criteria)

      return {
        ticker,
        name,
        sector,
        price: currentPrice,
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

export async function runScreener(
  forceRefresh = false,
  universe: 'large_cap' | 'small_cap' = 'large_cap'
): Promise<ScreenerResult[]> {
  const activeCache = universe === 'small_cap' ? cacheSmall : cache
  const opts        = universe === 'small_cap' ? SMALL_CAP_OPTIONS : LARGE_CAP_OPTIONS
  const tickerList  = [...new Set(universe === 'small_cap' ? SMALL_CAP_TICKERS : SP500_NASDAQ100_TICKERS)]

  if (!forceRefresh && activeCache && Date.now() - activeCache.ts < CACHE_TTL_MS) return activeCache.data

  const BATCH_SIZE = 25
  const all: ScreenerResult[] = []

  for (let i = 0; i < tickerList.length; i += BATCH_SIZE) {
    const batch = tickerList.slice(i, i + BATCH_SIZE)
    const batchResults = await fetchBatch(batch, opts)
    all.push(...batchResults)
  }

  const sorted = all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (b.market_cap ?? 0) - (a.market_cap ?? 0)
  })

  if (universe === 'small_cap') cacheSmall = { data: sorted, ts: Date.now() }
  else cache = { data: sorted, ts: Date.now() }

  return sorted
}
