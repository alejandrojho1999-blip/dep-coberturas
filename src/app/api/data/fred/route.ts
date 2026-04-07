import { createClient } from '@/lib/supabase/server'
import { fetchMacroData } from '@/lib/data/fred'

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end') ?? undefined

  if (!start) {
    return Response.json({ error: 'Missing required parameter: start' }, { status: 400 })
  }

  try {
    const data = await fetchMacroData(start, end)
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch FRED data'
    return Response.json({ error: message }, { status: 502 })
  }
}
