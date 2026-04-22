import type { CausalConfig, DAGEdge } from './types'

interface SectorProfile {
  confounders: string[]
  excluded: Record<string, string>
  mediator?: string
}

const SECTOR_PROFILES: Record<string, SectorProfile> = {
  Technology: {
    confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
    excluded: {
      PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
      PX_TO_BOOK_RATIO: 'Colisionador: precio de mercado causa ambos lados',
    },
    mediator: 'EPS_Growth',
  },
  Healthcare: {
    confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
    excluded: {
      PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
      PX_TO_BOOK_RATIO: 'Colisionador: precio de mercado causa ambos lados',
    },
    mediator: 'EPS_Growth',
  },
  'Basic Materials': {
    confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
    excluded: {
      PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
      EV_EBITDA: 'Colisionador: múltiplo de mercado endógeno al precio',
    },
  },
  Energy: {
    confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
    excluded: {
      PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
      PX_TO_BOOK_RATIO: 'Colisionador: precio de mercado causa ambos lados',
    },
  },
  'Financial Services': {
    confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
    excluded: {
      PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
      BOOK_VALUE: 'Colisionador: se ve afectado por precio de mercado',
    },
  },
  Financials: {
    confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
    excluded: {
      PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
      BOOK_VALUE: 'Colisionador: se ve afectado por precio de mercado',
    },
  },
}

const DEFAULT_PROFILE: SectorProfile = {
  confounders: ['YIELD_10Y', 'FED_RATE', 'VIX'],
  excluded: {
    PE_RATIO: 'Colisionador: precio de mercado causa PE_RATIO y retorno futuro',
    PX_TO_BOOK_RATIO: 'Colisionador: precio de mercado causa ambos lados',
  },
}

// Treatment and confounders use variables available in the merged FRED+Yahoo dataset.
// Sector-specific fundamental treatments (RND_Growth, AISC_Change, etc.) require
// a financial fundamentals data source not yet implemented — FED_RATE is used as
// the macro treatment proxy that is always present.
const AVAILABLE_TREATMENT = 'FED_RATE'
const AVAILABLE_CONFOUNDERS = ['YIELD_10Y', 'VIX']

export function buildCausalConfig(
  ticker: string,
  name: string,
  sector: string,
  _treatment: string,
  horizon = 2,
): CausalConfig {
  const profile = SECTOR_PROFILES[sector] ?? DEFAULT_PROFILE
  const treatment = AVAILABLE_TREATMENT
  const confounders = AVAILABLE_CONFOUNDERS
  const outcome = 'FutureReturn'

  const dagEdges: DAGEdge[] = [
    // Macro confounders → treatment
    ...confounders.map((c) => ({
      from: c,
      to: treatment,
      label: `${c} → ${treatment}`,
    })),
    // Treatment → outcome (direct causal path)
    { from: treatment, to: outcome, label: 'Política monetaria → retorno futuro' },
    // Macro confounders → outcome
    ...confounders.map((c) => ({
      from: c,
      to: outcome,
      label: `${c} → retorno`,
    })),
  ]

  return {
    ticker,
    name,
    treatment,
    outcome,
    horizon,
    confounders,
    excluded: profile.excluded,
    dagEdges,
  }
}
