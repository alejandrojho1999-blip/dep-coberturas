export type OptionType = 'call' | 'put'

export interface OptionInput {
  type: OptionType
  S: number  // spot price
  K: number  // strike price
  T: number  // time to expiry in years
  r: number  // risk-free rate (e.g. 0.05 = 5%)
  sigma: number  // volatility (e.g. 0.25 = 25%)
}

export interface GreeksResult {
  delta: number   // ∂V/∂S
  gamma: number   // ∂²V/∂S²
  theta: number   // ∂V/∂t per day (negative for long options)
  vega: number    // ∂V/∂σ per 1% move in vol
  rho: number     // ∂V/∂r per 1% move in rates
}

export interface PricingResult {
  price: number
  greeks: GreeksResult
}

export interface HedgePosition {
  type: 'stock' | 'call' | 'put'
  quantity: number   // positive = long, negative = short
  S: number          // spot (for stock) or OptionInput params
  K?: number
  T?: number
  r?: number
  sigma?: number
}

export interface HedgeAnalysis {
  portfolioDelta: number
  contractsToHedge: number  // options contracts needed (negative = sell)
  scenarios: Array<{ priceChange: number; pnl: number }>
}
