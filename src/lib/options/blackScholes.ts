import type { GreeksResult, OptionInput, PricingResult } from './types'

// ---------------------------------------------------------------------------
// Statistical primitives
// ---------------------------------------------------------------------------

/**
 * Standard normal CDF using Abramowitz & Stegun 26.2.17 approximation.
 * Max error: 7.5e-8
 */
export function standardNormalCDF(z: number): number {
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
 * Standard normal PDF: φ(x) = e^(-x²/2) / √(2π)
 */
export function standardNormalPDF(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)
}

// ---------------------------------------------------------------------------
// Black-Scholes core helpers
// ---------------------------------------------------------------------------

function computeD1D2(S: number, K: number, T: number, r: number, sigma: number): { d1: number; d2: number } {
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  return { d1, d2 }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Black-Scholes price for a European call or put.
 *
 * Edge cases:
 * - T <= 0 or sigma <= 0: returns intrinsic value only.
 */
export function blackScholesPrice(input: OptionInput): number {
  const { type, S, K, T, r, sigma } = input

  // Edge case: expired or zero vol → intrinsic value
  if (T <= 0 || sigma <= 0) {
    if (type === 'call') return Math.max(S - K, 0)
    return Math.max(K - S, 0)
  }

  const { d1, d2 } = computeD1D2(S, K, T, r, sigma)
  const discountedK = K * Math.exp(-r * T)

  if (type === 'call') {
    return S * standardNormalCDF(d1) - discountedK * standardNormalCDF(d2)
  } else {
    return discountedK * standardNormalCDF(-d2) - S * standardNormalCDF(-d1)
  }
}

/**
 * Compute all five Greeks for a European call or put.
 *
 * Units:
 *   theta  — per calendar day (divide by 365)
 *   vega   — per 1% move in implied vol (divide by 100)
 *   rho    — per 1% move in risk-free rate (divide by 100)
 */
export function computeGreeks(input: OptionInput): GreeksResult {
  const { type, S, K, T, r, sigma } = input

  // Edge case: expired or zero vol → intrinsic, no time value
  if (T <= 0 || sigma <= 0) {
    let delta: number
    if (type === 'call') {
      delta = S > K ? 1 : 0
    } else {
      delta = S < K ? -1 : 0
    }
    return { delta, gamma: 0, theta: 0, vega: 0, rho: 0 }
  }

  const sqrtT = Math.sqrt(T)
  const { d1, d2 } = computeD1D2(S, K, T, r, sigma)
  const Nd1 = standardNormalCDF(d1)
  const Nd2 = standardNormalCDF(d2)
  const nd1 = standardNormalPDF(d1)
  const discountedK = K * Math.exp(-r * T)

  // Gamma and Vega are identical for calls and puts
  const gamma = nd1 / (S * sigma * sqrtT)
  const vega = S * nd1 * sqrtT / 100

  if (type === 'call') {
    const delta = Nd1
    const theta = (-S * nd1 * sigma / (2 * sqrtT) - r * discountedK * Nd2) / 365
    const rho = K * T * discountedK * Nd2 / 100
    return { delta, gamma, theta, vega, rho }
  } else {
    const delta = Nd1 - 1
    const Nnd2 = standardNormalCDF(-d2)
    const theta = (-S * nd1 * sigma / (2 * sqrtT) + r * discountedK * Nnd2) / 365
    const rho = -K * T * discountedK * Nnd2 / 100
    return { delta, gamma, theta, vega, rho }
  }
}

/**
 * Combined pricing: returns price and all Greeks in one call.
 */
export function price(input: OptionInput): PricingResult {
  return {
    price: blackScholesPrice(input),
    greeks: computeGreeks(input),
  }
}
