import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  const gains = changes.map(c => (c > 0 ? c : 0))
  const losses = changes.map(c => (c < 0 ? -c : 0))

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }

  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [prices[0]]
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

function calcMACD(closes: number[]): { macd: number; signal: number } {
  if (closes.length < 35) return { macd: 0, signal: 0 }
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i]).slice(25)
  const signalLine = calcEMA(macdLine, 9)
  const last = macdLine.length - 1
  return {
    macd: parseFloat(macdLine[last].toFixed(4)),
    signal: parseFloat(signalLine[last].toFixed(4)),
  }
}

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tickersParam = searchParams.get('tickers') ?? ''
  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  if (!tickers.length) return Response.json({})

  const yf = new YahooFinance()
  const period1 = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000)
  const results: Record<string, { rsi: number; macd: number; signal: number; volumeTrend: number; score: number; pass: boolean }> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null; volume: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)
        const volumes = hist.map(h => h.volume).filter((v): v is number => v != null)
        if (closes.length < 30 || volumes.length < 20) return

        const rsi = calcRSI(closes, 14)
        const { macd, signal } = calcMACD(closes)

        const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
        const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
        const volumeTrend = vol20 > 0 ? vol5 / vol20 : 1

        const rsiPass = rsi > 50 && rsi < 75
        const macdPass = macd > signal
        const volPass = volumeTrend >= 1.1

        const score = (rsiPass ? 1 : 0) + (macdPass ? 1 : 0) + (volPass ? 1 : 0)

        results[ticker] = {
          rsi: parseFloat(rsi.toFixed(1)),
          macd,
          signal,
          volumeTrend: parseFloat(volumeTrend.toFixed(2)),
          score,
          pass: score >= 2,
        }
      } catch (e) {
        console.error(`[momentum] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return Response.json(results)
}
