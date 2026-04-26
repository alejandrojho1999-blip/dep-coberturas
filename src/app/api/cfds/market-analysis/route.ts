import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskProfile = 'conservador' | 'moderado' | 'agresivo'
type MarketSignal = 'COMPRA' | 'VENTA' | 'NEUTRAL'
type RiskLevel = 'BAJO' | 'MEDIO' | 'MODERADO' | 'ALTO'
type AssetCategory = 'Acciones' | 'Crypto' | 'Divisas' | 'Materiales' | 'Índices'
type MarketBias = 'ALCISTA' | 'BAJISTA' | 'NEUTRAL'
type TechSignal = 'bullish' | 'bearish' | 'neutral'

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
  { ticker: 'AAPL',     name: 'Apple',               category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'MSFT',     name: 'Microsoft',           category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'AMZN',     name: 'Amazon',              category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'NVDA',     name: 'Nvidia',              category: 'Acciones',   riskLevel: 'ALTO' },
  { ticker: 'META',     name: 'Meta',                category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'GOOGL',    name: 'Alphabet',            category: 'Acciones',   riskLevel: 'MEDIO' },
  { ticker: 'TSLA',     name: 'Tesla',               category: 'Acciones',   riskLevel: 'ALTO' },
  // Crypto
  { ticker: 'BTC-USD',  name: 'Bitcoin',             category: 'Crypto',     riskLevel: 'ALTO' },
  { ticker: 'ETH-USD',  name: 'Ethereum',            category: 'Crypto',     riskLevel: 'ALTO' },
  { ticker: 'BNB-USD',  name: 'BNB',                 category: 'Crypto',     riskLevel: 'MEDIO' },
  { ticker: 'XRP-USD',  name: 'XRP',                 category: 'Crypto',     riskLevel: 'ALTO' },
  // Divisas
  { ticker: 'EURUSD=X', name: 'EUR/USD',             category: 'Divisas',    riskLevel: 'MODERADO' },
  { ticker: 'DX-Y.NYB', name: 'Índice Dólar (DXY)', category: 'Divisas',    riskLevel: 'MODERADO' },
  { ticker: 'GBPUSD=X', name: 'GBP/USD',            category: 'Divisas',    riskLevel: 'MODERADO' },
  { ticker: 'USDJPY=X', name: 'USD/JPY',             category: 'Divisas',    riskLevel: 'ALTO' },
  { ticker: 'USDCAD=X', name: 'USD/CAD',             category: 'Divisas',    riskLevel: 'ALTO' },
  // Materiales
  { ticker: 'GC=F',     name: 'Oro',                 category: 'Materiales', riskLevel: 'BAJO' },
  { ticker: 'SI=F',     name: 'Plata',               category: 'Materiales', riskLevel: 'MEDIO' },
  // Índices
  { ticker: '^GSPC',    name: 'S&P 500',             category: 'Índices',    riskLevel: 'BAJO' },
  { ticker: '^NDX',     name: 'NASDAQ 100',          category: 'Índices',    riskLevel: 'MEDIO' },
  { ticker: '^DJI',     name: 'Dow Jones',           category: 'Índices',    riskLevel: 'BAJO' },
]

// ── Portfolio distribution by risk profile ────────────────────────────────────

const PORTFOLIO_DISTRIBUTION: Record<RiskProfile, Record<AssetCategory, number>> = {
  conservador: { Índices: 40, Materiales: 30, Divisas: 20, Acciones: 10, Crypto: 0 },
  moderado:    { Acciones: 35, Índices: 25, Materiales: 20, Divisas: 15, Crypto: 5 },
  agresivo:    { Acciones: 35, Crypto: 25, Divisas: 20, Materiales: 10, Índices: 10 },
}

// ── Single asset analysis — quote-only, 1 call per asset ─────────────────────

async function analyzeAsset(config: AssetConfig): Promise<AssetAnalysis> {
  const q = await yahooFinance.quote(config.ticker) as {
    regularMarketPrice?: number
    regularMarketChangePercent?: number
    fiftyDayAverage?: number
    twoHundredDayAverage?: number
    regularMarketVolume?: number
    averageDailyVolume3Month?: number
    fiftyTwoWeekHigh?: number
    fiftyTwoWeekLow?: number
  } | null

  const price = q?.regularMarketPrice
  if (!price) throw new Error(`No price for ${config.ticker}`)

  const changePct  = q?.regularMarketChangePercent ?? 0
  const sma50      = q?.fiftyDayAverage
  const sma200     = q?.twoHundredDayAverage
  const vol        = q?.regularMarketVolume ?? 0
  const avgVol3M   = q?.averageDailyVolume3Month ?? 0
  const high52     = q?.fiftyTwoWeekHigh ?? price
  const low52      = q?.fiftyTwoWeekLow  ?? price

  // 1. Price vs SMA50 (medium-term trend)
  const sma50Signal: TechSignal = sma50 ? (price > sma50 ? 'bullish' : 'bearish') : 'neutral'

  // 2. Price vs SMA200 (long-term trend)
  const sma200Signal: TechSignal = sma200 ? (price > sma200 ? 'bullish' : 'bearish') : 'neutral'

  // 3. Volume vs 3-month average
  const volPct = avgVol3M > 0 ? ((vol - avgVol3M) / avgVol3M) * 100 : 0
  const volSignal: TechSignal = volPct > 15 ? 'bullish' : volPct < -15 ? 'bearish' : 'neutral'

  // 4. 52-week range position (RSI proxy: >0.65 overbought → bullish strength, <0.35 oversold → bearish)
  const range = high52 - low52
  const position = range > 0 ? (price - low52) / range : 0.5
  const rangeSignal: TechSignal = position > 0.65 ? 'bullish' : position < 0.35 ? 'bearish' : 'neutral'

  // 5. Daily momentum
  const momentumSignal: TechSignal = changePct > 1.0 ? 'bullish' : changePct < -1.0 ? 'bearish' : 'neutral'

  const score = [sma50Signal, sma200Signal, volSignal, rangeSignal, momentumSignal]
    .reduce((s, sig) => s + (sig === 'bullish' ? 1 : sig === 'bearish' ? -1 : 0), 0)

  const signal: MarketSignal = score >= 2 ? 'COMPRA' : score <= -2 ? 'VENTA' : 'NEUTRAL'
  const confidence = Math.max(20, Math.round((Math.abs(score) / 5) * 100 / 5) * 5)
  const reason = generateReason(signal, position, sma50Signal, sma200Signal, changePct)

  return {
    ticker: config.ticker,
    name: config.name,
    category: config.category,
    signal,
    price: +price.toFixed(4),
    changePercent24h: +changePct.toFixed(4),
    confidence,
    reason,
    riskLevel: config.riskLevel,
    score,
  }
}

// ── Reason generator ──────────────────────────────────────────────────────────

function generateReason(
  signal: MarketSignal,
  rangePosition: number,
  sma50Signal: TechSignal,
  sma200Signal: TechSignal,
  changePct: number,
): string {
  const trend50  = sma50Signal  === 'bullish' ? 'sobre SMA50'  : sma50Signal  === 'bearish' ? 'bajo SMA50'  : 'en SMA50'
  const trend200 = sma200Signal === 'bullish' ? 'tendencia larga alcista' : sma200Signal === 'bearish' ? 'tendencia larga bajista' : ''
  const rangeDesc = rangePosition > 0.65 ? 'parte alta del rango anual' : rangePosition < 0.35 ? 'parte baja del rango anual' : 'zona media del rango anual'

  if (signal === 'COMPRA') {
    if (rangePosition > 0.75) return `precio en ${rangeDesc} — ${trend50}${trend200 ? ', ' + trend200 : ''}`
    if (changePct > 1) return `momentum diario +${changePct.toFixed(1)}% — ${trend50}`
    return `confluencia alcista: ${trend50}${trend200 ? ', ' + trend200 : ''}`
  }
  if (signal === 'VENTA') {
    if (rangePosition < 0.25) return `precio en ${rangeDesc} — ${trend50}${trend200 ? ', ' + trend200 : ''}`
    if (changePct < -1) return `presión bajista ${changePct.toFixed(1)}% — ${trend50}`
    return `confluencia bajista: ${trend50}${trend200 ? ', ' + trend200 : ''}`
  }
  return `señales mixtas — ${rangeDesc}, ${trend50}`
}

// ── Narrative generators ──────────────────────────────────────────────────────

function buildMarketNarrative(bias: MarketBias, assets: AssetAnalysis[]): string {
  const compra   = [...assets].filter(a => a.signal === 'COMPRA').sort((a, b) => b.confidence - a.confidence)
  const venta    = [...assets].filter(a => a.signal === 'VENTA').sort((a, b) => b.confidence - a.confidence)
  const topCompra = compra.slice(0, 2).map(a => a.name).join(' y ')
  const topVenta  = venta.slice(0, 2).map(a => a.name).join(' y ')

  if (bias === 'ALCISTA') {
    return `Los mercados muestran un comportamiento predominantemente alcista. ${topCompra ? `${topCompra} lideran con señales de compra de alta confianza.` : ''} ${venta.length > 0 ? `Algunos activos como ${topVenta} aún muestran debilidad.` : 'La mayoría de los activos confirman la tendencia positiva.'}`
  }
  if (bias === 'BAJISTA') {
    return `Los mercados presentan presión bajista generalizada. ${topVenta ? `${topVenta} muestran señales de venta dominantes.` : ''} ${compra.length > 0 ? `Solo ${topCompra} mantiene cierta fortaleza relativa.` : 'La mayoría de activos confirman la tendencia negativa.'}`
  }
  return `Los mercados muestran un comportamiento mixto sin dirección dominante clara. ${topCompra ? `${topCompra} muestran fortaleza relativa,` : ''} ${topVenta ? ` mientras que ${topVenta} presentan debilidad.` : ''} Se recomienda cautela y esperar mayor confluencia de señales.`
}

function buildOpportunity(assets: AssetAnalysis[]): string {
  const top = [...assets].filter(a => a.signal === 'COMPRA').sort((a, b) => b.confidence - a.confidence).slice(0, 3)
  if (top.length === 0) return 'No se identifican oportunidades claras de compra en el mercado actual.'
  const names = top.map(a => `${a.name} (${a.ticker.replace('-USD', '').replace('=X', '').replace('=F', '').replace('^', '')})`).join(', ')
  return `${names} ${top.length === 1 ? 'muestra' : 'muestran'} señales de compra con confianza destacada.`
}

function buildRiskAlert(assets: AssetAnalysis[]): string {
  const topVenta = [...assets].filter(a => a.signal === 'VENTA').sort((a, b) => b.confidence - a.confidence).slice(0, 2)
  if (topVenta.length > 0) {
    const names = topVenta.map(a => a.name).join(' y ')
    return `${names} presenta${topVenta.length > 1 ? 'n' : ''} señales de venta que podrían indicar debilidad en el mercado.`
  }
  const highRisk = assets.filter(a => a.riskLevel === 'ALTO' && a.signal !== 'COMPRA').slice(0, 2)
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
    return NextResponse.json(
      { error: 'Body debe ser JSON con { riskProfile: "conservador" | "moderado" | "agresivo" }' },
      { status: 400 }
    )
  }

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
      console.warn('[market-analysis] asset failed:', result.reason?.message ?? result.reason)
    }
  }

  if (assets.length === 0) {
    return NextResponse.json(
      { error: 'No se pudo obtener datos de mercado. Inténtalo en unos segundos.' },
      { status: 503 }
    )
  }

  const avgScore = assets.reduce((s, a) => s + a.score, 0) / assets.length
  const marketBias: MarketBias = avgScore > 0.8 ? 'ALCISTA' : avgScore < -0.8 ? 'BAJISTA' : 'NEUTRAL'

  const rankings = [...assets]
    .sort((a, b) => b.confidence - a.confidence || Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 10)

  const categories: AssetCategory[] = ['Acciones', 'Crypto', 'Divisas', 'Materiales', 'Índices']
  const byCategory = Object.fromEntries(
    categories.map(cat => [
      cat,
      assets.filter(a => a.category === cat).sort((a, b) => b.confidence - a.confidence),
    ])
  ) as Record<AssetCategory, AssetAnalysis[]>

  return NextResponse.json({
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
  } satisfies MarketAnalysisResponse)
}
