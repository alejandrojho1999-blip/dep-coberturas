import type { EnrichedOptionContract } from './yahoo-options'

export type StrategyKind = 'sell-put' | 'covered-call' | 'buy-call' | 'buy-put'
export type FundamentalBias = 'bullish' | 'neutral' | 'bearish'

export interface StrategyScore {
  strategy: StrategyKind
  action: string
  score: number
  label: string
  reasons: string[]
  warnings: string[]
}

interface ScoreContext {
  strategy: StrategyKind
  contract: EnrichedOptionContract
  underlyingPrice: number
  nearestSupport: number | null
  nearestResistance: number | null
  fundamentalBias: FundamentalBias
}

export function scoreOptionContract(context: ScoreContext): StrategyScore {
  const { strategy, contract, underlyingPrice, nearestSupport, nearestResistance, fundamentalBias } = context
  
  let score = 0
  const reasons: string[] = []
  const warnings: string[] = []

  // Liquidez (máximo 25 puntos)
  const liquidityScore = calculateLiquidityScore(contract)
  score += liquidityScore
  if (liquidityScore >= 20) reasons.push('Excelente liquidez (OI alto, spread bajo)')
  else if (liquidityScore >= 15) reasons.push('Buena liquidez')
  else warnings.push('Liquidez limitada')

  // DTE (máximo 20 puntos)
  const dteScore = calculateDteScore(contract.dte)
  score += dteScore
  if (dteScore >= 15) reasons.push('DTE ideal (30-60 días)')
  else if (dteScore >= 10) reasons.push('DTE aceptable')
  else warnings.push('DTE fuera de rango preferido')

  // Delta (máximo 15 puntos)
  const deltaScore = calculateDeltaScore(strategy, contract.delta)
  score += deltaScore
  if (deltaScore >= 12) reasons.push('Delta en rango objetivo')
  else warnings.push('Delta fuera de rango preferido')

  // Prima vs fair value (máximo 15 puntos)
  const premiumScore = calculatePremiumScore(contract)
  score += premiumScore
  if (premiumScore >= 12) reasons.push('Prima favorable vs fair value')
  else if (premiumScore >= 8) reasons.push('Prima razonable')
  else warnings.push('Prima cara vs fair value')

  // Ubicación técnica (máximo 15 puntos)
  const technicalScore = calculateTechnicalScore(strategy, contract.strike, underlyingPrice, nearestSupport, nearestResistance)
  score += technicalScore
  if (technicalScore >= 12) reasons.push('Ubicación técnica favorable')
  else if (technicalScore >= 8) reasons.push('Ubicación técnica aceptable')

  // Sesgo fundamental (máximo 10 puntos)
  const fundamentalScore = calculateFundamentalScore(strategy, fundamentalBias)
  score += fundamentalScore
  if (fundamentalScore >= 8) reasons.push('Alineado con sesgo fundamental')

  // Determinar label
  const label = getScoreLabel(score)
  
  // Crear acción descriptiva
  const action = getActionDescription(strategy, contract)

  return {
    strategy,
    action,
    score: Math.round(score),
    label,
    reasons,
    warnings,
  }
}

function calculateLiquidityScore(contract: EnrichedOptionContract): number {
  let score = 0
  
  // Open Interest
  if (contract.openInterest && contract.openInterest >= 1000) score += 10
  else if (contract.openInterest && contract.openInterest >= 500) score += 7
  else if (contract.openInterest && contract.openInterest >= 100) score += 4
  
  // Volume
  if (contract.volume && contract.volume >= 100) score += 10
  else if (contract.volume && contract.volume >= 50) score += 7
  else if (contract.volume && contract.volume >= 10) score += 4
  
  // Spread
  if (contract.spreadPct && contract.spreadPct <= 0.05) score += 5
  else if (contract.spreadPct && contract.spreadPct <= 0.10) score += 3
  else if (contract.spreadPct && contract.spreadPct <= 0.25) score += 1
  
  return Math.min(score, 25)
}

function calculateDteScore(dte: number): number {
  if (dte >= 30 && dte <= 60) return 20 // Ideal
  if (dte >= 15 && dte <= 90) return 15 // Aceptable
  if (dte >= 7 && dte <= 120) return 10 // Mínimo
  return 5 // Fuera de rango
}

function calculateDeltaScore(strategy: StrategyKind, delta: number | null): number {
  if (!delta) return 5
  
  const absDelta = Math.abs(delta)
  
  if (strategy === 'sell-put' || strategy === 'covered-call') {
    if (absDelta >= 0.20 && absDelta <= 0.35) return 15 // Ideal para venta
    if (absDelta >= 0.15 && absDelta <= 0.45) return 12 // Aceptable
    return 8 // Fuera de rango
  } else {
    if (absDelta >= 0.45 && absDelta <= 0.65) return 15 // Ideal para compra
    if (absDelta >= 0.35 && absDelta <= 0.75) return 12 // Aceptable
    return 8 // Fuera de rango
  }
}

function calculatePremiumScore(contract: EnrichedOptionContract): number {
  if (!contract.fairValue || !contract.mid) return 7
  
  const premiumRatio = contract.mid / contract.fairValue
  
  if (premiumRatio <= 0.9) return 15 // Barata
  if (premiumRatio <= 1.1) return 12 // Justa
  if (premiumRatio <= 1.3) return 8 // Cara
  return 5 // Muy cara
}

function calculateTechnicalScore(
  strategy: StrategyKind,
  strike: number,
  underlyingPrice: number,
  support: number | null,
  resistance: number | null
): number {
  const distanceToStrike = Math.abs(strike - underlyingPrice) / underlyingPrice
  
  if (strategy === 'sell-put') {
    if (support && strike <= support * 1.02) return 15 // Cerca del soporte
    if (distanceToStrike <= 0.05) return 12 // Cerca del precio actual
    return 8 // Lejos
  } else if (strategy === 'covered-call') {
    if (resistance && strike >= resistance * 0.98) return 15 // Cerca de la resistencia
    if (distanceToStrike <= 0.05) return 12 // Cerca del precio actual
    return 8 // Lejos
  } else {
    // Para estrategias direccionales
    if (distanceToStrike <= 0.10) return 12 // Strike razonable
    return 8 // Strike lejano
  }
}

function calculateFundamentalScore(strategy: StrategyKind, bias: FundamentalBias): number {
  if (bias === 'neutral') return 5
  
  const isBullishStrategy = strategy === 'buy-call' || strategy === 'sell-put'
  const isBearishStrategy = strategy === 'buy-put' || strategy === 'covered-call'
  
  if ((isBullishStrategy && bias === 'bullish') || (isBearishStrategy && bias === 'bearish')) {
    return 10 // Perfecta alineación
  }
  
  return 3 // Contrario al sesgo
}

function getScoreLabel(score: number): string {
  if (score >= 75) return 'IDEAL'
  if (score >= 45) return 'ACEPTABLE'
  if (score >= 30) return 'CARO'
  return 'EVITAR'
}

function getActionDescription(strategy: StrategyKind, contract: EnrichedOptionContract): string {
  const strike = contract.strike
  const type = contract.type === 'call' ? 'Call' : 'Put'
  
  switch (strategy) {
    case 'sell-put':
      return `Vender Put ${strike}`
    case 'covered-call':
      return `Vender Covered Call ${strike}`
    case 'buy-call':
      return `Comprar Call ${strike}`
    case 'buy-put':
      return `Comprar Put ${strike}`
    default:
      return `${type} ${strike}`
  }
}