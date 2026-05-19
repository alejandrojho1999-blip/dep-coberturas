import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'

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
  const period1 = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
  const results: Record<string, { direction: string; lastPrice: number; sma20: number }> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)
        if (closes.length < 5) return
        const lastPrice = closes[closes.length - 1]
        const window = closes.slice(-20)
        const sma20 = window.reduce((a, b) => a + b, 0) / window.length
        const direction = lastPrice > sma20 * 1.001 ? 'ALCISTA'
          : lastPrice < sma20 * 0.999 ? 'BAJISTA'
          : 'LATERAL'
        results[ticker] = { direction, lastPrice, sma20: parseFloat(sma20.toFixed(2)) }
      } catch (e) {
        console.error(`[trend] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return Response.json(results)
}
