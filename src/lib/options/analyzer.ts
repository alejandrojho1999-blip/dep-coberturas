import { fetchYahooOptionsAnalysis, type EnrichedOptionContract } from './yahoo-options'
import { fetchTechnicalZones, type TechnicalZones } from './technical-zones'
import {
  scoreOptionContract,
  type FundamentalBias,
  type StrategyKind,
  type StrategyScore,
} from './strategy-scoring'

export interface OptionsStrategyPick extends StrategyScore {
  contract: EnrichedOptionContract
  breakeven: number
  maxLossHint: string
  maxProfitHint: string
}

export interface OptionsAnalyzeResult {
  dataSource: string
  dataWarning: string
  underlying: Awaited<ReturnType<typeof fetchYahooOptionsAnalysis>>
  technicalZones: Omit<TechnicalZones, 'candles'> & { candlesCount: number }
  strategies: Record<StrategyKind, OptionsStrategyPick[]>
  recommendation: OptionsStrategyPick | null
  warnings: string[]
}

const STRATEGIES: StrategyKind[] = ['sell-put', 'covered-call', 'buy-call', 'buy-put']

const cache = new Map<string, { expiresAt: number; data: OptionsAnalyzeResult }>()
const CACHE_TTL_MS = 12 * 60 * 1000

export async function analyzeOptionsTicker(ticker: string): Promise<OptionsAnalyzeResult> {
  const symbol = ticker.toUpperCase().trim()
  const cached = cache.get(symbol)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const underlying = await fetchYahooOptionsAnalysis(symbol)
  const zones = await fetchTechnicalZones(symbol, underlying.underlyingPrice).catch(() => ({
    candles: [],
    support: null,
    resistance: null,
    sma50: null,
    sma200: null,
    range52WeekLow: null,
    range52WeekHigh: null,
    technicalBias: 'neutral' as const,
    notes: ['No se pudo cargar historico diario para zonas tecnicas.'],
  }))
  const fundamentalBias = getFundamentalBias(underlying)
  const warnings: string[] = [
    'Datos obtenidos desde Yahoo Finance no oficial; pueden estar demorados o incompletos.',
    'El sistema no ejecuta ordenes ni reemplaza confirmacion en broker.',
  ]

  if (underlying.underlyingPrice > 50) warnings.push('El subyacente supera $50; revisar si encaja con el plan de acciones pequenas.')
  if (!underlying.calls.length || !underlying.puts.length) warnings.push('Cadena de opciones incompleta.')

  const strategies = Object.fromEntries(STRATEGIES.map((strategy) => [
    strategy,
    rankStrategy(strategy, underlying, zones, fundamentalBias),
  ])) as Record<StrategyKind, OptionsStrategyPick[]>

  const recommendation = STRATEGIES
    .flatMap((strategy) => strategies[strategy])
    .sort((a, b) => b.score - a.score)[0] ?? null

  const data: OptionsAnalyzeResult = {
    dataSource: 'Yahoo Finance no oficial',
    dataWarning: 'Datos educativos. Validar bid/ask, griegas, earnings y liquidez en IBKR antes de operar.',
    underlying,
    technicalZones: {
      support: zones.support,
      resistance: zones.resistance,
      sma50: zones.sma50,
      sma200: zones.sma200,
      range52WeekLow: zones.range52WeekLow,
      range52WeekHigh: zones.range52WeekHigh,
      technicalBias: zones.technicalBias,
      notes: zones.notes,
      candlesCount: zones.candles.length,
    },
    strategies,
    recommendation,
    warnings,
  }
  cache.set(symbol, { expiresAt: Date.now() + CACHE_TTL_MS, data })
  return data
}

function rankStrategy(
  strategy: StrategyKind,
  underlying: Awaited<ReturnType<typeof fetchYahooOptionsAnalysis>>,
  zones: TechnicalZones,
  fundamentalBias: FundamentalBias,
): OptionsStrategyPick[] {
  const contracts = (strategy === 'sell-put' || strategy === 'buy-put' ? underlying.puts : underlying.calls)
    .filter((contract) => {
      const distance = Math.abs(contract.strike - underlying.underlyingPrice) / underlying.underlyingPrice
      return distance <= 0.25
    })

  return contracts
    .map((contract) => {
      const score = scoreOptionContract({
        strategy,
        contract,
        underlyingPrice: underlying.underlyingPrice,
        nearestSupport: zones.support,
        nearestResistance: zones.resistance,
        fundamentalBias,
      })
      return {
        ...score,
        contract,
        breakeven: getBreakeven(strategy, contract),
        maxLossHint: getMaxLossHint(strategy, contract),
        maxProfitHint: getMaxProfitHint(strategy, contract),
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

function getFundamentalBias(underlying: Awaited<ReturnType<typeof fetchYahooOptionsAnalysis>>): FundamentalBias {
  const f = underlying.fundamentals
  const targetUpside = f.targetMeanPrice && underlying.underlyingPrice
    ? (f.targetMeanPrice - underlying.underlyingPrice) / underlying.underlyingPrice
    : 0
  if ((f.analystConsensus === 'BUY' || targetUpside > 0.1) && (f.debtToEquity == null || f.debtToEquity < 2.5)) return 'bullish'
  if (f.analystConsensus === 'SELL' || targetUpside < -0.08) return 'bearish'
  return 'neutral'
}

function getBreakeven(strategy: StrategyKind, contract: EnrichedOptionContract): number {
  const premium = contract.mid ?? contract.lastPrice ?? 0
  if (strategy === 'sell-put') return contract.strike - premium
  if (strategy === 'covered-call') return contract.strike + premium
  if (strategy === 'buy-call') return contract.strike + premium
  return contract.strike - premium
}

function getMaxLossHint(strategy: StrategyKind, contract: EnrichedOptionContract): string {
  const premium = contract.mid ?? contract.lastPrice ?? 0
  if (strategy === 'sell-put') return `Asignacion efectiva aprox. $${((contract.strike - premium) * 100).toFixed(0)} por contrato`
  if (strategy === 'covered-call') return 'Riesgo principal: caida de las acciones mantenidas'
  return `Prima pagada aprox. $${(premium * 100).toFixed(0)} por contrato`
}

function getMaxProfitHint(strategy: StrategyKind, contract: EnrichedOptionContract): string {
  const premium = contract.mid ?? contract.lastPrice ?? 0
  if (strategy === 'sell-put' || strategy === 'covered-call') return `Prima aprox. $${(premium * 100).toFixed(0)} por contrato`
  return 'Ganancia variable si el movimiento direccional supera el breakeven'
}
