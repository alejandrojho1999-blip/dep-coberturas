import { createClient } from '@/lib/supabase/server'
import { forecastDeTickers, parsearTickers } from '@/lib/agentes/historicos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const tickers = parsearTickers(searchParams.get('tickers'))
  if (!tickers.length) return Response.json({})

  return Response.json(await forecastDeTickers(tickers))
}
