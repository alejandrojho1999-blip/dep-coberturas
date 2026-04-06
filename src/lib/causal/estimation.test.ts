import { describe, it, expect } from 'vitest'
import { olsRegression, compareModels } from './estimation'
import type { CausalConfig, DataRow } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate synthetic data: y = 2*x + (-1)*z + noise */
function generateSyntheticData(n = 200, seed = 42) {
  // Simple LCG pseudo-random for reproducibility
  let s = seed
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff - 0.5
  }

  const X: number[][] = []
  const y: number[] = []

  for (let i = 0; i < n; i++) {
    const x = rand() * 4
    const z = rand() * 4
    const noise = rand() * 0.5
    X.push([1, x, z])
    y.push(2 * x + -1 * z + noise)
  }

  return { X, y }
}

// ---------------------------------------------------------------------------
// Tests: olsRegression
// ---------------------------------------------------------------------------

describe('olsRegression', () => {
  it('recovers known coefficients β_x≈2, β_z≈-1', () => {
    const { X, y } = generateSyntheticData(300)
    const result = olsRegression(X, y, ['intercept', 'x', 'z'])

    expect(result.coefficients['x']).toBeCloseTo(2.0, 1)
    expect(result.coefficients['z']).toBeCloseTo(-1.0, 1)
  })

  it('returns p-values < 0.05 for significant predictors', () => {
    const { X, y } = generateSyntheticData(300)
    const result = olsRegression(X, y, ['intercept', 'x', 'z'])

    expect(result.pValues['x']).toBeLessThan(0.05)
    expect(result.pValues['z']).toBeLessThan(0.05)
  })

  it('R² is high for well-fitting model (> 0.95)', () => {
    const { X, y } = generateSyntheticData(300)
    const result = olsRegression(X, y, ['intercept', 'x', 'z'])

    expect(result.r2).toBeGreaterThan(0.95)
  })

  it('residuals sum to approximately zero', () => {
    const { X, y } = generateSyntheticData(200)
    const result = olsRegression(X, y, ['intercept', 'x', 'z'])
    const residualSum = result.residuals.reduce((a, b) => a + b, 0)

    expect(Math.abs(residualSum)).toBeLessThan(1e-6)
  })

  it('returns correct n and k', () => {
    const { X, y } = generateSyntheticData(100)
    const result = olsRegression(X, y, ['intercept', 'x', 'z'])

    expect(result.n).toBe(100)
    expect(result.k).toBe(2) // two predictors (x and z), excluding intercept
  })

  it('throws when not enough observations', () => {
    expect(() =>
      olsRegression([[1, 2], [1, 3]], [1, 2], ['intercept', 'x']),
    ).toThrow()
  })

  it('fittedValues length matches n', () => {
    const { X, y } = generateSyntheticData(50)
    const result = olsRegression(X, y, ['intercept', 'x', 'z'])

    expect(result.fittedValues).toHaveLength(50)
    expect(result.residuals).toHaveLength(50)
  })

  it('perfect fit gives R²=1', () => {
    // y = 3x exactly (no noise)
    const X = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]]
    const y = [3, 6, 9, 12, 15]
    const result = olsRegression(X, y, ['intercept', 'x'])

    expect(result.r2).toBeCloseTo(1.0, 5)
    expect(result.coefficients['x']).toBeCloseTo(3.0, 5)
  })
})

// ---------------------------------------------------------------------------
// Tests: compareModels / signFlipDetected
// ---------------------------------------------------------------------------

describe('compareModels', () => {
  /** Build DataRow[] with sign-flip setup:
   *  - treatment T has positive naive effect on outcome Y
   *  - collider C is correlated with both T and Y and reverses the apparent effect
   */
  function makeSignFlipData(n = 300): DataRow[] {
    let s = 123456
    const rand = () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff - 0.5
    }

    const rows: DataRow[] = []
    for (let i = 0; i < n; i++) {
      const t = rand() * 2
      // collider C is strongly driven by t and also strongly correlated with y
      const c = 3 * t + rand() * 0.2
      const noise = rand() * 0.3
      // true causal effect of t on y is +1, but c is a collider (not a confounder)
      const y = 1 * t + noise
      rows.push({ date: `2020-01-${String(i + 1).padStart(2, '0')}`, t, c, y })
    }
    return rows
  }

  const config: CausalConfig = {
    ticker: 'TEST',
    name: 'Test',
    treatment: 't',
    outcome: 'y',
    horizon: 4,
    confounders: [],
    excluded: { c: 'collider' },
    dagEdges: [],
  }

  it('returns three OLS models', () => {
    const data = makeSignFlipData()
    const result = compareModels(data, config)

    expect(result.naive).toBeDefined()
    expect(result.withColliders).toBeDefined()
    expect(result.causal).toBeDefined()
  })

  it('naive model has only treatment coefficient', () => {
    const data = makeSignFlipData()
    const result = compareModels(data, config)

    expect(Object.keys(result.naive.coefficients)).toContain('t')
    expect(Object.keys(result.naive.coefficients)).not.toContain('c')
  })

  it('withColliders model includes collider coefficient', () => {
    const data = makeSignFlipData()
    const result = compareModels(data, config)

    expect(Object.keys(result.withColliders.coefficients)).toContain('c')
  })

  it('detects sign flip when collider is included', () => {
    // Strong M-bias structure: two hidden common causes U1, U2
    // U1 -> T, U1 -> C (collider parent 1)
    // U2 -> Y, U2 -> C (collider parent 2)
    // True effect T -> Y is small positive
    // Conditioning on C opens a backdoor path U1 -> C <- U2, introducing
    // a strong negative correlation between T and Y via U1/U2, flipping the sign.
    let s = 777
    const rand = () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff - 0.5
    }

    const data: DataRow[] = []
    for (let i = 0; i < 1000; i++) {
      const u1 = rand() * 2
      const u2 = rand() * 2
      const t = 10 * u1 + rand() * 0.1   // T driven almost entirely by U1
      const y = 0.1 * t + 10 * u2 + rand() * 0.1  // Y driven almost entirely by U2
      const c = 10 * u1 + 10 * u2 + rand() * 0.1  // C is a collider (child of U1 and U2)
      data.push({ date: `2020-${i}`, t, c, y })
    }

    const cfg: CausalConfig = {
      ...config,
      excluded: { c: 'collider' },
    }

    const result = compareModels(data, cfg)
    // Conditioning on the collider C opens the U1-U2 path, creating strong
    // negative partial correlation between T and Y => sign flip
    expect(result.signFlipDetected).toBe(true)
  })

  it('skips collider columns missing from data', () => {
    const data = makeSignFlipData().map(({ c: _c, ...rest }) => rest as DataRow)
    const cfg: CausalConfig = { ...config, excluded: { c: 'collider', missing_var: 'collider' } }

    // Should not throw even though 'c' and 'missing_var' are absent from data
    expect(() => compareModels(data, cfg)).not.toThrow()
  })
})
