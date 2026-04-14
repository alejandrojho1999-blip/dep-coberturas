import { describe, it, expect } from 'vitest'
import { blackScholesPrice, computeGreeks, price, standardNormalCDF, standardNormalPDF } from './blackScholes'
import type { OptionInput } from './types'

// ---------------------------------------------------------------------------
// standardNormalCDF
// ---------------------------------------------------------------------------

describe('standardNormalCDF()', () => {
  it('returns 0.5 for z=0', () => {
    expect(standardNormalCDF(0)).toBeCloseTo(0.5, 5)
  })

  it('returns ~0.8413 for z=1', () => {
    expect(standardNormalCDF(1)).toBeCloseTo(0.8413, 4)
  })

  it('returns ~0.9772 for z=2', () => {
    expect(standardNormalCDF(2)).toBeCloseTo(0.9772, 4)
  })

  it('returns complement: Φ(-z) = 1 - Φ(z)', () => {
    const z = 1.5
    expect(standardNormalCDF(-z)).toBeCloseTo(1 - standardNormalCDF(z), 8)
  })
})

describe('standardNormalPDF()', () => {
  it('returns 1/sqrt(2π) at z=0', () => {
    expect(standardNormalPDF(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 8)
  })

  it('is symmetric: φ(-z) = φ(z)', () => {
    expect(standardNormalPDF(-1.5)).toBeCloseTo(standardNormalPDF(1.5), 10)
  })
})

// ---------------------------------------------------------------------------
// blackScholesPrice — known values
// ---------------------------------------------------------------------------

describe('blackScholesPrice()', () => {
  const aaplLikeCall: OptionInput = {
    type: 'call',
    S: 185,
    K: 190,
    T: 0.25,
    r: 0.053,
    sigma: 0.28,
  }

  it('AAPL-like call: price ≈ 9.19 (±0.10)', () => {
    // S=185 is OTM vs K=190; correct BS value is ~9.19, not the 7.92 stated in spec
    const p = blackScholesPrice(aaplLikeCall)
    expect(p).toBeGreaterThan(9.09)
    expect(p).toBeLessThan(9.29)
  })

  it('put-call parity: call - put = S - K*e^(-rT)', () => {
    const { S, K, T, r, sigma } = aaplLikeCall
    const callP = blackScholesPrice({ ...aaplLikeCall, type: 'call' })
    const putP  = blackScholesPrice({ ...aaplLikeCall, type: 'put' })
    const parity = S - K * Math.exp(-r * T)
    expect(callP - putP).toBeCloseTo(parity, 3)
  })

  // T=0 edge cases
  it('T=0 ITM call returns intrinsic value S-K', () => {
    const p = blackScholesPrice({ type: 'call', S: 200, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(p).toBeCloseTo(10, 6)
  })

  it('T=0 OTM put returns intrinsic value 0', () => {
    const p = blackScholesPrice({ type: 'put', S: 200, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(p).toBeCloseTo(0, 6)
  })

  it('T=0 ITM put returns intrinsic value K-S', () => {
    const p = blackScholesPrice({ type: 'put', S: 180, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(p).toBeCloseTo(10, 6)
  })

  // sigma=0 edge cases
  it('sigma=0 call returns intrinsic value', () => {
    const p = blackScholesPrice({ type: 'call', S: 200, K: 190, T: 0.5, r: 0.05, sigma: 0 })
    expect(p).toBeCloseTo(10, 5)
  })

  it('sigma=0 OTM call returns 0', () => {
    const p = blackScholesPrice({ type: 'call', S: 185, K: 190, T: 0.5, r: 0.05, sigma: 0 })
    expect(p).toBeCloseTo(0, 5)
  })
})

// ---------------------------------------------------------------------------
// computeGreeks — bounds and signs
// ---------------------------------------------------------------------------

describe('computeGreeks()', () => {
  const base: OptionInput = {
    type: 'call',
    S: 185,
    K: 190,
    T: 0.25,
    r: 0.053,
    sigma: 0.28,
  }

  it('call delta is between 0 and 1', () => {
    const g = computeGreeks(base)
    expect(g.delta).toBeGreaterThan(0)
    expect(g.delta).toBeLessThan(1)
  })

  it('put delta is between -1 and 0', () => {
    const g = computeGreeks({ ...base, type: 'put' })
    expect(g.delta).toBeGreaterThan(-1)
    expect(g.delta).toBeLessThan(0)
  })

  it('gamma is always positive', () => {
    expect(computeGreeks(base).gamma).toBeGreaterThan(0)
    expect(computeGreeks({ ...base, type: 'put' }).gamma).toBeGreaterThan(0)
  })

  it('vega is always positive', () => {
    expect(computeGreeks(base).vega).toBeGreaterThan(0)
    expect(computeGreeks({ ...base, type: 'put' }).vega).toBeGreaterThan(0)
  })

  it('theta is always negative (long options lose time value)', () => {
    expect(computeGreeks(base).theta).toBeLessThan(0)
    expect(computeGreeks({ ...base, type: 'put' }).theta).toBeLessThan(0)
  })

  it('ATM call delta ≈ 0.5', () => {
    const atm: OptionInput = { type: 'call', S: 100, K: 100, T: 0.5, r: 0.05, sigma: 0.2 }
    const g = computeGreeks(atm)
    expect(g.delta).toBeGreaterThan(0.48)
    expect(g.delta).toBeLessThan(0.60)
  })

  it('deep ITM call delta ≈ 1.0', () => {
    const deepItm: OptionInput = { type: 'call', S: 300, K: 100, T: 0.25, r: 0.05, sigma: 0.3 }
    const g = computeGreeks(deepItm)
    expect(g.delta).toBeGreaterThan(0.99)
  })

  it('T=0 call delta = 1 for ITM, 0 for OTM', () => {
    const itm = computeGreeks({ type: 'call', S: 200, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(itm.delta).toBe(1)
    const otm = computeGreeks({ type: 'call', S: 180, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(otm.delta).toBe(0)
  })

  it('T=0 put delta = -1 for ITM, 0 for OTM', () => {
    const itm = computeGreeks({ type: 'put', S: 180, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(itm.delta).toBe(-1)
    const otm = computeGreeks({ type: 'put', S: 200, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(otm.delta).toBe(0)
  })

  it('T=0 gamma, vega, rho, theta are all 0', () => {
    const g = computeGreeks({ type: 'call', S: 200, K: 190, T: 0, r: 0.05, sigma: 0.2 })
    expect(g.gamma).toBe(0)
    expect(g.vega).toBe(0)
    expect(g.rho).toBe(0)
    expect(g.theta).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// price() — combined result
// ---------------------------------------------------------------------------

describe('price()', () => {
  it('returns a PricingResult with price and greeks', () => {
    const input: OptionInput = { type: 'call', S: 185, K: 190, T: 0.25, r: 0.053, sigma: 0.28 }
    const result = price(input)
    expect(typeof result.price).toBe('number')
    expect(typeof result.greeks.delta).toBe('number')
    expect(typeof result.greeks.gamma).toBe('number')
    expect(typeof result.greeks.theta).toBe('number')
    expect(typeof result.greeks.vega).toBe('number')
    expect(typeof result.greeks.rho).toBe('number')
  })

  it('price matches blackScholesPrice()', () => {
    const input: OptionInput = { type: 'put', S: 185, K: 190, T: 0.25, r: 0.053, sigma: 0.28 }
    expect(price(input).price).toBeCloseTo(blackScholesPrice(input), 10)
  })
})
