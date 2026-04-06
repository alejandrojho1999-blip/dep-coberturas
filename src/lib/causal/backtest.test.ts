import { describe, it, expect } from 'vitest'
import { timeSeriesSplit, spearmanIC, runBacktest } from './backtest'
import type { CausalConfig, DataRow } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple LCG for reproducible synthetic data */
function makeLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return (s / 0x100000000) - 0.5
  }
}

/** Generate synthetic DataRow[]: Future_Return = 2*CAPEX_Growth + noise */
function generateData(n = 40, seed = 7): DataRow[] {
  const rand = makeLCG(seed)
  const rows: DataRow[] = []
  for (let i = 0; i < n; i++) {
    const capex = rand() * 0.2
    const noise = rand() * 0.01
    const futureReturn = 2 * capex + noise
    rows.push({
      date: `2010-${String(i + 1).padStart(2, '0')}-01`,
      CAPEX_Growth: capex,
      GROSS_MARGIN: rand() * 0.1 + 0.3,
      Future_Return: futureReturn,
    })
  }
  return rows
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
// Tests: timeSeriesSplit
// ---------------------------------------------------------------------------

describe('timeSeriesSplit', () => {
  it('returns exactly nSplits folds for timeSeriesSplit(20, 5, 2)', () => {
    const folds = timeSeriesSplit(20, 5, 2)
    expect(folds.length).toBe(5)
  })

  it('each test fold has the same fixed size', () => {
    const folds = timeSeriesSplit(20, 5, 2)
    const testSize = folds[0].testIdx.length
    for (const fold of folds) {
      expect(fold.testIdx.length).toBe(testSize)
    }
    // floor((20 - 2) / (5 + 1)) = floor(18/6) = 3
    expect(testSize).toBe(3)
  })

  it('test indices do not overlap between consecutive folds', () => {
    const folds = timeSeriesSplit(20, 5, 2)
    for (let i = 1; i < folds.length; i++) {
      const prevSet = new Set(folds[i - 1].testIdx)
      for (const idx of folds[i].testIdx) {
        expect(prevSet.has(idx)).toBe(false)
      }
    }
  })

  it('train indices are strictly before test indices (with embargo gap)', () => {
    const folds = timeSeriesSplit(20, 5, 2)
    for (const fold of folds) {
      const maxTrain = Math.max(...fold.trainIdx)
      const minTest = Math.min(...fold.testIdx)
      // There must be at least embargoGap=2 gap
      expect(minTest - maxTrain).toBeGreaterThanOrEqual(2)
    }
  })

  it('training sets grow across folds', () => {
    const folds = timeSeriesSplit(20, 5, 2)
    for (let i = 1; i < folds.length; i++) {
      expect(folds[i].trainIdx.length).toBeGreaterThan(folds[i - 1].trainIdx.length)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: spearmanIC
// ---------------------------------------------------------------------------

describe('spearmanIC', () => {
  it('returns 1.0 for perfectly correlated arrays', () => {
    expect(spearmanIC([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1.0, 5)
  })

  it('returns -1.0 for perfectly anti-correlated arrays', () => {
    expect(spearmanIC([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1.0, 5)
  })

  it('returns NaN when array length < 3', () => {
    expect(spearmanIC([1, 2], [1, 2])).toBeNaN()
    expect(spearmanIC([], [])).toBeNaN()
  })

  it('handles tied ranks gracefully', () => {
    const result = spearmanIC([1, 1, 2, 3], [1, 1, 2, 3])
    expect(result).toBeCloseTo(1.0, 4)
  })

  it('returns value in [-1, 1] for typical arrays', () => {
    const result = spearmanIC([3, 1, 4, 1, 5], [2, 7, 1, 8, 2])
    expect(result).toBeGreaterThanOrEqual(-1)
    expect(result).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Tests: runBacktest
// ---------------------------------------------------------------------------

describe('runBacktest', () => {
  it('returns BacktestResult with correct number of folds', () => {
    const data = generateData(40)
    const result = runBacktest(data, config, ['GROSS_MARGIN'], 5, 2)
    expect(result.folds.length).toBe(5)
  })

  it('each fold has required fields', () => {
    const data = generateData(40)
    const result = runBacktest(data, config, ['GROSS_MARGIN'], 5, 2)
    for (const fold of result.folds) {
      expect(typeof fold.fold).toBe('number')
      expect(typeof fold.beta).toBe('number')
      expect(typeof fold.r2oos).toBe('number')
      expect(typeof fold.ic).toBe('number')
      expect(typeof fold.signCorrect).toBe('boolean')
    }
  })

  it('avgBeta is positive for data where treatment drives outcome', () => {
    const data = generateData(60)
    const result = runBacktest(data, config, ['GROSS_MARGIN'], 5, 2)
    // The DGP is Future_Return = 2 * CAPEX_Growth + noise, so β should be positive
    expect(result.avgBeta).toBeGreaterThan(0)
  })

  it('signCorrectRatio is between 0 and 1', () => {
    const data = generateData(40)
    const result = runBacktest(data, config, ['GROSS_MARGIN'], 5, 2)
    expect(result.signCorrectRatio).toBeGreaterThanOrEqual(0)
    expect(result.signCorrectRatio).toBeLessThanOrEqual(1)
  })

  it('returns empty result gracefully when data is too small', () => {
    const data = generateData(5)  // too few rows for backtest
    const result = runBacktest(data, config, ['GROSS_MARGIN'], 5, 2)
    expect(result.folds.length).toBe(0)
    expect(result.avgBeta).toBe(0)
  })
})
