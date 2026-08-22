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

// S&P 500 + NASDAQ 100 — universo large-cap (443 tickers únicos)
const SP500_NASDAQ100_TICKERS = [
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
  'EHC','MCK','ELV',
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
  'MELI','PDD','ASML','IDXX','FAST','MNST','KDP','MSTR','COIN',
  'DDOG','ZS','SNOW','SE','MELI',
]

// S&P 600 + Russell 2000 — universo small/mid-cap (307 tickers)
const SMALL_CAP_TICKERS = [
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
  'BCPC','HWKN','IOSP','KOP','NGVT','PRLB','TROX','MTUS','ASIX',
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
  'MRUS','NKTR','RXRX','TMDX',
  // ── Russell 2000 · Financials ────────────────────────────────────
  'CASS','CCRN','EIG','EZPW','GHLD','GLP','GPRE','GSBC','HASI',
  'HOPE','HRTG','JRVR','KFY','MLKN','ESSA','NRIM','FSBC','FBIZ',
  // ── Russell 2000 · Consumer ──────────────────────────────────────
  'CENT','FIZZ','FELE','GDEN','JBSS','LOVE','HOFT','LNDC',
  // ── Russell 2000 · Energy / Materials ────────────────────────────
  'CENX','GPRE','LBRT',
]

interface ScreenerOptions {
  peTrailing: number
  peForward: number
  debtRatio: number
  epsGrowth: number
  pegMax: number
  marketCapMin: number
  marketCapMax: number
}

const LARGE_CAP_OPTIONS: ScreenerOptions = {
  peTrailing: 25, peForward: 15, debtRatio: 0.35,
  epsGrowth: 0.15, pegMax: 2,
  marketCapMin: 5_000_000_000, marketCapMax: Infinity,
}

const SMALL_CAP_OPTIONS: ScreenerOptions = {
  peTrailing: 20, peForward: 18, debtRatio: 0.5,
  epsGrowth: 0.15, pegMax: 1.5,
  marketCapMin: 100_000_000, marketCapMax: 2_000_000_000,
}

let cache: { data: ScreenerResult[]; ts: number } | null = null
let cacheSmall: { data: ScreenerResult[]; ts: number } | null = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000  // 6 horas

async function fetchBatch(tickers: string[], opts: ScreenerOptions): Promise<ScreenerResult[]> {
  const yf = new YahooFinance()
  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const summary = await yf.quoteSummary(ticker, {
        modules: ['defaultKeyStatistics', 'financialData', 'price', 'summaryProfile', 'summaryDetail', 'incomeStatementHistory'],
      })

      const ks = summary.defaultKeyStatistics
      const fd = summary.financialData
      const pr = summary.price
      const sp = summary.summaryProfile
      const sd = summary.summaryDetail
      const incStmts = summary.incomeStatementHistory?.incomeStatementHistory as Array<{ netIncome?: number }> | undefined

      const trailingPE = (sd?.trailingPE as number | null | undefined)
        ?? (ks?.trailingPE as number | null | undefined) ?? null
      const forwardPE  = (sd?.forwardPE  as number | null | undefined)
        ?? (ks?.forwardPE  as number | null | undefined) ?? null
      const pegRatio   = (ks?.pegRatio   as number | null | undefined) ?? null

      let earningsGrowth: number | null = null
      if (incStmts && incStmts.length >= 2) {
        const latestNi = incStmts[0]?.netIncome ?? null
        const prevNi   = incStmts[1]?.netIncome ?? null
        if (latestNi != null && prevNi != null && prevNi !== 0) {
          earningsGrowth = (latestNi - prevNi) / Math.abs(prevNi)
        }
      }
      earningsGrowth ??= (fd?.earningsGrowth as number | null | undefined) ?? null

      const marketCap = (pr?.marketCap as number | null | undefined) ?? null
      const totalDebt = (fd?.totalDebt as number | null | undefined) ?? null
      const totalCash = (fd?.totalCash as number | null | undefined) ?? null
      const netDebt = totalDebt != null ? totalDebt - (totalCash ?? 0) : null
      const debtToEquity = netDebt != null && marketCap != null && marketCap > 0
        ? Math.max(0, netDebt) / marketCap
        : null
      const currentPrice = (pr?.regularMarketPrice as number | null | undefined) ?? null
      const name         = (pr?.longName   as string | undefined) ?? (pr?.shortName as string | undefined) ?? ticker
      const sector       = (sp?.sector     as string | undefined) ?? '—'

      const criteria = {
        pe_historico:    trailingPE    != null && trailingPE    > 0 && trailingPE    < opts.peTrailing,
        pe_proyectado:   forwardPE     != null && forwardPE     > 0 && forwardPE     < opts.peForward,
        deuda_capital:   debtToEquity  != null && debtToEquity  >= 0 && debtToEquity < opts.debtRatio,
        crecimiento_eps: earningsGrowth != null && earningsGrowth > opts.epsGrowth,
        peg:             pegRatio      != null && pegRatio      > 0 && pegRatio      < opts.pegMax,
        market_cap:      marketCap     != null && marketCap     >= opts.marketCapMin && marketCap <= opts.marketCapMax,
      }

      const score = Object.values(criteria).filter(Boolean).length

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
