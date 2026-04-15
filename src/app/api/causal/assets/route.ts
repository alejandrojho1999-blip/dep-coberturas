import { createClient } from '@/lib/supabase/server'
import type { CausalConfig } from '@/lib/causal/types'

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('causal_assets')
    .select('id, ticker, config, last_run_at, last_score, last_signal')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ assets: data })
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    ticker?: string
    config?: CausalConfig
  }
  const { ticker, config } = body

  if (!ticker || !config) {
    return Response.json(
      { error: 'Missing required fields: ticker, config' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('causal_assets')
    .insert({ user_id: user.id, ticker, config })
    .select('id, ticker, config, last_run_at, last_score, last_signal')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ asset: data }, { status: 201 })
}
