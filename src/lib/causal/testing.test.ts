import { describe, it, expect } from 'vitest'
import { placeboPermutation, benjaminiHochberg, computeDSR, runMultipleTesting } from './testing'
import type { OLSResult, CausalConfig, DataRow } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return (s / 0x100000000) - 0.5
  }
}

/** Generate data with very strong treatment effect: y = 10*x + tiny_noise */
function generateStrongData(n = 50, seed = 99): DataRow[] {
  const rand = makeLCG(seed)
  const rows: DataRow[] = []
  for (let i = 0; i < n; i++) {
    const x = rand() * 0.2
    const z = rand() * 0.1
    const noise = rand() * 0.001
    rows.push({
      date: `2010-${String(i + 1).padStart(3, '0')}`,
      CAPEX_Growth: x,
      GROSS_MARGIN: z,
      Future_Return: 10 * x + 0.5 * z + noise,
    })
  }
  return rows
}

function makeModel(overrides: Partial<OLSResult> = {}): OLSResult {
  return {
    coefficients: { intercept: 0.01, CAPEX_Growth: 0.8, GROSS_MARGIN: 0.3 },
    standardErrors: { intercept: 0.01, CAPEX_Growth: 0.1, GROSS_MARGIN: 0.1 },
    tStats: { intercept: 1.0, CAPEX_Growth: 8.0, GROSS_MARGIN: 3.0 },
    pValues: { intercept: 0.3, CAPEX_Growth: 0.001, GROSS_MARGIN: 0.01 },
    r2: 0.85,
    r2adj: 0.84,
    n: 50,
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
  outcome: 'Future_Return',
  horizon: 4,
  confounders: ['GROSS_MARGIN'],
  excluded: {},
  dagEdges: [],
}

// ---------------------------------------------------------------------------
// Tests: placeboPermutation
// ---------------------------------------------------------------------------

describe('placeboPermutation', () => {
  it('returns placeboBetas array of length nPermutations', () => {
    const data = generateStrongData(50)
    const model = makeModel()
    const { placeboBetas } = placeboPermutation(data, config, ['GROSS_MARGIN'], model, 100, 42)
    expect(placeboBetas.length).toBe(100)
  })

  it('placebo p-value is < 0.2 for very strong treatment effect', () => {
    const data = generateStrongData(50)
    // Use a model with a very large β_real (matching the DGP: y = 10*x + ...)
    // so permuted betas (which destroy the signal) land far from β_real
    const strongModel = makeModel({
      coefficients: { intercept: 0.0, CAPEX_Growth: 9.5, GROSS_MARGIN: 0.5 },
    })
    const { placeboP } = placeboPermutation(data, config, ['GROSS_MARGIN'], strongModel, 500, 42)
    // β_real ≈ 9.5 → permuted OLS betas should mostly be near 0 → p < 0.2
    expect(placeboP).toBeLessThan(0.2)
  })

  it('placebo betas are numeric', () => {
    const data = generateStrongData(30)
    const model = makeModel()
    const { placeboBetas } = placeboPermutation(data, config, ['GROSS_MARGIN'], model, 50, 42)
    for (const b of placeboBetas) {
      expect(typeof b).toBe('number')
      expect(isNaN(b)).toBe(false)
    }
  })

  it('p-value is in [0, 1]', () => {
    const data = generateStrongData(40)
    const model = makeModel()
    const { placeboP } = placeboPermutation(data, config, ['GROSS_MARGIN'], model, 200, 42)
    expect(placeboP).toBeGreaterThanOrEqual(0)
    expect(placeboP).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Tests: benjaminiHochberg
// ---------------------------------------------------------------------------

describe('benjaminiHochberg', () => {
  it('returns true when some p-values pass BH at fdr=0.05', () => {
    expect(benjaminiHochberg([0.001, 0.04, 0.5], 0.05)).toBe(true)
  })

  it('returns false when no p-values pass BH at fdr=0.05', () => {
    expect(benjaminiHochberg([0.1, 0.2, 0.5], 0.05)).toBe(false)
  })

  it('returns true for a single very small p-value', () => {
    expect(benjaminiHochberg([0.001], 0.05)).toBe(true)
  })

  it('returns false for empty array', () => {
    expect(benjaminiHochberg([], 0.05)).toBe(false)
  })

  it('handles fdr=1.0 (all rejected)', () => {
    expect(benjaminiHochberg([0.5, 0.8, 0.9], 1.0)).toBe(true)
  })

  it('correctly applies BH rank ordering', () => {
    // With m=3, fdr=0.05:
    // sorted: [0.01, 0.04, 0.5]
    // k=1: 0.01 <= 1/3 * 0.05 = 0.0167 → reject
    expect(benjaminiHochberg([0.04, 0.01, 0.5], 0.05)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: computeDSR
// ---------------------------------------------------------------------------

describe('computeDSR', () => {
  it('returns positive DSR for model with positive R²', () => {
    const model = makeModel({ r2adj: 0.25, n: 40 })
    const dsr = computeDSR(model)
    expect(dsr).toBeGreaterThan(0)
    expect(dsr).toBeCloseTo(Math.sqrt(0.25) * Math.sqrt(40), 5)
  })

  it('uses 0.0001 floor when R²_adj is 0, avoiding NaN', () => {
    const model = makeModel({ r2adj: 0, n: 50 })
    const dsr = computeDSR(model)
    expect(dsr).not.toBeNaN()
    expect(dsr).toBeCloseTo(Math.sqrt(0.0001) * Math.sqrt(50), 5)
  })

  it('uses 0.0001 floor when R²_adj is negative, avoiding NaN', () => {
    const model = makeModel({ r2adj: -0.5, n: 30 })
    const dsr = computeDSR(model)
    expect(dsr).not.toBeNaN()
    expect(dsr).toBeGreaterThan(0)
    expect(dsr).toBeCloseTo(Math.sqrt(0.0001) * Math.sqrt(30), 5)
  })

  it('DSR increases with more observations', () => {
    const modelSmall = makeModel({ r2adj: 0.3, n: 20 })
    const modelLarge = makeModel({ r2adj: 0.3, n: 100 })
    expect(computeDSR(modelLarge)).toBeGreaterThan(computeDSR(modelSmall))
  })
})

// ---------------------------------------------------------------------------
// Tests: runMultipleTesting
// ---------------------------------------------------------------------------

describe('runMultipleTesting', () => {
  it('returns MultipleTestingResult with all required fields', () => {
    const data = generateStrongData(50)
    const model = makeModel()
    const result = runMultipleTesting(data, config, ['GROSS_MARGIN'], model, 100)

    expect(Array.isArray(result.placeboBetas)).toBe(true)
    expect(typeof result.placeboP).toBe('number')
    expect(typeof result.dsr).toBe('number')
    expect(typeof result.bhFdrRejected).toBe('boolean')
  })

  it('dsr is not NaN', () => {
    const data = generateStrongData(40)
    const model = makeModel()
    const result = runMultipleTesting(data, config, ['GROSS_MARGIN'], model, 50)
    expect(result.dsr).not.toBeNaN()
    expect(result.dsr).toBeGreaterThan(0)
  })
})
