import type { OLSResult, PortfolioScore, CausalConfig, DataRow } from './types'

/**
 * Score López de Prado (2025) — ported from Colab notebook Celda 9.
 *
 * Formula:
 *   raw = 40% × clamp(|β_std| / 0.5, 0, 1)
 *       + 30% × clamp(|t-stat| / 4.0, 0, 1)
 *       + 20% × max(R²_adj, 0)
 *       + 10% × (1 − p-value)
 *   score = raw × 100
 *
 * Multiplicative penalties:
 *   × 0.0 if placebo fails (non-causal signal)
 *   × 0.5 if DSR fails (fragile signal)
 *   × 0.7 if BH-FDR fails (doesn't survive multiple testing)
 */
export function scoreLdP(
  betaStd: number,
  tStat: number,
  r2adj: number,
  pValue: number,
  placeboOk: boolean,
  dsrOk: boolean,
  bhFdrOk: boolean,
): number {
  const raw = (
    0.40 * Math.min(Math.abs(betaStd) / 0.5, 1.0) +
    0.30 * Math.min(Math.abs(tStat) / 4.0, 1.0) +
    0.20 * Math.max(r2adj, 0) +
    0.10 * (1 - Math.max(0, Math.min(1, pValue)))
  ) * 100

  let score = raw
  if (!placeboOk) score *= 0.0
  if (!dsrOk)     score *= 0.5
  if (!bhFdrOk)   score *= 0.7

  return Math.max(0, Math.min(100, score))
}

export function computeCausalScore(
  model: OLSResult,
  latestData: DataRow,
  config: CausalConfig,
  placeboOk = true,
  dsrOk = true,
  bhFdrOk = true,
): PortfolioScore {
  const { treatment, confounders } = config
  const coefs = model.coefficients

  // β_std: treatment coefficient (assumes data was standardized upstream)
  const betaStd = coefs[treatment] ?? 0
  const tStat = model.tStats[treatment] ?? 0
  const r2adj = model.r2adj
  const pValue = model.pValues[treatment] ?? 1

  const score = scoreLdP(betaStd, tStat, r2adj, pValue, placeboOk, dsrOk, bhFdrOk)

  let signal: 'AUMENTAR' | 'MANTENER' | 'REDUCIR'
  if (score >= 65) signal = 'AUMENTAR'
  else if (score >= 40) signal = 'MANTENER'
  else signal = 'REDUCIR'

  // Component contributions for display
  const components: Record<string, number> = {
    beta_std:  0.40 * Math.min(Math.abs(betaStd) / 0.5, 1.0) * 100,
    t_stat:    0.30 * Math.min(Math.abs(tStat) / 4.0, 1.0) * 100,
    r2_adj:    0.20 * Math.max(r2adj, 0) * 100,
    p_value:   0.10 * (1 - Math.max(0, Math.min(1, pValue))) * 100,
  }

  const suggestedWeight = (score / 100) * 10

  const stressTests = confounders
    .filter((v) => coefs[v] !== undefined)
    .map((variable) => ({
      variable,
      shockBps: 100,
      impact: coefs[variable] * 0.01,
    }))

  return { score, signal, suggestedWeight, components, stressTests }
}
