import type { OLSResult, PortfolioScore, CausalConfig, DataRow } from './types'

/**
 * Compute the causal portfolio score for an asset.
 *
 * Formula (from López de Prado AAPL case):
 * rawScore = β_CAPEX * latest_CAPEX_Growth
 *          - (β_YIELD_10Y * latest_YIELD_10Y + β_FED_RATE * latest_FED_RATE)
 *          - (β_VIX * latest_VIX)
 *          + (β_GROSS_MARGIN * latest_GROSS_MARGIN + β_RETURN_COM_EQY * latest_RETURN_COM_EQY)
 * score = clamp(50 + rawScore * 1000, 0, 100)  // scaled to 0-100
 *
 * Why: The causal model's coefficients represent the do-calculus effect of each
 * variable on Future_Return. The score aggregates the directional push from
 * each variable's current value weighted by its causal coefficient.
 * Macro factors (rates, VIX) subtract because they hurt returns.
 * Quality factors (margins, ROE) add because they support returns.
 *
 * signal:
 *   score > 60 → 'AUMENTAR'
 *   score >= 40 → 'MANTENER'
 *   score < 40 → 'REDUCIR'
 *
 * suggestedWeight: score / 100 * 10  // 0-10% of portfolio
 *
 * stressTests: for each confounder, compute impact of +100bps (0.01) shock
 *   impact = β_variable * 0.01
 */
export function computeCausalScore(
  model: OLSResult,
  latestData: DataRow,
  config: CausalConfig
): PortfolioScore {
  const { treatment, confounders } = config
  const coefs = model.coefficients

  // Macro/negative factors: variables known to hurt returns
  const MACRO_FACTORS = new Set(['YIELD_10Y', 'FED_RATE', 'VIX'])

  // Compute components: treatment contribution + confounder contributions
  const components: Record<string, number> = {}

  // Treatment (positive factor by default)
  const treatmentVal = latestData[treatment]
  if (typeof treatmentVal === 'number' && isFinite(treatmentVal) && coefs[treatment] !== undefined) {
    components[treatment] = coefs[treatment] * treatmentVal
  }

  // Confounders
  for (const confounder of confounders) {
    const val = latestData[confounder]
    const beta = coefs[confounder]
    if (typeof val === 'number' && isFinite(val) && beta !== undefined) {
      const contribution = beta * val
      // Macro factors subtract (they represent headwinds)
      if (MACRO_FACTORS.has(confounder)) {
        components[confounder] = -Math.abs(contribution)
      } else {
        components[confounder] = contribution
      }
    }
  }

  // Raw score = sum of all component contributions
  const rawScore = Object.values(components).reduce((acc, v) => acc + v, 0)

  // Scale to 0-100: center at 50, scale by 1000
  const score = Math.max(0, Math.min(100, 50 + rawScore * 1000))

  // Investment signal
  let signal: 'AUMENTAR' | 'MANTENER' | 'REDUCIR'
  if (score > 60) {
    signal = 'AUMENTAR'
  } else if (score >= 40) {
    signal = 'MANTENER'
  } else {
    signal = 'REDUCIR'
  }

  // Suggested portfolio weight: 0-10%
  const suggestedWeight = (score / 100) * 10

  // Stress tests: +100bps (0.01) shock to each confounder
  const stressTests = confounders
    .filter((v) => coefs[v] !== undefined)
    .map((variable) => ({
      variable,
      shockBps: 100,
      impact: coefs[variable] * 0.01,
    }))

  return {
    score,
    signal,
    suggestedWeight,
    components,
    stressTests,
  }
}
