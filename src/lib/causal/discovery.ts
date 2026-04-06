/**
 * Statistical foundation for PC causal discovery algorithm.
 * Implements partial correlation and Fisher's Z conditional independence test.
 */

/**
 * Standard normal CDF using Abramowitz & Stegun 26.2.17 approximation.
 * Max error: 7.5e-8
 */
function standardNormalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const pdf = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)
  const cdf = 1 - pdf * poly
  return z >= 0 ? cdf : 1 - cdf
}

/**
 * Compute the sample Pearson correlation between two arrays.
 * Returns NaN if either array has zero variance.
 */
export function correlation(x: number[], y: number[]): number {
  const n = x.length
  if (n !== y.length || n === 0) return NaN

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let covXY = 0
  let varX = 0
  let varY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    covXY += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX === 0 || varY === 0) return NaN

  return covXY / Math.sqrt(varX * varY)
}

/**
 * Compute partial correlation of X and Y given conditioning set S.
 * Uses the recursive formula:
 *   ρ(X,Y|S) = (ρ(X,Y|S\{z}) - ρ(X,z|S\{z}) * ρ(Y,z|S\{z})) /
 *              sqrt((1 - ρ(X,z|S\{z})²) * (1 - ρ(Y,z|S\{z})²))
 * Base case (S empty): returns correlation(X, Y)
 */
export function partialCorrelation(
  data: Record<string, number[]>,
  x: string,
  y: string,
  condSet: string[]
): number {
  // Base case: no conditioning variables
  if (condSet.length === 0) {
    return correlation(data[x], data[y])
  }

  // Pick last element as the variable to condition on recursively
  const z = condSet[condSet.length - 1]
  const remaining = condSet.slice(0, condSet.length - 1)

  const rhoXY = partialCorrelation(data, x, y, remaining)
  const rhoXZ = partialCorrelation(data, x, z, remaining)
  const rhoYZ = partialCorrelation(data, y, z, remaining)

  const denominator = Math.sqrt((1 - rhoXZ * rhoXZ) * (1 - rhoYZ * rhoYZ))

  if (denominator === 0) return NaN

  return (rhoXY - rhoXZ * rhoYZ) / denominator
}

/**
 * Fisher's Z conditional independence test.
 * Tests H0: X ⊥⊥ Y | S (X is conditionally independent of Y given S)
 *
 * Z-statistic: Z = atanh(ρ) * sqrt(n - |S| - 3)
 * Under H0, Z ~ N(0, 1)
 * p-value = 2 * (1 - Φ(|Z|))
 *
 * For |S| + 3 >= n, the test is unreliable — returns p=1 (cannot reject).
 */
export function fisherZTest(
  data: Record<string, number[]>,
  x: string,
  y: string,
  condSet: string[],
  n: number,
  alpha = 0.05
): { pValue: number; zStat: number; isIndependent: boolean } {
  // Guard: not enough degrees of freedom
  if (condSet.length + 3 >= n) {
    return { pValue: 1, zStat: 0, isIndependent: true }
  }

  const rho = partialCorrelation(data, x, y, condSet)

  if (isNaN(rho)) {
    return { pValue: 1, zStat: 0, isIndependent: true }
  }

  // Clamp rho to avoid atanh singularity at ±1
  const rhoSafe = Math.max(-0.9999999, Math.min(0.9999999, rho))
  const zStat = Math.atanh(rhoSafe) * Math.sqrt(n - condSet.length - 3)
  const pValue = 2 * (1 - standardNormalCDF(Math.abs(zStat)))
  const isIndependent = pValue >= alpha

  return { pValue, zStat, isIndependent }
}
