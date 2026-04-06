import type { OLSResult, MultipleTestingResult, DataRow, CausalConfig } from './types'
import { olsRegression } from './estimation'

// ---------------------------------------------------------------------------
// Seeded LCG pseudo-random for reproducibility (matches Python seed=42 behavior)
// ---------------------------------------------------------------------------

function makeLCG(seed: number) {
  let s = seed >>> 0
  return function rand(): number {
    // Numerical Recipes LCG
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

/** Fisher-Yates shuffle using provided RNG */
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------------------------------------------------------------------------
// Placebo permutation test
// ---------------------------------------------------------------------------

/**
 * Placebo permutation test for the treatment effect.
 *
 * Algorithm:
 * 1. Record β_real = model.coefficients[treatment]
 * 2. Repeat N=1000 times:
 *    a. Permute the treatment column randomly (breaks causal link)
 *    b. Fit OLS with same adjustment set
 *    c. Record β_placebo
 * 3. p_value = proportion of |β_placebo| >= |β_real|
 *
 * Uses seeded pseudo-random for reproducibility (seed=42 per Python original).
 */
export function placeboPermutation(
  data: DataRow[],
  config: CausalConfig,
  adjustmentSet: string[],
  model: OLSResult,
  nPermutations = 1000,
  seed = 42
): { placeboBetas: number[]; placeboP: number } {
  const { treatment, outcome } = config
  const predictors = [treatment, ...adjustmentSet]
  const colNames = ['intercept', ...predictors]

  // Filter clean rows
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
  const betaReal = model.coefficients[treatment] ?? 0
  const absBetaReal = Math.abs(betaReal)

  const treatmentValues = cleanData.map((row) => row[treatment] as number)
  const y = cleanData.map((row) => row[outcome] as number)

  const rand = makeLCG(seed)
  const placeboBetas: number[] = []
  let countExtreme = 0

  for (let iter = 0; iter < nPermutations; iter++) {
    const permuted = shuffle(treatmentValues, rand)

    // Build design matrix with permuted treatment
    const X: number[][] = cleanData.map((row, i) => [
      1,
      permuted[i],
      ...adjustmentSet.map((v) => row[v] as number),
    ])

    let placeboModel: OLSResult
    try {
      placeboModel = olsRegression(X, y, colNames)
    } catch {
      placeboBetas.push(0)
      continue
    }

    const betaPlacebo = placeboModel.coefficients[treatment] ?? 0
    placeboBetas.push(betaPlacebo)
    if (Math.abs(betaPlacebo) >= absBetaReal) countExtreme++
  }

  const placeboP = placeboBetas.length > 0 ? countExtreme / placeboBetas.length : 1

  return { placeboBetas, placeboP }
}

// ---------------------------------------------------------------------------
// Benjamini-Hochberg FDR correction
// ---------------------------------------------------------------------------

/**
 * Benjamini-Hochberg FDR correction.
 * Returns true if ANY test is significant after BH correction at fdr level.
 *
 * Algorithm:
 * 1. Sort p-values ascending
 * 2. For each k (1-indexed): reject if p[k] <= k/m * fdr
 * 3. Return true if any hypothesis is rejected
 */
export function benjaminiHochberg(pValues: number[], fdr = 0.05): boolean {
  const m = pValues.length
  if (m === 0) return false

  // Sort with original indices preserved, ascending
  const sorted = pValues.slice().sort((a, b) => a - b)

  for (let k = 0; k < m; k++) {
    const threshold = ((k + 1) / m) * fdr
    if (sorted[k] <= threshold) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Decision Sharpe Ratio
// ---------------------------------------------------------------------------

/**
 * Decision Sharpe Ratio (DSR) — from López de Prado.
 * DSR = sqrt(max(R², 0.0001)) * sqrt(n)
 *
 * Uses max(R²_adj, 0.0001) to avoid NaN when R²_adj is negative.
 */
export function computeDSR(model: OLSResult): number {
  const r2safe = Math.max(model.r2adj, 0.0001)
  return Math.sqrt(r2safe) * Math.sqrt(model.n)
}

// ---------------------------------------------------------------------------
// Run all Step 7 multiple testing procedures
// ---------------------------------------------------------------------------

/**
 * Run all Step 7 multiple testing procedures.
 */
export function runMultipleTesting(
  data: DataRow[],
  config: CausalConfig,
  adjustmentSet: string[],
  model: OLSResult,
  nPermutations = 1000
): MultipleTestingResult {
  const { placeboBetas, placeboP } = placeboPermutation(
    data,
    config,
    adjustmentSet,
    model,
    nPermutations
  )

  const dsr = computeDSR(model)

  // Collect all relevant p-values for BH correction
  // Include treatment p-value and all confounder p-values from the model
  const pValues: number[] = []
  for (const v of [config.treatment, ...adjustmentSet]) {
    const p = model.pValues[v]
    if (p !== undefined && isFinite(p)) pValues.push(p)
  }
  // Also include the placebo p-value itself
  pValues.push(placeboP)

  const bhFdrRejected = benjaminiHochberg(pValues)

  return { placeboBetas, placeboP, dsr, bhFdrRejected }
}
