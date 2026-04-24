import { describe, it, expect } from 'vitest'
import { scoreLdP, computeCausalScore } from './portfolio'
import type { OLSResult, CausalConfig, DataRow } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(overrides: Partial<OLSResult> = {}): OLSResult {
  return {
    coefficients: { intercept: 0.01, CAPEX_Growth: 0.3, YIELD_10Y: -0.1 },
    standardErrors: { intercept: 0.01, CAPEX_Growth: 0.05, YIELD_10Y: 0.05 },
    tStats: { intercept: 1.0, CAPEX_Growth: 3.0, YIELD_10Y: -2.0 },
    pValues: { intercept: 0.3, CAPEX_Growth: 0.01, YIELD_10Y: 0.04 },
    r2: 0.5,
    r2adj: 0.45,
    n: 40,
    k: 2,
    residuals: [],
    fittedValues: [],
    ...overrides,
  }
}

const config: CausalConfig = {
  ticker: 'AAPL',
  name: 'Apple',
  treatment: 'CAPEX_Growth',
  outcome: 'FutureReturn',
  horizon: 4,
  confounders: ['YIELD_10Y'],
  excluded: {},
  dagEdges: [],
}

const latestData: DataRow = {
  date: '2024-01-01',
  CAPEX_Growth: 0.08,
  YIELD_10Y: 0.043,
}

// ---------------------------------------------------------------------------
// Tests: scoreLdP
// ---------------------------------------------------------------------------

describe('scoreLdP', () => {
  it('returns 100 for perfect inputs', () => {
    // |β_std|=0.5 (max), |t|=4.0 (max), R²=1, p=0 → raw=1.0 → score=100
    expect(scoreLdP(0.5, 4.0, 1.0, 0.0, true, true, true)).toBeCloseTo(100, 4)
  })

  it('returns 0 for zero inputs', () => {
    // β=0, t=0, R²=0, p=1 → raw=0 → score=0
    expect(scoreLdP(0, 0, 0, 1.0, true, true, true)).toBeCloseTo(0, 4)
  })

  it('applies placebo penalty ×0 when placeboOk=false', () => {
    expect(scoreLdP(0.5, 4.0, 1.0, 0.0, false, true, true)).toBe(0)
  })

  it('applies DSR penalty ×0.5 when dsrOk=false', () => {
    const full = scoreLdP(0.5, 4.0, 1.0, 0.0, true, true, true)
    const penalized = scoreLdP(0.5, 4.0, 1.0, 0.0, true, false, true)
    expect(penalized).toBeCloseTo(full * 0.5, 4)
  })

  it('applies BH-FDR penalty ×0.7 when bhFdrOk=false', () => {
    const full = scoreLdP(0.5, 4.0, 1.0, 0.0, true, true, true)
    const penalized = scoreLdP(0.5, 4.0, 1.0, 0.0, true, true, false)
    expect(penalized).toBeCloseTo(full * 0.7, 4)
  })

  it('accumulates penalties multiplicatively', () => {
    const full = scoreLdP(0.5, 4.0, 1.0, 0.0, true, true, true)
    const both = scoreLdP(0.5, 4.0, 1.0, 0.0, true, false, false)
    expect(both).toBeCloseTo(full * 0.5 * 0.7, 4)
  })

  it('clamps β_std contribution at 1 when |β| >= 0.5', () => {
    const s1 = scoreLdP(0.5, 0, 0, 1.0, true, true, true)
    const s2 = scoreLdP(1.0, 0, 0, 1.0, true, true, true)
    expect(s1).toBeCloseTo(s2, 4) // both max out at 40 points
  })

  it('uses |β_std| so negative betas contribute equally', () => {
    const pos = scoreLdP(0.3, 2.0, 0.2, 0.05, true, true, true)
    const neg = scoreLdP(-0.3, -2.0, 0.2, 0.05, true, true, true)
    expect(pos).toBeCloseTo(neg, 4)
  })

  it('clamps R²_adj at 0 when negative', () => {
    const s1 = scoreLdP(0, 0, -0.5, 1.0, true, true, true)
    const s2 = scoreLdP(0, 0, 0.0, 1.0, true, true, true)
    expect(s1).toBeCloseTo(s2, 4)
  })

  it('output is in [0, 100]', () => {
    for (const [b, t, r, p] of [
      [0.5, 4, 1, 0], [0, 0, 0, 1], [0.25, 2, 0.5, 0.05], [-1, -10, -0.3, 0.9],
    ]) {
      const s = scoreLdP(b as number, t as number, r as number, p as number, true, true, true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })

  it('formula weights: 40/30/20/10 match Colab Celda 9', () => {
    // Isolate each component with known inputs
    const betaOnly = scoreLdP(0.5, 0, 0, 1.0, true, true, true)   // 40 points
    const tOnly    = scoreLdP(0, 4.0, 0, 1.0, true, true, true)    // 30 points
    const r2Only   = scoreLdP(0, 0, 1.0, 1.0, true, true, true)    // 20 points
    const pOnly    = scoreLdP(0, 0, 0, 0.0, true, true, true)       // 10 points
    expect(betaOnly).toBeCloseTo(40, 3)
    expect(tOnly).toBeCloseTo(30, 3)
    expect(r2Only).toBeCloseTo(20, 3)
    expect(pOnly).toBeCloseTo(10, 3)
  })
})

// ---------------------------------------------------------------------------
// Tests: computeCausalScore
// ---------------------------------------------------------------------------

describe('computeCausalScore', () => {
  it('returns score in [0, 100]', () => {
    const result = computeCausalScore(makeModel(), latestData, config)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns signal AUMENTAR when score >= 65', () => {
    // Perfect inputs: |β|=0.5, |t|=4, R²=1, p=0 → score=100
    const highModel = makeModel({
      coefficients: { intercept: 0.0, CAPEX_Growth: 0.5, YIELD_10Y: 0.0 },
      tStats:       { intercept: 0.0, CAPEX_Growth: 4.0, YIELD_10Y: 0.0 },
      pValues:      { intercept: 1.0, CAPEX_Growth: 0.0, YIELD_10Y: 1.0 },
      r2adj: 1.0,
    })
    const result = computeCausalScore(highModel, latestData, config)
    expect(result.score).toBeGreaterThanOrEqual(65)
    expect(result.signal).toBe('AUMENTAR')
  })

  it('returns signal REDUCIR when score < 40', () => {
    // Zero beta, zero t, zero R², p=1 → score=0
    const lowModel = makeModel({
      coefficients: { intercept: 0.0, CAPEX_Growth: 0.0, YIELD_10Y: 0.0 },
      tStats:       { intercept: 0.0, CAPEX_Growth: 0.0, YIELD_10Y: 0.0 },
      pValues:      { intercept: 1.0, CAPEX_Growth: 1.0, YIELD_10Y: 1.0 },
      r2adj: -0.1,
    })
    const result = computeCausalScore(lowModel, latestData, config)
    expect(result.score).toBeLessThan(40)
    expect(result.signal).toBe('REDUCIR')
  })

  it('returns signal MANTENER when score is between 40 and 64', () => {
    // |β|=0.25 (half max), |t|=2, R²=0.3, p=0.1
    // raw = 0.40*0.5 + 0.30*0.5 + 0.20*0.3 + 0.10*0.9 = 0.2+0.15+0.06+0.09 = 0.5 → 50
    const midModel = makeModel({
      coefficients: { intercept: 0.0, CAPEX_Growth: 0.25, YIELD_10Y: 0.0 },
      tStats:       { intercept: 0.0, CAPEX_Growth: 2.0,  YIELD_10Y: 0.0 },
      pValues:      { intercept: 1.0, CAPEX_Growth: 0.1,  YIELD_10Y: 1.0 },
      r2adj: 0.3,
    })
    const result = computeCausalScore(midModel, latestData, config)
    expect(result.score).toBeGreaterThanOrEqual(40)
    expect(result.score).toBeLessThan(65)
    expect(result.signal).toBe('MANTENER')
  })

  it('suggestedWeight is score/100 * 10', () => {
    const result = computeCausalScore(makeModel(), latestData, config)
    expect(result.suggestedWeight).toBeCloseTo((result.score / 100) * 10, 5)
  })

  it('components record has beta_std, t_stat, r2_adj, p_value keys', () => {
    const result = computeCausalScore(makeModel(), latestData, config)
    expect(result.components).toHaveProperty('beta_std')
    expect(result.components).toHaveProperty('t_stat')
    expect(result.components).toHaveProperty('r2_adj')
    expect(result.components).toHaveProperty('p_value')
  })

  it('stress test entries have correct impact calculation (β * 0.01)', () => {
    const model = makeModel()
    const result = computeCausalScore(model, latestData, config)
    for (const st of result.stressTests) {
      const expected = model.coefficients[st.variable] * 0.01
      expect(st.impact).toBeCloseTo(expected, 10)
      expect(st.shockBps).toBe(100)
    }
  })

  it('placeboOk=false zeroes out the score', () => {
    const result = computeCausalScore(makeModel(), latestData, config, false, true, true)
    expect(result.score).toBe(0)
  })
})
