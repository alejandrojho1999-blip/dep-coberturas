import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'
import { computeForecast, FORECAST_LOOKBACK_DIAS, type ForecastResult } from '@/lib/agentes/signals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tickersParam = searchParams.get('tickers') ?? ''
  const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  if (!tickers.length) return Response.json({})

  const yf = new YahooFinance()
  const period1 = new Date(Date.now() - FORECAST_LOOKBACK_DIAS * 24 * 60 * 60 * 1000)
  const results: Record<string, ForecastResult> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)

        const forecast = computeForecast(closes)
        if (forecast) results[ticker] = forecast
      } catch (e) {
        console.error(`[forecast] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return Response.json(results)
}
