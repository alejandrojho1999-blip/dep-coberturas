import {
  matrix,
  multiply,
  transpose,
  inv,
  subtract,
  mean,
  sum,
  sqrt,
  abs,
} from 'mathjs'
import type { CausalConfig, DataRow, ModelComparison, OLSResult } from './types'

// ---------------------------------------------------------------------------
// t-distribution CDF approximation via regularised incomplete beta function
// Using the Abramowitz & Stegun continued-fraction approximation (good for
// |t| up to ~10 and dof >= 1).
// ---------------------------------------------------------------------------

/** Regularised incomplete beta function I_x(a, b) via continued fractions. */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1

  // Use symmetry relation when x > (a+1)/(a+b+2)
  const symmetryThreshold = (a + 1) / (a + b + 2)
  if (x > symmetryThreshold) {
    return 1 - incompleteBeta(1 - x, b, a)
  }

  // Log of the beta function via Stirling / lgamma
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b)
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a

  // Lentz continued-fraction method
  const TINY = 1e-30
  const MAX_ITER = 200
  const EPS = 3e-7

  let f = 1 + TINY
  let c = f
  let d = 0

  for (let m = 0; m <= MAX_ITER; m++) {
    // Even step (m=0 is the d1 term)
    for (let step = 0; step <= 1; step++) {
      let del: number
      if (step === 0 && m === 0) {
        del = 1
      } else if (step === 0) {
        del = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
      } else {
        del = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
      }

      d = 1 + del * d
      if (Math.abs(d) < TINY) d = TINY
      c = 1 + del / c
      if (Math.abs(c) < TINY) c = TINY
      d = 1 / d
      f *= c * d

      if (Math.abs(c * d - 1) < EPS) return front * (f - 1)
    }
  }

  return front * (f - 1)
}

/** Natural log of gamma via Lanczos approximation. */
function lgamma(z: number): number {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  }
  z -= 1
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i)
  }
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/**
 * CDF of the Student-t distribution with `dof` degrees of freedom.
 * Returns P(T <= t).
 */
function tCDF(t: number, dof: number): number {
  const x = dof / (dof + t * t)
  const ib = incompleteBeta(x, dof / 2, 0.5)
  return t >= 0 ? 1 - ib / 2 : ib / 2
}

// ---------------------------------------------------------------------------
// OLS regression
// ---------------------------------------------------------------------------

/**
 * Ordinary Least Squares regression.
 *
 * @param X  Design matrix (n × p) — first column MUST be a column of 1s for the intercept.
 * @param y  Response vector (length n).
 * @param predictorNames  Names for all p columns of X (first entry is typically 'intercept').
 */
export function olsRegression(
  X: number[][],
  y: number[],
  predictorNames: string[],
): OLSResult {
  const n = X.length
  const p = predictorNames.length // includes intercept

  if (predictorNames.length !== (X[0]?.length ?? 0)) {
    throw new Error(`predictorNames length (${predictorNames.length}) does not match X columns (${X[0]?.length})`)
  }

  if (n < p + 1) {
    throw new Error(
      `Not enough observations (n=${n}) for ${p} parameters. Need at least ${p + 1}.`,
    )
  }

  const yMean = (mean(y) as number)
  const sst = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0)
  if (sst < Number.EPSILON) throw new Error('Outcome has zero variance — all values are identical')

  // Use mathjs matrices
  const mX = matrix(X)
  const mY = matrix(y.map((v) => [v]))

  const Xt = transpose(mX)
  const XtX = multiply(Xt, mX)
  let XtXinvMatrix: ReturnType<typeof inv>
  try {
    XtXinvMatrix = inv(XtX)
  } catch {
    throw new Error('Design matrix is singular — check for collinear predictors or insufficient data')
  }
  const XtXinv: number[][] = (XtXinvMatrix as { toArray(): number[][] }).toArray()
  const Xty = multiply(Xt, mY)
  const betaMat = multiply(matrix(XtXinv), Xty) // p × 1

  const betaArr: number[] = (betaMat.toArray() as number[][]).map((row) => row[0])

  // Fitted values and residuals
  const fittedMat = multiply(mX, betaMat)
  const fittedArr: number[] = (fittedMat.toArray() as number[][]).map((row) => row[0])
  const residuals: number[] = y.map((yi, i) => yi - fittedArr[i])

  // SSR, SST
  const ssr = residuals.reduce((acc, r) => acc + r * r, 0)

  const r2 = sst === 0 ? 1 : 1 - ssr / sst
  const k = p - 1 // number of predictors excluding intercept
  const r2adj = 1 - (1 - r2) * ((n - 1) / (n - k - 1))

  // σ² = SSR / (n - k - 1)
  const sigma2 = ssr / (n - k - 1)

  // Var(β) = σ² (X'X)^-1
  const XtXinvArr: number[][] = XtXinv

  const coefficients: Record<string, number> = {}
  const standardErrors: Record<string, number> = {}
  const tStats: Record<string, number> = {}
  const pValues: Record<string, number> = {}

  const dof = n - k - 1

  for (let i = 0; i < p; i++) {
    const name = predictorNames[i]
    const beta = betaArr[i]
    const se = Math.sqrt(sigma2 * XtXinvArr[i][i])
    const t = beta / se
    const pVal = 2 * (1 - tCDF(Math.abs(t), dof))

    coefficients[name] = beta
    standardErrors[name] = se
    tStats[name] = t
    pValues[name] = pVal
  }

  return {
    coefficients,
    standardErrors,
    tStats,
    pValues,
    r2,
    r2adj,
    n,
    k,
    residuals,
    fittedValues: fittedArr,
  }
}

// ---------------------------------------------------------------------------
// Model comparison
// ---------------------------------------------------------------------------

/**
 * Build a design matrix from DataRow[] for the given variable names.
 * Returns { X, y } where X includes a leading intercept column.
 * Rows with any missing value are dropped.
 */
function buildMatrix(
  data: DataRow[],
  predictors: string[],
  outcome: string,
): { X: number[][]; y: number[]; names: string[] } {
  const X: number[][] = []
  const y: number[] = []

  for (const row of data) {
    const yVal = row[outcome]
    if (typeof yVal !== 'number' || !isFinite(yVal)) continue

    const xVals: number[] = []
    let valid = true
    for (const pred of predictors) {
      const v = row[pred]
      if (typeof v !== 'number' || !isFinite(v)) {
        valid = false
        break
      }
      xVals.push(v)
    }
    if (!valid) continue

    X.push([1, ...xVals])
    y.push(yVal)
  }

  return { X, y, names: ['intercept', ...predictors] }
}

/**
 * Compare three OLS models:
 *  - naive:        treatment only
 *  - withColliders: treatment + all excluded (collider) variables present in data
 *  - causal:       treatment + confounders (proper adjustment set)
 */
export function compareModels(data: DataRow[], config: CausalConfig): ModelComparison {
  const { treatment, outcome, confounders, excluded } = config

  // Determine which collider variables are actually present in data
  const colliderVars = Object.keys(excluded).filter((v) =>
    data.some((row) => typeof row[v] === 'number'),
  )

  // Compute intersection of valid rows across ALL variables used in any model
  const allVars = [treatment, outcome, ...confounders, ...colliderVars]
  const alignedData = data.filter((row) =>
    allVars.every((v) => typeof row[v] === 'number' && isFinite(row[v] as number)),
  )

  // --- naive ---
  const naiveInput = buildMatrix(alignedData, [treatment], outcome)
  const naive = olsRegression(naiveInput.X, naiveInput.y, naiveInput.names)

  // --- withColliders ---
  const withCollidersInput = buildMatrix(
    alignedData,
    [treatment, ...colliderVars],
    outcome,
  )
  const withColliders = olsRegression(
    withCollidersInput.X,
    withCollidersInput.y,
    withCollidersInput.names,
  )

  // --- causal ---
  const causalInput = buildMatrix(alignedData, [treatment, ...confounders], outcome)
  const causal = olsRegression(causalInput.X, causalInput.y, causalInput.names)

  // Sign flip: opposite signs in naive vs withColliders for treatment coefficient
  const naiveBeta = naive.coefficients[treatment]
  const colliderBeta = withColliders.coefficients[treatment]
  const signFlipDetected =
    naiveBeta !== undefined &&
    colliderBeta !== undefined &&
    Math.sign(naiveBeta) !== Math.sign(colliderBeta)

  return { naive, withColliders, causal, signFlipDetected }
}
