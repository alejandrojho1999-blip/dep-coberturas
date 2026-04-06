import { describe, it, expect } from 'vitest'
import { computeCausalScore } from './portfolio'
import type { OLSResult, CausalConfig, DataRow } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModel(coefs: Record<string, number>): OLSResult {
  const names = Object.keys(coefs)
  return {
    coefficients: coefs,
    standardErrors: Object.fromEntries(names.map((n) => [n, 0.001])),
    tStats: Object.fromEntries(names.map((n) => [n, 2.0])),
    pValues: Object.fromEntries(names.map((n) => [n, 0.04])),
    r2: 0.3,
    r2adj: 0.25,
    n: 40,
    k: names.length - 1,
    residuals: [],
    fittedValues: [],
  }
}

const config: CausalConfig = {
  ticker: 'AAPL',
  name: 'Apple',
  treatment: 'CAPEX_Growth',
  outcome: 'Future_Return',
  horizon: 4,
  confounders: ['YIELD_10Y', 'FED_RATE', 'VIX', 'GROSS_MARGIN', 'RETURN_COM_EQY'],
  excluded: {},
  dagEdges: [],
}

const model = makeModel({
  intercept: 0.01,
  CAPEX_Growth: 0.005,
  YIELD_10Y: -0.003,
  FED_RATE: -0.004,
  VIX: -0.002,
  GROSS_MARGIN: 0.006,
  RETURN_COM_EQY: 0.007,
})

const latestData: DataRow = {
  date: '2024-01-01',
  CAPEX_Growth: 0.08,
  YIELD_10Y: 0.043,
  FED_RATE: 0.053,
  VIX: 18.0,
  GROSS_MARGIN: 0.44,
  RETURN_COM_EQY: 0.17,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeCausalScore', () => {
  it('returns score in [0, 100]', () => {
    const result = computeCausalScore(model, latestData, config)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns signal AUMENTAR when score > 60', () => {
    // Force a high score by using large positive coefficients and values
    const highModel = makeModel({
      intercept: 0.0,
      CAPEX_Growth: 0.02,
      YIELD_10Y: 0.0,
      FED_RATE: 0.0,
      VIX: 0.0,
      GROSS_MARGIN: 0.02,
      RETURN_COM_EQY: 0.02,
    })
    const highData: DataRow = {
      date: '2024-01-01',
      CAPEX_Growth: 0.5,
      YIELD_10Y: 0.0,
      FED_RATE: 0.0,
      VIX: 0.0,
      GROSS_MARGIN: 0.5,
      RETURN_COM_EQY: 0.5,
    }
    const result = computeCausalScore(highModel, highData, config)
    expect(result.score).toBeGreaterThan(60)
    expect(result.signal).toBe('AUMENTAR')
  })

  it('returns signal REDUCIR when score < 40', () => {
    // Force a low score: treatment coefficient positive but value very negative
    const lowModel = makeModel({
      intercept: 0.0,
      CAPEX_Growth: 0.02,
      YIELD_10Y: 0.0,
      FED_RATE: 0.0,
      VIX: 0.0,
      GROSS_MARGIN: 0.0,
      RETURN_COM_EQY: 0.0,
    })
    const lowData: DataRow = {
      date: '2024-01-01',
      CAPEX_Growth: -1.0,  // β(0.02) * (-1.0) * 1000 = -20 → score = 50-20 = 30
      YIELD_10Y: 0.0,
      FED_RATE: 0.0,
      VIX: 0.0,
      GROSS_MARGIN: 0.0,
      RETURN_COM_EQY: 0.0,
    }
    const result = computeCausalScore(lowModel, lowData, config)
    expect(result.score).toBeLessThan(40)
    expect(result.signal).toBe('REDUCIR')
  })

  it('returns signal MANTENER when score is between 40 and 60', () => {
    // Use near-zero coefficients so rawScore ≈ 0 → score ≈ 50
    const neutralModel = makeModel({
      intercept: 0.0,
      CAPEX_Growth: 0.0,
      YIELD_10Y: 0.0,
      FED_RATE: 0.0,
      VIX: 0.0,
      GROSS_MARGIN: 0.0,
      RETURN_COM_EQY: 0.0,
    })
    const result = computeCausalScore(neutralModel, latestData, config)
    expect(result.score).toBeGreaterThanOrEqual(40)
    expect(result.score).toBeLessThanOrEqual(60)
    expect(result.signal).toBe('MANTENER')
  })

  it('suggestedWeight is score/100 * 10', () => {
    const result = computeCausalScore(model, latestData, config)
    expect(result.suggestedWeight).toBeCloseTo((result.score / 100) * 10, 5)
  })

  it('stress test entries have correct impact calculation (β * 0.01)', () => {
    const result = computeCausalScore(model, latestData, config)
    expect(result.stressTests.length).toBeGreaterThan(0)

    for (const st of result.stressTests) {
      const expected = model.coefficients[st.variable] * 0.01
      expect(st.impact).toBeCloseTo(expected, 10)
      expect(st.shockBps).toBe(100)
    }
  })

  it('components record contains treatment and confounder contributions', () => {
    const result = computeCausalScore(model, latestData, config)
    expect(result.components).toHaveProperty('CAPEX_Growth')
    expect(result.components).toHaveProperty('GROSS_MARGIN')
  })
})
