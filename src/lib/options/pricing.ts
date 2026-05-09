export type OptionType = 'call' | 'put'
export type PremiumStatus = 'barata' | 'justa' | 'cara' | 'sin-datos'

export interface BlackScholesInput {
  type: OptionType
  spot: number
  strike: number
  timeToExpiryYears: number
  volatility: number
  riskFreeRate?: number
}

export interface BlackScholesResult {
  fairValue: number
  delta: number
  gamma: number
  theta: number
  vega: number
}

export function midPrice(input: { bid: number | null; ask: number | null; lastPrice: number | null }): number | null {
  const bid = toFinite(input.bid)
  const ask = toFinite(input.ask)
  if (bid != null && ask != null && bid > 0 && ask > 0 && ask >= bid) {
    return round((bid + ask) / 2, 4)
  }
  const last = toFinite(input.lastPrice)
  return last != null && last > 0 ? last : null
}

export function classifyPremium(marketPrice: number | null, fairValue: number | null): PremiumStatus {
  if (marketPrice == null || fairValue == null || fairValue <= 0) return 'sin-datos'
  const ratio = marketPrice / fairValue
  if (ratio <= 0.88) return 'barata'
  if (ratio >= 1.15) return 'cara'
  return 'justa'
}

export function probabilityITM(type: OptionType, delta: number | null): number | null {
  if (delta == null || !Number.isFinite(delta)) return null
  return Math.max(0, Math.min(100, Math.round(Math.abs(delta) * 100)))
}

export function blackScholes(input: BlackScholesInput): BlackScholesResult {
  const riskFreeRate = input.riskFreeRate ?? 0.045
  const spot = Math.max(input.spot, 0.0001)
  const strike = Math.max(input.strike, 0.0001)
  const t = Math.max(input.timeToExpiryYears, 1 / 365)
  const sigma = Math.max(input.volatility, 0.0001)
  const sqrtT = Math.sqrt(t)
  const d1 = (Math.log(spot / strike) + (riskFreeRate + (sigma * sigma) / 2) * t) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  const discount = Math.exp(-riskFreeRate * t)
  const pdfD1 = normalPdf(d1)
  const gamma = pdfD1 / (spot * sigma * sqrtT)
  const vega = (spot * pdfD1 * sqrtT) / 100

  if (input.type === 'call') {
    const fairValue = spot * normalCdf(d1) - strike * discount * normalCdf(d2)
    const theta = (-(spot * pdfD1 * sigma) / (2 * sqrtT) - riskFreeRate * strike * discount * normalCdf(d2)) / 365
    return {
      fairValue: round(Math.max(0, fairValue), 4),
      delta: round(normalCdf(d1), 4),
      gamma: round(gamma, 6),
      theta: round(theta, 6),
      vega: round(vega, 6),
    }
  }

  const fairValue = strike * discount * normalCdf(-d2) - spot * normalCdf(-d1)
  const theta = (-(spot * pdfD1 * sigma) / (2 * sqrtT) + riskFreeRate * strike * discount * normalCdf(-d2)) / 365
  return {
    fairValue: round(Math.max(0, fairValue), 4),
    delta: round(normalCdf(d1) - 1, 4),
    gamma: round(gamma, 6),
    theta: round(theta, 6),
    vega: round(vega, 6),
  }
}

export function yearsToExpiration(expiration: string, now = new Date()): number {
  const expiry = new Date(`${expiration}T21:00:00.000Z`)
  const ms = expiry.getTime() - now.getTime()
  return Math.max(ms / (365 * 24 * 60 * 60 * 1000), 1 / 365)
}

export function daysToExpiration(expiration: string, now = new Date()): number {
  const expiry = new Date(`${expiration}T21:00:00.000Z`)
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000))
}

function toFinite(value: number | null | undefined): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * abs)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs)
  return 0.5 * (1 + sign * erf)
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
