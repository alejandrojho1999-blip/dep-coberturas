import type { OLSResult, BacktestResult, BacktestFold, DataRow, CausalConfig } from './types'
import { olsRegression } from './estimation'

/**
 * Create TimeSeriesSplit indices with embargo.
 *
 * TimeSeriesSplit: splits n observations into n_splits folds,
 * each fold has a growing training set and a fixed-size test set.
 * Embargo: skip `embargoGap` observations between train and test
 * to prevent information leakage from overlapping returns.
 *
 * Returns array of {trainIdx, testIdx} pairs.
 */
export function timeSeriesSplit(
  n: number,
  nSplits: number,
  embargoGap: number
): Array<{ trainIdx: number[]; testIdx: number[] }> {
  // Each fold has a test set of size floor((n - embargoGap) / (nSplits + 1))
  // but we use the sklearn-style split: test size = floor(n / (nSplits + 1))
  // and the training set grows by testSize each fold.
  const testSize = Math.floor((n - embargoGap) / (nSplits + 1))
  const folds: Array<{ trainIdx: number[]; testIdx: number[] }> = []

  for (let i = 0; i < nSplits; i++) {
    // Training ends at some index; test starts after embargo gap
    const trainEnd = testSize * (i + 1)  // exclusive
    const testStart = trainEnd + embargoGap
    const testEnd = testStart + testSize  // exclusive

    if (testEnd > n) break

    const trainIdx = Array.from({ length: trainEnd }, (_, k) => k)
    const testIdx = Array.from({ length: testSize }, (_, k) => testStart + k)

    folds.push({ trainIdx, testIdx })
  }

  return folds
}

/**
 * Compute Spearman rank correlation between two arrays.
 * Spearman IC = Pearson correlation of ranks.
 * Returns NaN if array length < 3 (insufficient for meaningful correlation).
 */
export function spearmanIC(actual: number[], predicted: number[]): number {
  const n = actual.length
  if (n < 3 || n !== predicted.length) return NaN

  // Compute ranks (1-indexed average ranks for ties)
  function rankArray(arr: number[]): number[] {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array<number>(n)
    let j = 0
    while (j < n) {
      let k = j
      while (k < n - 1 && sorted[k + 1].v === sorted[k].v) k++
      const avgRank = (j + k) / 2 + 1  // 1-indexed average
      for (let m = j; m <= k; m++) ranks[sorted[m].i] = avgRank
      j = k + 1
    }
    return ranks
  }

  const rankActual = rankArray(actual)
  const rankPred = rankArray(predicted)

  // Pearson correlation of ranks
  const meanA = rankActual.reduce((s, v) => s + v, 0) / n
  const meanP = rankPred.reduce((s, v) => s + v, 0) / n

  let num = 0
  let denA = 0
  let denP = 0
  for (let i = 0; i < n; i++) {
    const da = rankActual[i] - meanA
    const dp = rankPred[i] - meanP
    num += da * dp
    denA += da * da
    denP += dp * dp
  }

  const denom = Math.sqrt(denA * denP)
  return denom < Number.EPSILON ? NaN : num / denom
}

/**
 * Run walk-forward backtest for the causal model.
 *
 * For each fold:
 * 1. Fit OLS on training observations with [treatment, ...adjustmentSet]
 * 2. Predict on test observations
 * 3. Compute OOS R² = 1 - SS_res_test / SS_tot_test (can be negative)
 * 4. Compute Spearman IC = rank correlation between predicted and actual returns
 * 5. Record whether β_treatment sign is "correct" (positive = bullish signal)
 *
 * @param data - aligned DataRow[] (already cleaned)
 * @param config - causal config (treatment, confounders)
 * @param adjustmentSet - variables to include as controls
 * @param nSplits - number of folds (default 5)
 * @param embargoGap - quarters to skip between train/test (default 2)
 */
export function runBacktest(
  data: DataRow[],
  config: CausalConfig,
  adjustmentSet: string[],
  nSplits = 5,
  embargoGap = 2
): BacktestResult {
  const { treatment, outcome } = config
  const predictors = [treatment, ...adjustmentSet]

  // Filter to rows with all required variables
  const cleanData = data.filter((row) => {
    const yVal = row[outcome]
    if (typeof yVal !== 'number' || !isFinite(yVal)) return false
    for (const p of predictors) {
      const v = row[p]
      if (typeof v !== 'number' || !isFinite(v)) return false
    }
    return true
  })

  const n = cleanData.length
  const foldIndices = timeSeriesSplit(n, nSplits, embargoGap)

  const folds: BacktestFold[] = []

  for (let fi = 0; fi < foldIndices.length; fi++) {
    const { trainIdx, testIdx } = foldIndices[fi]

    const trainData = trainIdx.map((i) => cleanData[i])
    const testData = testIdx.map((i) => cleanData[i])

    // Build design matrices
    const X_train: number[][] = trainData.map((row) => [1, ...predictors.map((p) => row[p] as number)])
    const y_train: number[] = trainData.map((row) => row[outcome] as number)

    const X_test: number[][] = testData.map((row) => [1, ...predictors.map((p) => row[p] as number)])
    const y_test: number[] = testData.map((row) => row[outcome] as number)

    let foldResult: OLSResult
    try {
      foldResult = olsRegression(X_train, y_train, ['intercept', ...predictors])
    } catch {
      continue
    }

    const beta = foldResult.coefficients[treatment] ?? 0

    // Predict on test set
    const betaArr = ['intercept', ...predictors].map((name) => foldResult.coefficients[name] ?? 0)
    const predicted: number[] = X_test.map((row) =>
      row.reduce((sum, x, j) => sum + x * betaArr[j], 0)
    )

    // OOS R²
    const yMean = y_test.reduce((s, v) => s + v, 0) / y_test.length
    const ssTot = y_test.reduce((s, v) => s + (v - yMean) ** 2, 0)
    const ssRes = y_test.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0)
    const r2oos = ssTot < Number.EPSILON ? 0 : 1 - ssRes / ssTot

    // Spearman IC
    const ic = spearmanIC(y_test, predicted)

    // Sign correctness: positive β means bullish signal is "correct"
    const signCorrect = beta > 0

    folds.push({ fold: fi + 1, beta, r2oos, ic, signCorrect })
  }

  if (folds.length === 0) {
    return { folds: [], avgBeta: 0, avgR2oos: 0, avgIC: 0, signCorrectRatio: 0 }
  }

  const avgBeta = folds.reduce((s, f) => s + f.beta, 0) / folds.length
  const avgR2oos = folds.reduce((s, f) => s + f.r2oos, 0) / folds.length
  const validIC = folds.filter((f) => !isNaN(f.ic))
  const avgIC = validIC.length > 0 ? validIC.reduce((s, f) => s + f.ic, 0) / validIC.length : 0
  const signCorrectRatio = folds.filter((f) => f.signCorrect).length / folds.length

  return { folds, avgBeta, avgR2oos, avgIC, signCorrectRatio }
}
