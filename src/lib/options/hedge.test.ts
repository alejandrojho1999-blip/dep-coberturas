import { describe, it, expect } from 'vitest'
import { positionDelta, portfolioDelta, analyzeHedge } from './hedge'
import type { HedgePosition, OptionInput } from './types'

describe('positionDelta', () => {
  it('long 100 shares → delta = 100', () => {
    const pos: HedgePosition = { type: 'stock', quantity: 100, S: 100 }
    expect(positionDelta(pos)).toBeCloseTo(100, 5)
  })

  it('long 1 call with delta ~0.5 → delta ≈ 50', () => {
    // ATM call with typical params has delta ~0.5
    const pos: HedgePosition = {
      type: 'call',
      quantity: 1,
      S: 100,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
    }
    const delta = positionDelta(pos)
    // ATM call delta is around 0.5–0.6, times 100 = 50–60
    expect(delta).toBeGreaterThan(40)
    expect(delta).toBeLessThan(70)
  })

  it('short 2 puts with delta -0.4 → positive delta contribution', () => {
    // Put has negative delta. Short 2 puts: quantity = -2, delta ≈ -0.4 per share
    // positionDelta = -2 * (-0.4) * 100 = +80
    const pos: HedgePosition = {
      type: 'put',
      quantity: -2,
      S: 110,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
    }
    const delta = positionDelta(pos)
    // OTM put has delta between 0 and -0.5, so short 2 contracts → positive
    expect(delta).toBeGreaterThan(0)
  })

  it('short 2 puts with exact delta -0.4 produce +80 delta', () => {
    // Use params that produce a delta close to -0.4 for the put
    // sigma=0.2, T=1, S=100, K=100 → put delta ≈ -(1-0.638) ≈ -0.362
    // We can compute and verify the sign and scale
    const pos: HedgePosition = {
      type: 'put',
      quantity: -2,
      S: 100,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
    }
    const delta = positionDelta(pos)
    // put delta is negative, quantity -2, so result should be positive
    expect(delta).toBeGreaterThan(0)
    // should be roughly 2 * |putDelta| * 100
    expect(delta).toBeCloseTo(2 * 0.362 * 100, 0)
  })
})

describe('portfolioDelta', () => {
  it('sums position deltas correctly', () => {
    const positions: HedgePosition[] = [
      { type: 'stock', quantity: 100, S: 100 },
      { type: 'stock', quantity: -50, S: 100 },
    ]
    expect(portfolioDelta(positions)).toBeCloseTo(50, 5)
  })

  it('sums stock and option deltas', () => {
    const positions: HedgePosition[] = [
      { type: 'stock', quantity: 200, S: 100 },
      { type: 'call', quantity: -1, S: 100, K: 100, T: 1, r: 0.05, sigma: 0.2 },
    ]
    const total = portfolioDelta(positions)
    // 200 - (callDelta * 100) ≈ 200 - 63.8 ≈ 136
    expect(total).toBeGreaterThan(100)
    expect(total).toBeLessThan(200)
  })
})

describe('analyzeHedge', () => {
  const baseOption: OptionInput = {
    type: 'call',
    S: 100,
    K: 100,
    T: 1,
    r: 0.05,
    sigma: 0.2,
  }

  const positions: HedgePosition[] = [
    {
      type: 'call',
      quantity: 1,
      S: 100,
      K: 100,
      T: 1,
      r: 0.05,
      sigma: 0.2,
    },
  ]

  it('contractsToHedge is negative when portfolio has positive delta (need to sell calls)', () => {
    // Long 1 call → positive portfolio delta
    // To hedge, need to sell calls → contractsToHedge < 0
    const analysis = analyzeHedge(positions, baseOption)
    expect(analysis.portfolioDelta).toBeGreaterThan(0)
    expect(analysis.contractsToHedge).toBeLessThan(0)
  })

  it('returns exactly 6 scenarios', () => {
    const analysis = analyzeHedge(positions, baseOption)
    expect(analysis.scenarios).toHaveLength(6)
  })

  it('scenario price changes are -20%, -10%, -5%, +5%, +10%, +20%', () => {
    const analysis = analyzeHedge(positions, baseOption)
    const changes = analysis.scenarios.map((s) => s.priceChange)
    expect(changes).toEqual([-0.20, -0.10, -0.05, 0.05, 0.10, 0.20])
  })

  it('long call has positive P&L when price rises', () => {
    const analysis = analyzeHedge(positions, baseOption)
    const up20 = analysis.scenarios.find((s) => s.priceChange === 0.20)!
    expect(up20.pnl).toBeGreaterThan(0)
  })

  it('long call has negative P&L when price drops', () => {
    const analysis = analyzeHedge(positions, baseOption)
    const down20 = analysis.scenarios.find((s) => s.priceChange === -0.20)!
    expect(down20.pnl).toBeLessThan(0)
  })

  it('contractsToHedge ≈ -1 when hedging a single long call with the same call', () => {
    // portfolioDelta = 1 * delta * 100
    // hedgeDelta = delta * 100
    // contractsToHedge = -portfolioDelta / (hedgeDelta) = -1
    const analysis = analyzeHedge(positions, baseOption)
    expect(analysis.contractsToHedge).toBeCloseTo(-1, 5)
  })
})
