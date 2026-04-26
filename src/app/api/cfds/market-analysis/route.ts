import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
import { NextRequest, NextResponse } from 'next/server'

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskProfile = 'conservador' | 'moderado' | 'agresivo'
type MarketSignal = 'COMPRA' | 'VENTA' | 'NEUTRAL'
type RiskLevel = 'BAJO' | 'MEDIO' | 'MODERADO' | 'ALTO'
type AssetCategory = 'Acciones' | 'Crypto' | 'Divisas' | 'Materiales' | 'Índices'
type MarketBias = 'ALCISTA' | 'BAJISTA' | 'NEUTRAL'

interface AssetConfig {
  ticker: string
  name: string
  category: AssetCategory
  riskLevel: RiskLevel
}

export interface AssetAnalysis {
  ticker: string
  name: string
  category: AssetCategory
  signal: MarketSignal
  price: number
  changePercent24h: number
  confidence: number
  reason: string
  riskLevel: RiskLevel
  score: number
}

export interface MarketAnalysisResponse {
  riskProfile: RiskProfile
  marketBias: MarketBias
  marketNarrative: string
  opportunity: string
  riskAlert: string
  rankings: AssetAnalysis[]
  byCategory: Record<AssetCategory, AssetAnalysis[]>
  portfolioDistribution: Record<AssetCategory, number>
  analyzedAt: string
  assetsAnalyzed: number
  assetsFailed: number
}

// ── Asset universe ────────────────────────────────────────────────────────────

const ASSET_UNIVERSE: AssetConfig[] = [
  // Acciones
  { ticker: 'AAPL',     name: 'Apple',         category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'MSFT',     name: 'Microsoft',     category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'AMZN',     name: 'Amazon',        category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'NVDA',     name: 'Nvidia',        category: 'Acciones',   riskLevel: 'ALTO' },
  { ticker: 'META',     name: 'Meta',          category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'GOOGL',    name: 'Alphabet',      category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'TSLA',     name: 'Tesla',         category: 'Acciones',   riskLevel: 'ALTO' },
  // Crypto
  { ticker: 'BTC-USD',  name: 'Bitcoin',       category: 'Crypto',     riskLevel: 'ALTO' },
  { ticker: 'ETH-USD',  name: 'Ethereum',      category: 'Crypto',     riskLevel: 'ALTO' },
  { ticker: 'BNB-USD',  name: 'BNB',           category: 'Crypto',     riskLevel: 'MEDIO' },
  { ticker: 'XRP-USD',  name: 'XRP',           category: 'Crypto',     riskLevel: 'ALTO' },
  // Divisas
  { ticker: 'EURUSD=X', name: 'EUR/USD',       category: 'Divisas',    riskLevel: 'MODERADO' },
  { ticker: 'DX-Y.NYB', name: 'Índice Dólar (DXY)', category: 'Divisas', riskLevel: 'MODERADO' },
  { ticker: 'GBPUSD=X', name: 'GBP/USD',       category: 'Divisas',    riskLevel: 'MODERADO' },
  { ticker: 'USDJPY=X', name: 'USD/JPY',        category: 'Divisas',    riskLevel: 'ALTO' },
  { ticker: 'USDCAD=X', name: 'USD/CAD',        category: 'Divisas',    riskLevel: 'ALTO' },
  // Materiales
  { ticker: 'GC=F',     name: 'Oro',            category: 'Materiales', riskLevel: 'BAJO' },
  { ticker: 'SI=F',     name: 'Plata',          category: 'Materiales', riskLevel: 'MEDIO' },
  // Índices
  { ticker: '^GSPC',    name: 'S&P 500',        category: 'Índices',    riskLevel: 'BAJO' },
  { ticker: '^NDX',     name: 'NASDAQ 100',     category: 'Índices',    riskLevel: 'MEDIO' },
  { ticker: '^DJI',     name: 'Dow Jones',      category: 'Índices',    riskLevel: 'BAJO' },
]

// ── Portfolio distribution by risk profile ────────────────────────────────────

const PORTFOLIO_DISTRIBUTION: Record<RiskProfile, Record<AssetCategory, number>> = {
  conservador: { Índices: 40, Materiales: 30, Divisas: 20, Acciones: 10, Crypto: 0 },
  moderado:    { Acciones: 35, Índices: 25, Materiales: 20, Divisas: 15, Crypto: 5 },
  agresivo:    { Acciones: 35, Crypto: 25, Divisas: 20, Materiales: 10, Índices: 10 },
}

// ── Technical indicator helpers ───────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map(c => Math.max(c, 0))
  const losses = changes.map(c => Math.max(-c, 0))
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function computeSMA(closes: number[], period: number): number {
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

function computeEMA(closes: number[], period: number): number {
  const k = 2 / (period + 1)
  let ema = closes[0]
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }
  return ema
}

function fmt(n: number, d = 2): string { return n.toFixed(d) }

// ── Single asset analysis ─────────────────────────────────────────────────────

async function analyzeAsset(config: AssetConfig): Promise<AssetAnalysis> {
  const period1 = new Date()
  period1.setDate(period1.getDate() - 160)

  const [historical, quote] = await Promise.all([
    yahooFinance.historical(config.ticker, {
      period1: period1.toISOString().split('T')[0],
      interval: '1d',
    }),
    yahooFinance.quote(config.ticker) as Promise<{
      regularMarketPrice?: number
      regularMarketChangePercent?: number
    } | null>,
  ])

  if (!historical || historical.length < 30) {
    throw new Error(`Insufficient data for ${config.ticker}`)
  }

  const currentPrice = (quote as { regularMarketPrice?: number } | null)?.regularMarketPrice
  if (!currentPrice) throw new Error(`No price for ${config.ticker}`)

  const changePercent24h = (quote as { regularMarketChangePercent?: number } | null)?.regularMarketChangePercent ?? 0

  const sorted = [...historical].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const closes = sorted.map(d => d.close).filter(Boolean) as number[]
  const volumes = sorted.map(d => d.volume).filter(Boolean) as number[]

  const rsi = computeRSI(closes)
  const sma20 = computeSMA(closes, 20)
  const sma50 = computeSMA(closes, Math.min(50, closes.length))
  const ema9 = computeEMA(closes.slice(-30), 9)

  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length)
  const lastVol = volumes[volumes.length - 1] ?? avgVol20
  const volChangePct = avgVol20 > 0 ? ((lastVol - avgVol20) / avgVol20) * 100 : 0

  const refClose = closes[Math.max(0, closes.length - 64)]
  const momentum3m = ((currentPrice - refClose) / refClose) * 100
  const priceVsEma9Pct = ((currentPrice - ema9) / ema9) * 100

  type TechSignal = 'bullish' | 'bearish' | 'neutral'
  const rsiSignal: TechSignal = rsi > 60 ? 'bullish' : rsi < 40 ? 'bearish' : 'neutral'
  const smaSignal: TechSignal = sma20 > sma50 ? 'bullish' : 'bearish'
  const volSignal: TechSignal = volChangePct > 10 ? 'bullish' : volChangePct < -10 ? 'bearish' : 'neutral'
  const momentumSignal: TechSignal = momentum3m > 5 ? 'bullish' : momentum3m < -5 ? 'bearish' : 'neutral'
  const emaSignal: TechSignal = priceVsEma9Pct > 0 ? 'bullish' : 'bearish'

  const score = [rsiSignal, smaSignal, volSignal, momentumSignal, emaSignal]
    .reduce((s, sig) => s + (sig === 'bullish' ? 1 : sig === 'bearish' ? -1 : 0), 0)

  const bias = score >= 2 ? 'LARGO' : score <= -2 ? 'CORTO' : 'NEUTRAL'
  const signal: MarketSignal = bias === 'LARGO' ? 'COMPRA' : bias === 'CORTO' ? 'VENTA' : 'NEUTRAL'
  const confidence = Math.max(20, Math.round((Math.abs(score) / 5) * 100 / 5) * 5)

  // Short programmatic reason
  const reason = generateReason(signal, rsi, sma20, sma50, momentum3m, priceVsEma9Pct)

  return {
    ticker: config.ticker,
    name: config.name,
    category: config.category,
    signal,
    price: +currentPrice.toFixed(4),
    changePercent24h: +changePercent24h.toFixed(4),
    confidence,
    reason,
    riskLevel: config.riskLevel,
    score,
  }
}

// ── Reason generator (brief, 1 line) ─────────────────────────────────────────

function generateReason(
  signal: MarketSignal,
  rsi: number,
  sma20: number,
  sma50: number,
  momentum3m: number,
  priceVsEma9: number,
): string {
  const smaDir = sma20 > sma50 ? 'alcista' : 'bajista'
  const mom = momentum3m >= 0 ? `+${fmt(momentum3m, 1)}%` : `${fmt(momentum3m, 1)}%`

  if (signal === 'COMPRA') {
    if (rsi > 65) return `fuerte momentum alcista con RSI ${fmt(rsi, 0)} y tendencia ${smaDir}`
    if (momentum3m > 8) return `momentum positivo ${mom} en 3M con estructura ${smaDir}`
    if (priceVsEma9 > 1) return `precio sobre EMA9 y tendencia ${smaDir} confirmada`
    return `confluencia técnica alcista en ${smaDir}`
  }
  if (signal === 'VENTA') {
    if (rsi < 35) return `RSI ${fmt(rsi, 0)} en zona de debilidad con tendencia ${smaDir}`
    if (momentum3m < -8) return `caída ${mom} en 3M con presión vendedora estructural`
    if (priceVsEma9 < -1) return `ruptura bajista con precio bajo EMA9 y estructura ${smaDir}`
    return `señales bajistas confluentes — tendencia ${smaDir}`
  }
  return `señales mixtas — consolidación lateral sin dirección clara`
}

// ── Market narrative generators ───────────────────────────────────────────────

function buildMarketNarrative(bias: MarketBias, assets: AssetAnalysis[]): string {
  const compra = assets.filter(a => a.signal === 'COMPRA')
  const venta = assets.filter(a => a.signal === 'VENTA')
  const topCompra = compra.sort((a, b) => b.confidence - a.confidence).slice(0, 2).map(a => a.name).join(' y ')
  const topVenta = venta.sort((a, b) => b.confidence - a.confidence).slice(0, 2).map(a => a.name).join(' y ')

  if (bias === 'ALCISTA') {
    return `Los mercados muestran un comportamiento predominantemente alcista. ${topCompra ? `${topCompra} lideran con señales de compra de alta confianza.` : ''} ${venta.length > 0 ? `Algunos activos como ${topVenta} aún muestran debilidad.` : 'La mayoría de los activos confirman la tendencia positiva.'}`
  }
  if (bias === 'BAJISTA') {
    return `Los mercados presentan presión bajista generalizada. ${topVenta ? `${topVenta} muestran señales de venta dominantes.` : ''} ${compra.length > 0 ? `Solo ${topCompra} mantiene cierta fortaleza relativa.` : 'La mayoría de activos confirman la tendencia negativa.'}`
  }
  return `Los mercados muestran un comportamiento mixto sin dirección dominante clara. ${topCompra ? `${topCompra} muestran fortaleza relativa,` : ''} ${topVenta ? ` mientras que ${topVenta} presentan debilidad.` : ''} Se recomienda cautela y esperar mayor confluencia de señales.`
}

function buildOpportunity(assets: AssetAnalysis[]): string {
  const top = assets.filter(a => a.signal === 'COMPRA').sort((a, b) => b.confidence - a.confidence).slice(0, 3)
  if (top.length === 0) return 'No se identifican oportunidades claras de compra en el mercado actual.'
  const names = top.map(a => `${a.name} (${a.ticker.replace('-USD','').replace('=X','').replace('=F','')})`).join(', ')
  return `${names} ${top.length === 1 ? 'muestra' : 'muestran'} señales de compra con confianza destacada.`
}

function buildRiskAlert(assets: AssetAnalysis[]): string {
  const topVenta = assets.filter(a => a.signal === 'VENTA').sort((a, b) => b.confidence - a.confidence).slice(0, 2)
  const highRisk = assets.filter(a => a.riskLevel === 'ALTO' && a.signal !== 'COMPRA').slice(0, 2)

  if (topVenta.length > 0) {
    const names = topVenta.map(a => a.name).join(' y ')
    return `${names} presenta${topVenta.length > 1 ? 'n' : ''} señales de venta que podrían indicar debilidad en el mercado.`
  }
  if (highRisk.length > 0) {
    return `Activos de alto riesgo como ${highRisk.map(a => a.name).join(' y ')} requieren monitoreo cercano.`
  }
  return 'Monitorea la volatilidad en activos de alto riesgo antes de tomar posiciones.'
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let riskProfile: RiskProfile
  try {
    const body = await request.json() as { riskProfile?: string }
    const p = body.riskProfile ?? ''
    if (!['conservador', 'moderado', 'agresivo'].includes(p)) {
      throw new Error('invalid profile')
    }
    riskProfile = p as RiskProfile
  } catch {
    return NextResponse.json({ error: 'Body must be JSON with { riskProfile: "conservador" | "moderado" | "agresivo" }' }, { status: 400 })
  }

  // Run all assets in parallel — allSettled so one failure doesn't kill the rest
  const settled = await Promise.allSettled(
    ASSET_UNIVERSE.map(config => analyzeAsset(config))
  )

  const assets: AssetAnalysis[] = []
  let failed = 0
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      assets.push(result.value)
    } else {
      failed++
      console.warn('Asset analysis failed:', result.reason)
    }
  }

  if (assets.length === 0) {
    return NextResponse.json({ error: 'No se pudo analizar ningún activo. Inténtalo de nuevo.' }, { status: 503 })
  }

  // Overall market bias
  const avgScore = assets.reduce((s, a) => s + a.score, 0) / assets.length
  const marketBias: MarketBias = avgScore > 0.8 ? 'ALCISTA' : avgScore < -0.8 ? 'BAJISTA' : 'NEUTRAL'

  // Rankings: top 10 by confidence
  const rankings = [...assets]
    .sort((a, b) => b.confidence - a.confidence || Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 10)

  // By category
  const categories: AssetCategory[] = ['Acciones', 'Crypto', 'Divisas', 'Materiales', 'Índices']
  const byCategory = Object.fromEntries(
    categories.map(cat => [
      cat,
      assets.filter(a => a.category === cat).sort((a, b) => b.confidence - a.confidence),
    ])
  ) as Record<AssetCategory, AssetAnalysis[]>

  const response: MarketAnalysisResponse = {
    riskProfile,
    marketBias,
    marketNarrative: buildMarketNarrative(marketBias, assets),
    opportunity: buildOpportunity(assets),
    riskAlert: buildRiskAlert(assets),
    rankings,
    byCategory,
    portfolioDistribution: PORTFOLIO_DISTRIBUTION[riskProfile],
    analyzedAt: new Date().toISOString(),
    assetsAnalyzed: assets.length,
    assetsFailed: failed,
  }

  return NextResponse.json(response)
}
