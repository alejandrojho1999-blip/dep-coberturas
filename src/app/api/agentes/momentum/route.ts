import YahooFinance from 'yahoo-finance2'
import { createClient } from '@/lib/supabase/server'
import { computeMomentum, MOMENTUM_LOOKBACK_DIAS, type MomentumResult } from '@/lib/agentes/signals'

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
  const period1 = new Date(Date.now() - MOMENTUM_LOOKBACK_DIAS * 24 * 60 * 60 * 1000)
  const results: Record<string, MomentumResult> = {}

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hist = await (yf as any).historical(ticker, { period1, period2: new Date(), interval: '1d' }) as Array<{ close: number | null; volume: number | null }>
        const closes = hist.map(h => h.close).filter((c): c is number => c != null)
        const volumes = hist.map(h => h.volume).filter((v): v is number => v != null)

        const momentum = computeMomentum(closes, volumes)
        if (momentum) results[ticker] = momentum
      } catch (e) {
        console.error(`[momentum] ${ticker}:`, (e as Error).message)
      }
    })
  )

  return Response.json(results)
}
