import { createClient } from '@/lib/supabase/server'
import type { PipelineResult } from '@/lib/causal/types'

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const assetId = searchParams.get('assetId')
  if (!assetId) return Response.json({ error: 'Missing required query param: assetId' }, { status: 400 })

  // Verify the asset belongs to this user
  const { data: asset, error: assetError } = await supabase
    .from('causal_assets')
    .select('id')
    .eq('id', assetId)
    .eq('user_id', user.id)
    .single()

  if (assetError || !asset) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch last 5 results for this asset
  const { data: rows, error } = await supabase
    .from('causal_results')
    .select('id, created_at, result')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const results = (rows ?? []) as Array<{ id: string; created_at: string; result: PipelineResult }>

  return Response.json({ results })
}
