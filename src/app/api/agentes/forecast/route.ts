import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function linearRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length
  const sumX = (n * (n - 1)) / 2
  const sumXX = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = y.reduce((acc, val, i) => acc + i * val, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function ewma(prices: number[], alpha = 0.3): number {
  return prices.reduce((prev, curr) => alpha * curr + (1 - alpha) * prev)
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
  const period1 = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
  const results: Record<string, { lastPrice: number; forecastPrice: number; forecastReturn: number; pass: boolean }> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)
        if (closes.length < 30) return

        const lastPrice = closes[closes.length - 1]
        const last60 = closes.slice(-Math.min(60, closes.length))
        const last30 = closes.slice(-Math.min(30, closes.length))

        // Linear regression: project 30 trading days ahead
        const { slope, intercept } = linearRegression(last60)
        const linearForecast = intercept + slope * (last60.length - 1 + 30)

        // EWMA: project momentum of last 30 days forward
        const ewmaVal = ewma(last30, 0.3)
        const ewmaTrend = last30[0] > 0 ? (ewmaVal - last30[0]) / last30[0] : 0
        const ewmaForecast = ewmaVal * (1 + ewmaTrend)

        // Ensemble: 60% linear + 40% momentum
        const forecastPrice = linearForecast * 0.6 + ewmaForecast * 0.4
        const forecastReturn = lastPrice > 0 ? (forecastPrice - lastPrice) / lastPrice : 0
        const pass = forecastReturn >= 0.02

        results[ticker] = {
          lastPrice: parseFloat(lastPrice.toFixed(2)),
          forecastPrice: parseFloat(forecastPrice.toFixed(2)),
          forecastReturn: parseFloat((forecastReturn * 100).toFixed(2)),
          pass,
        }
      } catch (e) {
        console.error(`[forecast] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return Response.json(results)
}
