export const DAG_CONFIGS = {
  tech_stock:         { treatment: 'NASDAQ_Return',      confounders: ['REAL_YIELD_CHANGE', 'DXY_Change', 'VIX'],                           excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  bank_stock:         { treatment: 'YIELD_CURVE_SLOPE',  confounders: ['CREDIT_SPREAD', 'FED_RATE', 'VIX'],                                 excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  energy_stock:       { treatment: 'OilPrice_Change',    confounders: ['DXY_Change', 'NatGas_Change', 'VIX'],                               excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  mining_stock:       { treatment: 'GoldPrice_Change',   confounders: ['DXY_Change', 'REAL_YIELD_CHANGE', 'VIX'],                           excluded: ['PE_RATIO', 'PX_TO_BOOK'],           lag_periods: 1, frequency: 'Q' },
  mining_base_metals: { treatment: 'CopperPrice_Chg',    confounders: ['DXY_Change', 'INDPRO', 'CHINA_PMI_MFG', 'VIX'],                    excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  consumer_stock:     { treatment: 'RETAIL_SALES',       confounders: ['UNEMPLOYMENT', 'CPI_YoY', 'SP500_Return'],                          excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  auto_stock:         { treatment: 'RETAIL_SALES',       confounders: ['OilPrice_Change', 'UNEMPLOYMENT', 'VIX'],                           excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  pharma_stock:       { treatment: 'SP500_Return',       confounders: ['NASDAQ_Return', 'VIX', 'DXY_Change'],                               excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  utility_stock:      { treatment: 'YIELD_10Y_Change',   confounders: ['NatGas_Change', 'FED_RATE', 'VIX'],                                 excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  reit:               { treatment: 'YIELD_10Y_Change',   confounders: ['CPI_YoY', 'FED_RATE', 'VIX'],                                       excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  equity_etf:         { treatment: 'MARKET_RETURN',      confounders: ['YIELD_10Y', 'DXY_Change', 'VIX'],                                   excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  fixed_income_etf:   { treatment: 'YIELD_10Y_Change',   confounders: ['CREDIT_SPREAD', 'FED_RATE', 'CPI_YoY'],                             excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  em_equity:          { treatment: 'DXY_Change',         confounders: ['SP500_Return', 'CopperPrice_Chg', 'VIX'],                           excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  commodity_oil:      { treatment: 'DXY_Change',         confounders: ['YIELD_10Y', 'FED_RATE', 'VIX', 'GoldPrice_Change'],                 excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
  commodity_gold:     { treatment: 'REAL_YIELD_CHANGE',  confounders: ['DXY_Change', 'VIX', 'CPI_YoY', 'SP500_Return', 'CREDIT_SPREAD'],   excluded: ['GC=F', 'YIELD_10Y', 'PE_RATIO'],   lag_periods: 1, frequency: 'M' },
  default:            { treatment: 'SP500_Return',       confounders: ['VIX', 'DXY_Change', 'T10Y2Y', 'FEDFUNDS'],                          excluded: [] as string[],                       lag_periods: 1, frequency: 'M' },
} as const

export type SectorKey = keyof typeof DAG_CONFIGS

export interface TreatmentSuggestion {
  variable: string
  sectors: string[]
  label: string
}

const TREATMENT_LABELS: Record<string, string> = {
  NASDAQ_Return:      'Retorno NASDAQ — impulso tech',
  YIELD_CURVE_SLOPE:  'Pendiente curva de rendimiento',
  OilPrice_Change:    'Variación precio del petróleo',
  GoldPrice_Change:   'Variación precio del oro',
  CopperPrice_Chg:    'Variación precio del cobre',
  RETAIL_SALES:       'Ventas minoristas EEUU',
  SP500_Return:       'Retorno S&P 500',
  YIELD_10Y_Change:   'Cambio tasa bono 10Y',
  MARKET_RETURN:      'Retorno de mercado amplio',
  DXY_Change:         'Variación índice dólar DXY',
  REAL_YIELD_CHANGE:  'Cambio rendimiento real TIPS',
}

export function getUniqueTreatments(): TreatmentSuggestion[] {
  const map = new Map<string, string[]>()
  for (const [sector, cfg] of Object.entries(DAG_CONFIGS)) {
    const t = cfg.treatment as string
    if (!map.has(t)) map.set(t, [])
    map.get(t)!.push(sector)
  }
  return Array.from(map.entries()).map(([variable, sectors]) => ({
    variable,
    sectors,
    label: TREATMENT_LABELS[variable] ?? variable,
  }))
}

export function getSectorConfig(sector: string) {
  const key = sector.toLowerCase().replace(/[\s-]+/g, '_') as SectorKey
  return DAG_CONFIGS[key] ?? DAG_CONFIGS.default
}
