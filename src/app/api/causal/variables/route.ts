import { createClient } from '@/lib/supabase/server'

interface VariableRow {
  id: string
  ticker: string
  variable: string
  type: 'confounder' | 'collider'
  source: 'auto' | 'manual'
  label: string | null
  rationale: string | null
  created_at: string
}

// GET /api/causal/variables?ticker=AAPL&type=confounder
// GET /api/causal/variables?type=confounder  (all tickers — for cross-ticker suggestions)
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')
  const type = searchParams.get('type')

  let query = supabase
    .from('causal_variables')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (ticker) query = query.eq('ticker', ticker.toUpperCase())
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ variables: data as VariableRow[] })
}

// POST /api/causal/variables
// Body: { ticker, variable, type, source?, label?, rationale? }
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    ticker: string
    variable: string
    type: 'confounder' | 'collider'
    source?: 'auto' | 'manual'
    label?: string
    rationale?: string
  }

  if (!body.ticker || !body.variable || !body.type) {
    return Response.json({ error: 'ticker, variable y type son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('causal_variables')
    .upsert(
      {
        user_id: user.id,
        ticker: body.ticker.toUpperCase(),
        variable: body.variable,
        type: body.type,
        source: body.source ?? 'manual',
        label: body.label ?? null,
        rationale: body.rationale ?? null,
      },
      { onConflict: 'user_id,ticker,variable,type' },
    )
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ variable: data }, { status: 201 })
}

// DELETE /api/causal/variables  Body: { id }
export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { id: string }
  if (!body.id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase
    .from('causal_variables')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
