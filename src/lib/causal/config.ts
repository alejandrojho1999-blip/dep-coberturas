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

export function buildCausalConfig(
  ticker: string,
  name: string,
  sector: string,
  treatment: string,
  horizon = 2,
): CausalConfig {
  const profile = SECTOR_PROFILES[sector] ?? DEFAULT_PROFILE
  const outcome = 'Future_Return'

  const dagEdges: DAGEdge[] = [
    // Macro confounders → treatment
    ...profile.confounders.map((c) => ({
      from: c,
      to: treatment,
      label: `${c} → ${treatment}`,
    })),
    // Treatment → outcome (direct causal path)
    { from: treatment, to: outcome, label: 'Señal causal directa' },
    // Macro confounders → outcome
    ...profile.confounders.map((c) => ({
      from: c,
      to: outcome,
      label: `${c} → retorno`,
    })),
    // Mediator path if present
    ...(profile.mediator
      ? [
          { from: treatment, to: profile.mediator, label: `${treatment} → ${profile.mediator}` },
          { from: profile.mediator, to: outcome, label: `${profile.mediator} → retorno` },
        ]
      : []),
  ]

  return {
    ticker,
    name,
    treatment,
    outcome,
    horizon,
    confounders: profile.confounders,
    excluded: profile.excluded,
    mediators: profile.mediator ? [profile.mediator] : undefined,
    dagEdges,
  }
}
