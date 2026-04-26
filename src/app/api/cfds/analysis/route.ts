import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()
import { NextRequest, NextResponse } from 'next/server'

// ── Types ────────────────────────────────────────────────────────────────────

type Signal = 'bullish' | 'bearish' | 'neutral'
type Bias = 'LARGO' | 'CORTO' | 'NEUTRAL'

export interface CfdFactor {
  name: string
  value: string
  signal: Signal
  description: string
}

export interface CfdTradeSetup {
  entry: number
  stopLoss: number
  takeProfit: number
  riskReward: number
  slPct: number
  tpPct: number
}

export interface CfdAnalysisResponse {
  ticker: string
  name: string
  price: number
  currency: string
  bias: Bias
  confidence: number
  score: number
  factors: CfdFactor[]
  narrative: string
  tradeSetup: CfdTradeSetup
  analyzedAt: string
}

// ── Asset name map ────────────────────────────────────────────────────────────

const ASSET_NAMES: Record<string, string> = {
  '^GSPC':    'S&P 500',
  '^NDX':     'NASDAQ 100',
  '^DJI':     'Dow Jones Industrial',
  'GC=F':     'Gold (Futuros)',
  'CL=F':     'WTI Crude Oil',
  'BTC-USD':  'Bitcoin',
  'ETH-USD':  'Ethereum',
  'EURUSD=X': 'EUR/USD',
  'DX-Y.NYB': 'US Dollar Index (DXY)',
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

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

// ── Narrative generator ───────────────────────────────────────────────────────

function generateNarrative(
  bias: Bias,
  factors: CfdFactor[],
  rsi: number,
  sma20: number,
  sma50: number,
  momentum3m: number,
  assetName: string
): string {
  const bullishFactors = factors.filter(f => f.signal === 'bullish')
  const bearishFactors = factors.filter(f => f.signal === 'bearish')
  const neutralFactors = factors.filter(f => f.signal === 'neutral')

  const smaRelation = sma20 > sma50 ? 'SMA20 > SMA50' : 'SMA20 < SMA50'
  const smaDir = sma20 > sma50 ? 'alcista' : 'bajista'
  const rsiZone =
    rsi > 70 ? 'zona de sobrecompra (>70)' :
    rsi < 30 ? 'zona de sobreventa (<30)' :
    rsi > 60 ? 'zona de fortaleza (60-70)' :
    rsi < 40 ? 'zona de debilidad (30-40)' :
    'zona neutral (40-60)'

  const momentumStr = momentum3m >= 0
    ? `ganancia de ${fmt(momentum3m, 1)}% en 3 meses`
    : `pérdida de ${fmt(Math.abs(momentum3m), 1)}% en 3 meses`

  if (bias === 'LARGO') {
    const confluentCount = bullishFactors.length
    const confluentStr = confluentCount === 5
      ? 'confluencia técnica total en 5/5 factores'
      : confluentCount >= 3
      ? `confluencia técnica en ${confluentCount}/5 factores`
      : 'señales técnicas moderadamente positivas'

    const divergenceNote = neutralFactors.length > 0
      ? ` ${neutralFactors.map(f => f.name).join(' y ')} ${neutralFactors.length === 1 ? 'permanece' : 'permanecen'} neutral${neutralFactors.length > 1 ? 'es' : ''}, lo que modera la convicción.`
      : ' Los 5 factores alinean en la misma dirección, reforzando la señal.'

    let rsiNote = ''
    if (rsi > 65)
      rsiNote = ` Monitorea el RSI: al acercarse a 70 puede señalar sobrecompra y corrección temporal.`
    else if (rsi < 50)
      rsiNote = ` El RSI aún no confirma con fuerza; esperar consolidación por encima de 50 agregaría convicción.`

    return (
      `El sesgo alcista en ${assetName} está sustentado por ${confluentStr}. ` +
      `El RSI(14) en ${fmt(rsi, 1)} se ubica en ${rsiZone}, indicando momentum activo. ` +
      `El cruce de medias (${smaRelation}) confirma la tendencia ${smaDir} estructural. ` +
      `El precio muestra ${momentumStr}.` +
      divergenceNote +
      rsiNote +
      ` ⚠ Este análisis es referencial. No constituye consejo financiero.`
    )
  }

  if (bias === 'CORTO') {
    const confluentCount = bearishFactors.length
    const confluentStr = confluentCount === 5
      ? 'confluencia técnica bajista total en 5/5 factores'
      : confluentCount >= 3
      ? `debilidad técnica en ${confluentCount}/5 factores`
      : 'presión bajista moderada'

    const divergenceNote = neutralFactors.length > 0
      ? ` ${neutralFactors.map(f => f.name).join(' y ')} ${neutralFactors.length === 1 ? 'sigue' : 'siguen'} neutral${neutralFactors.length > 1 ? 'es' : ''}, lo que limita la convicción bajista.`
      : ' Los 5 factores apuntan en la misma dirección bajista.'

    let rsiNote = ''
    if (rsi < 35)
      rsiNote = ` Atención: el RSI en ${fmt(rsi, 1)} se aproxima a zona de sobreventa (<30), donde puede producirse un rebote técnico.`

    return (
      `El sesgo bajista en ${assetName} está determinado por ${confluentStr}. ` +
      `El RSI(14) en ${fmt(rsi, 1)} se ubica en ${rsiZone}, señalando momentum negativo. ` +
      `El cruce de medias (${smaRelation}) confirma la presión ${smaDir}. ` +
      `El precio acumula ${momentumStr}.` +
      divergenceNote +
      rsiNote +
      ` ⚠ Este análisis es referencial. No constituye consejo financiero.`
    )
  }

  // NEUTRAL
  return (
    `El análisis de ${assetName} muestra señales mixtas sin dirección clara. ` +
    `El RSI(14) en ${fmt(rsi, 1)} se encuentra en ${rsiZone}. ` +
    `El cruce de medias (${smaRelation}) indica tendencia ${smaDir}, ` +
    `pero los demás factores no confirman con suficiente convicción. ` +
    `Con ${bullishFactors.length} factores alcistas y ${bearishFactors.length} bajistas, ` +
    `se recomienda esperar una señal de mayor confluencia antes de operar. ` +
    ` ⚠ Este análisis es referencial. No constituye consejo financiero.`
  )
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let ticker: string
  try {
    const body = await request.json() as { ticker?: string }
    ticker = (body.ticker ?? '').trim().toUpperCase()
    if (!ticker) throw new Error('missing ticker')
  } catch {
    return NextResponse.json({ error: 'Body must be JSON with { ticker: string }' }, { status: 400 })
  }

  try {
    // ── Fetch historical data (100 trading days ≈ ~5 months) ──────────────────
    const period1 = new Date()
    period1.setDate(period1.getDate() - 160) // extra buffer for weekends/holidays

    const [historical, quote] = await Promise.all([
      yahooFinance.historical(ticker, {
        period1: period1.toISOString().split('T')[0],
        interval: '1d',
      }),
      yahooFinance.quote(ticker) as Promise<{
        regularMarketPrice?: number
        symbol?: string
        currency?: string
        shortName?: string
      } | null>,
    ])

    if (!historical || historical.length < 55) {
      return NextResponse.json({ error: `Insufficient historical data for ${ticker}` }, { status: 422 })
    }

    const currentPrice = (quote as { regularMarketPrice?: number } | null)?.regularMarketPrice
    if (!currentPrice) {
      return NextResponse.json({ error: `Cannot fetch current price for ${ticker}` }, { status: 404 })
    }

    // Sort ascending by date and extract closes + volumes
    const sorted = [...historical].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const closes = sorted.map(d => d.close).filter(Boolean) as number[]
    const volumes = sorted.map(d => d.volume).filter(Boolean) as number[]

    // ── Compute indicators ──────────────────────────────────────────────────────
    const rsi = computeRSI(closes)
    const sma20 = computeSMA(closes, 20)
    const sma50 = computeSMA(closes, 50)
    const ema9 = computeEMA(closes.slice(-30), 9)

    // Volume: compare last day vs 20-day average
    const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    const lastVol = volumes[volumes.length - 1] ?? avgVol20
    const volChangePct = avgVol20 > 0 ? ((lastVol - avgVol20) / avgVol20) * 100 : 0

    // Momentum: price today vs 63 trading days ago
    const refClose = closes[Math.max(0, closes.length - 64)]
    const momentum3m = ((currentPrice - refClose) / refClose) * 100

    // Price vs EMA9
    const priceVsEma9Pct = ((currentPrice - ema9) / ema9) * 100

    // ── Classify each factor ────────────────────────────────────────────────────
    const rsiSignal: Signal = rsi > 60 ? 'bullish' : rsi < 40 ? 'bearish' : 'neutral'
    const smaSignal: Signal = sma20 > sma50 ? 'bullish' : 'bearish'
    const volSignal: Signal = volChangePct > 10 ? 'bullish' : volChangePct < -10 ? 'bearish' : 'neutral'
    const momentumSignal: Signal = momentum3m > 5 ? 'bullish' : momentum3m < -5 ? 'bearish' : 'neutral'
    const emaSignal: Signal = priceVsEma9Pct > 0 ? 'bullish' : 'bearish'

    const signalScore = (s: Signal) => s === 'bullish' ? 1 : s === 'bearish' ? -1 : 0
    const score = signalScore(rsiSignal) + signalScore(smaSignal) + signalScore(volSignal) + signalScore(momentumSignal) + signalScore(emaSignal)

    const bias: Bias = score >= 2 ? 'LARGO' : score <= -2 ? 'CORTO' : 'NEUTRAL'
    const confidence = Math.round((Math.abs(score) / 5) * 100 / 5) * 5 // round to nearest 5%

    const factors: CfdFactor[] = [
      {
        name: 'RSI (14)',
        value: fmt(rsi, 1),
        signal: rsiSignal,
        description:
          rsiSignal === 'bullish' ? `${fmt(rsi,1)} — Zona de fortaleza (>60), momentum positivo activo` :
          rsiSignal === 'bearish' ? `${fmt(rsi,1)} — Zona de debilidad (<40), presión vendedora` :
          `${fmt(rsi,1)} — Zona neutral (40-60), sin señal clara`,
      },
      {
        name: 'Tendencia SMA',
        value: sma20 > sma50 ? '20 > 50' : '20 < 50',
        signal: smaSignal,
        description:
          smaSignal === 'bullish'
            ? `SMA20 (${fmt(sma20,2)}) > SMA50 (${fmt(sma50,2)}) — Cruce dorado, tendencia alcista estructural`
            : `SMA20 (${fmt(sma20,2)}) < SMA50 (${fmt(sma50,2)}) — Cruce de la muerte, tendencia bajista estructural`,
      },
      {
        name: 'Volumen relativo',
        value: `${volChangePct >= 0 ? '+' : ''}${fmt(volChangePct, 1)}%`,
        signal: volSignal,
        description:
          volSignal === 'bullish' ? `Volumen ${fmt(volChangePct,1)}% sobre media 20d — Participación creciente confirma movimiento` :
          volSignal === 'bearish' ? `Volumen ${fmt(volChangePct,1)}% bajo media 20d — Deterioro de participación` :
          `Volumen dentro de rango normal (±10% vs media 20d)`,
      },
      {
        name: 'Momentum 3M',
        value: `${momentum3m >= 0 ? '+' : ''}${fmt(momentum3m, 1)}%`,
        signal: momentumSignal,
        description:
          momentumSignal === 'bullish' ? `+${fmt(momentum3m,1)}% en 3 meses — Tendencia de precios positiva sostenida` :
          momentumSignal === 'bearish' ? `${fmt(momentum3m,1)}% en 3 meses — Deterioro sostenido de precio` :
          `${fmt(momentum3m,1)}% en 3 meses — Sin tendencia definida`,
      },
      {
        name: 'Precio vs EMA(9)',
        value: `${priceVsEma9Pct >= 0 ? '+' : ''}${fmt(priceVsEma9Pct, 2)}%`,
        signal: emaSignal,
        description:
          emaSignal === 'bullish'
            ? `Precio ${fmt(priceVsEma9Pct,2)}% sobre EMA9 — Impulso de corto plazo activo`
            : `Precio ${fmt(Math.abs(priceVsEma9Pct),2)}% bajo EMA9 — Pérdida de impulso de corto plazo`,
      },
    ]

    // ── Trade setup ─────────────────────────────────────────────────────────────
    const slPct = bias === 'LARGO' ? -1.5 : 1.5
    const tpPct = bias === 'LARGO' ? 2.5 : -2.5
    const entry = currentPrice
    const stopLoss = +(currentPrice * (1 + slPct / 100)).toFixed(4)
    const takeProfit = +(currentPrice * (1 + tpPct / 100)).toFixed(4)
    const riskReward = +(Math.abs(tpPct) / Math.abs(slPct)).toFixed(2)

    // ── Narrative ───────────────────────────────────────────────────────────────
    const assetName = ASSET_NAMES[ticker] ?? ticker
    const narrative = generateNarrative(bias, factors, rsi, sma20, sma50, momentum3m, assetName)

    const response: CfdAnalysisResponse = {
      ticker,
      name: assetName,
      price: +currentPrice.toFixed(4),
      currency: (quote as { currency?: string } | null)?.currency ?? 'USD',
      bias,
      confidence,
      score,
      factors,
      narrative,
      tradeSetup: { entry: +entry.toFixed(4), stopLoss, takeProfit, riskReward, slPct: Math.abs(slPct), tpPct: Math.abs(tpPct) },
      analyzedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error(`CFD analysis error for ${ticker}:`, error)
    if (error instanceof Error && (error.message.includes('Not Found') || error.message.includes('404'))) {
      return NextResponse.json({ error: `Ticker no encontrado: ${ticker}` }, { status: 404 })
    }
    return NextResponse.json({ error: 'Error al procesar análisis técnico' }, { status: 500 })
  }
}
