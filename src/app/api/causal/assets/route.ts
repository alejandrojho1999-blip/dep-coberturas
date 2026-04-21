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
    name?: string
    config?: CausalConfig
    ir_url?: string
    treatment?: string
    sector?: string
  }
  const { ticker, name, config, ir_url, treatment, sector } = body

  if (!ticker || !config) {
    return Response.json(
      { error: 'Missing required fields: ticker, config' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('causal_assets')
    .insert({ user_id: user.id, ticker, name: name ?? ticker, config, ir_url, treatment, sector })
    .select('id, ticker, config, last_run_at, last_score, last_signal')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ asset: data }, { status: 201 })
}

export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { id?: string }
  if (!body.id) return Response.json({ error: 'Missing id' }, { status: 400 })

  // Delete associated results first
  await supabase.from('causal_results').delete().eq('asset_id', body.id)

  const { error } = await supabase
    .from('causal_assets')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ deleted: true })
}
