import type { OptionType, PremiumStatus } from './pricing'

export type StrategyKind = 'sell-put' | 'covered-call' | 'buy-call' | 'buy-put'
export type FundamentalBias = 'bullish' | 'neutral' | 'bearish'
export type StrategyLabel = 'IDEAL' | 'ACEPTABLE' | 'CARO' | 'ILIQUIDO' | 'FUERA DE PLAN' | 'EVITAR'

export interface OptionContractForScoring {
  symbol: string
  type: OptionType
  strike: number
  expiration: string
  dte: number
  bid: number | null
  ask: number | null
  lastPrice: number | null
  impliedVolatility: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  openInterest: number | null
  volume: number | null
  fairValue: number | null
  premiumStatus: PremiumStatus
}

export interface StrategyScoreInput {
  strategy: StrategyKind
  contract: OptionContractForScoring
  underlyingPrice: number
  nearestSupport: number | null
  nearestResistance: number | null
  fundamentalBias: FundamentalBias
}

export interface StrategyScore {
  strategy: StrategyKind
  action: string
  score: number
  label: StrategyLabel
  reasons: string[]
  warnings: string[]
}

export function scoreOptionContract(input: StrategyScoreInput): StrategyScore {
  const { strategy, contract } = input
  const reasons: string[] = []
  const warnings: string[] = []
  let score = 50

  const spreadPct = getSpreadPct(contract)
  const liquid = (contract.openInterest ?? 0) >= 100 && (contract.volume ?? 0) >= 10 && spreadPct != null && spreadPct <= 0.25
  if (liquid) {
    score += 18
    reasons.push('Liquidez aceptable')
  } else {
    score -= 28
    warnings.push('Liquidez insuficiente')
  }

  if (contract.dte >= 30 && contract.dte <= 60) {
    score += 10
    reasons.push('Vencimiento dentro de ventana 30-60 DTE')
  } else if (contract.dte < 21) {
    score -= 18
    warnings.push('DTE corto: mayor gamma risk')
  } else {
    score -= 6
  }

  score += scoreDelta(strategy, contract.delta, warnings, reasons)
  score += scorePremium(strategy, contract.premiumStatus, warnings, reasons)
  score += scoreTechnicalLocation(input, warnings, reasons)
  score += scoreFundamentalBias(strategy, input.fundamentalBias, reasons)

  if (strategy === 'sell-put' && contract.type !== 'put') {
    score -= 45
    warnings.push('La estrategia requiere put')
  }
  if ((strategy === 'covered-call' || strategy === 'buy-call') && contract.type !== 'call') {
    score -= 45
    warnings.push('La estrategia requiere call')
  }
  if (strategy === 'buy-put' && contract.type !== 'put') {
    score -= 45
    warnings.push('La estrategia requiere put')
  }

  const liquidityCappedScore = liquid ? score : Math.min(score, 40)
  const boundedScore = Math.max(0, Math.min(100, Math.round(liquidityCappedScore)))
  return {
    strategy,
    action: strategyAction(strategy),
    score: boundedScore,
    label: labelForScore(boundedScore, warnings, contract.premiumStatus, liquid),
    reasons,
    warnings,
  }
}

export function strategyAction(strategy: StrategyKind): string {
  if (strategy === 'sell-put') return 'VENDER PUT'
  if (strategy === 'covered-call') return 'VENDER COVERED CALL'
  if (strategy === 'buy-call') return 'COMPRAR CALL'
  return 'COMPRAR PUT'
}

function scoreDelta(strategy: StrategyKind, delta: number | null, warnings: string[], reasons: string[]): number {
  if (delta == null) {
    warnings.push('Delta no disponible')
    return -6
  }
  const abs = Math.abs(delta)
  if (strategy === 'sell-put' || strategy === 'covered-call') {
    if (abs >= 0.2 && abs <= 0.35) {
      reasons.push('Delta ideal para venta de prima')
      return 14
    }
    warnings.push('Delta fuera del rango 0.20-0.35')
    return -10
  }
  if (abs >= 0.45 && abs <= 0.65) {
    reasons.push('Delta direccional razonable')
    return 14
  }
  warnings.push('Delta fuera del rango direccional 0.45-0.65')
  return -10
}

function scorePremium(strategy: StrategyKind, status: PremiumStatus, warnings: string[], reasons: string[]): number {
  if (status === 'sin-datos') {
    warnings.push('Fair value incompleto')
    return -5
  }
  const isSelling = strategy === 'sell-put' || strategy === 'covered-call'
  if (isSelling && status === 'cara') {
    reasons.push('Prima atractiva para vender')
    return 10
  }
  if (isSelling && status === 'barata') {
    warnings.push('Prima pobre para venta')
    return -10
  }
  if (!isSelling && status === 'barata') {
    reasons.push('Prima atractiva para compra')
    return 10
  }
  if (!isSelling && status === 'cara') {
    warnings.push('Prima cara para compra')
    return -10
  }
  reasons.push('Prima cerca de fair value')
  return 4
}

function scoreTechnicalLocation(input: StrategyScoreInput, warnings: string[], reasons: string[]): number {
  const { strategy, contract, underlyingPrice, nearestSupport, nearestResistance } = input
  if (strategy === 'sell-put') {
    if (nearestSupport != null && Math.abs(contract.strike - nearestSupport) / underlyingPrice <= 0.04) {
      reasons.push('Strike cerca de soporte estimado')
      return 14
    }
    warnings.push('Strike no esta cerca del soporte estimado')
    return -6
  }
  if (strategy === 'covered-call') {
    if (nearestResistance != null && Math.abs(contract.strike - nearestResistance) / underlyingPrice <= 0.05) {
      reasons.push('Strike cerca de resistencia estimada')
      return 14
    }
    warnings.push('Strike no esta cerca de resistencia estimada')
    return -6
  }
  if (strategy === 'buy-call') {
    if (nearestSupport != null && Math.abs(underlyingPrice - nearestSupport) / underlyingPrice <= 0.05) {
      reasons.push('Precio cerca de soporte estimado')
      return 12
    }
    warnings.push('No esta comprando cerca de soporte')
    return -5
  }
  if (nearestResistance != null && Math.abs(underlyingPrice - nearestResistance) / underlyingPrice <= 0.05) {
    reasons.push('Precio cerca de resistencia estimada')
    return 12
  }
  warnings.push('No esta comprando put cerca de resistencia')
  return -5
}

function scoreFundamentalBias(strategy: StrategyKind, bias: FundamentalBias, reasons: string[]): number {
  if ((strategy === 'sell-put' || strategy === 'buy-call') && bias === 'bullish') {
    reasons.push('Fundamentos alineados al sesgo alcista')
    return 8
  }
  if ((strategy === 'covered-call' || strategy === 'buy-put') && bias === 'bearish') {
    reasons.push('Fundamentos alineados al sesgo bajista/neutro')
    return 8
  }
  if (bias === 'neutral') return 0
  return -5
}

function getSpreadPct(contract: OptionContractForScoring): number | null {
  const bid = contract.bid
  const ask = contract.ask
  if (bid == null || ask == null || bid <= 0 || ask <= 0 || ask < bid) return null
  return (ask - bid) / ((ask + bid) / 2)
}

function labelForScore(score: number, warnings: string[], premium: PremiumStatus, liquid: boolean): StrategyLabel {
  if (!liquid) return 'EVITAR'
  if (score < 45) return 'EVITAR'
  if (warnings.some((w) => w.includes('Delta fuera') || w.includes('DTE corto'))) return 'FUERA DE PLAN'
  if (premium === 'cara' && score < 75) return 'CARO'
  if (score >= 75) return 'IDEAL'
  return 'ACEPTABLE'
}
