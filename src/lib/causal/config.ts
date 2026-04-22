import type { CausalConfig, DAGEdge } from './types'

// Treatment and confounders use variables available in the merged FRED+Yahoo dataset.
// Sector-specific fundamental treatments (RND_Growth, AISC_Change, etc.) require
// a financial fundamentals data source not yet implemented — FED_RATE is used as
// the macro treatment proxy that is always present.
const AVAILABLE_TREATMENT = 'FED_RATE'
const AVAILABLE_CONFOUNDERS = ['YIELD_10Y', 'VIX']

export function buildCausalConfig(
  ticker: string,
  name: string,
  _sector: string,
  _treatment: string,
  confounders?: string[],
  colliders?: Record<string, string>,
  horizon = 2,
): CausalConfig {
  const treatment = AVAILABLE_TREATMENT
  const resolvedConfounders = confounders && confounders.length > 0
    ? confounders
    : AVAILABLE_CONFOUNDERS
  const resolvedColliders = colliders ?? {
    Return: 'Descendiente: retorno contemporáneo causa retorno futuro (data leakage)',
  }
  const outcome = 'FutureReturn'

  const dagEdges: DAGEdge[] = [
    ...resolvedConfounders.map((c) => ({
      from: c,
      to: treatment,
      label: `${c} → ${treatment}`,
    })),
    { from: treatment, to: outcome, label: 'Política monetaria → retorno futuro' },
    ...resolvedConfounders.map((c) => ({
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
    confounders: resolvedConfounders,
    excluded: resolvedColliders,
    dagEdges,
  }
}
