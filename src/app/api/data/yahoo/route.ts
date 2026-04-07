import { createClient } from '@/lib/supabase/server'
import { fetchStockData } from '@/lib/data/yahoo'

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')
  const start = searchParams.get('start')
  const horizonParam = searchParams.get('horizon')

  if (!ticker) {
    return Response.json({ error: 'Missing required parameter: ticker' }, { status: 400 })
  }
  if (!start) {
    return Response.json({ error: 'Missing required parameter: start' }, { status: 400 })
  }

  const horizon = horizonParam ? parseInt(horizonParam, 10) : 2

  if (isNaN(horizon) || horizon < 1) {
    return Response.json({ error: 'Invalid parameter: horizon must be a positive integer' }, { status: 400 })
  }

  try {
    const observations = await fetchStockData(ticker, start, undefined, horizon)
    return Response.json({ observations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Yahoo Finance data'
    return Response.json({ error: message }, { status: 502 })
  }
}
