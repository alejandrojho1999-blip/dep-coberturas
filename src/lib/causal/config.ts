import type { CausalConfig, DAGEdge } from './types'

export function buildCausalConfig(
  ticker: string,
  name: string,
  _sector: string,
  treatment: string,
  confounders?: string[],
  colliders?: Record<string, string>,
  horizon = 2,
): CausalConfig {
  const resolvedConfounders = confounders && confounders.length > 0
    ? confounders
    : ['YIELD_10Y', 'VIX']
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
    { from: treatment, to: outcome, label: `${treatment} → retorno futuro` },
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
