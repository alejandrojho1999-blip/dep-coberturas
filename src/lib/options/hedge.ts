import { computeGreeks, blackScholesPrice } from './blackScholes'
import type { HedgePosition, HedgeAnalysis, OptionInput } from './types'

/**
 * Compute delta of a single position.
 * - For 'stock': delta = quantity * 1.0 (each share has delta 1)
 * - For 'call' or 'put': delta = quantity * computeGreeks(input).delta * 100 (1 contract = 100 shares)
 */
export function positionDelta(pos: HedgePosition): number {
  if (pos.type === 'stock') {
    return pos.quantity * 1.0
  }

  const input: OptionInput = {
    type: pos.type,
    S: pos.S,
    K: pos.K!,
    T: pos.T!,
    r: pos.r!,
    sigma: pos.sigma!,
  }
  const greeks = computeGreeks(input)
  return pos.quantity * greeks.delta * 100
}

/**
 * Compute portfolio delta (sum of all position deltas).
 */
export function portfolioDelta(positions: HedgePosition[]): number {
  return positions.reduce((sum, pos) => sum + positionDelta(pos), 0)
}

/**
 * Compute hedge analysis for a portfolio.
 *
 * Given positions and a hedging option (the option to use for hedging):
 * - portfolioDelta: total delta of all positions
 * - contractsToHedge: how many option contracts needed to make delta neutral
 *   = -portfolioDelta / (hedgingOption delta * 100)
 *   (negative = sell contracts, positive = buy contracts)
 * - scenarios: P&L at +/-5%, +/-10%, +/-20% price changes
 *   Delta approximation: P&L ≈ positionDelta * S * priceChangePct
 */
export function analyzeHedge(
  positions: HedgePosition[],
  hedgingOption: OptionInput,
): HedgeAnalysis {
  const totalDelta = portfolioDelta(positions)

  const hedgeOptionDelta = computeGreeks(hedgingOption).delta
  const contractsToHedge = -totalDelta / (hedgeOptionDelta * 100)

  const priceChanges = [-0.20, -0.10, -0.05, 0.05, 0.10, 0.20]

  const scenarios = priceChanges.map((priceChangePct) => {
    let pnl = 0
    for (const pos of positions) {
      if (pos.type === 'stock') {
        // Stock P&L: quantity * S * priceChangePct
        pnl += pos.quantity * pos.S * priceChangePct
      } else {
        // Option P&L using Black-Scholes price at new S
        const optInput: OptionInput = {
          type: pos.type,
          S: pos.S,
          K: pos.K!,
          T: pos.T!,
          r: pos.r!,
          sigma: pos.sigma!,
        }
        const newS = pos.S * (1 + priceChangePct)
        const newOptInput: OptionInput = { ...optInput, S: newS }
        const originalPrice = blackScholesPrice(optInput)
        const newPrice = blackScholesPrice(newOptInput)
        pnl += pos.quantity * (newPrice - originalPrice) * 100
      }
    }
    return { priceChange: priceChangePct, pnl }
  })

  return {
    portfolioDelta: totalDelta,
    contractsToHedge,
    scenarios,
  }
}
