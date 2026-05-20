import { createClient } from '@/lib/supabase/server'

// Render Starter can take up to 60s for heavy computations (portfolio, causal)
export const maxDuration = 60

const API_URL = process.env.ERGO_QUANT_API_URL ?? ''
const API_KEY = process.env.ERGO_QUANT_API_KEY ?? ''

async function proxyRequest(
  req: Request,
  params: Promise<{ path: string[] }>,
  method: 'GET' | 'POST' | 'DELETE',
): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!API_URL) {
    return Response.json({ error: 'ERGO_QUANT_API_URL not configured' }, { status: 503 })
  }

  const { path } = await params
  const endpoint = path.join('/')
  const url = `${API_URL}/${endpoint}`

  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (API_KEY) headers['X-API-Key'] = API_KEY

  const init: RequestInit = { method, headers }
  if (method !== 'GET') {
    try {
      init.body = JSON.stringify(await req.json())
    } catch {
      init.body = '{}'
    }
  }

  try {
    const upstream = await fetch(url, init)
    const data = await upstream.json()
    return Response.json(data, { status: upstream.status })
  } catch (err) {
    return Response.json({ error: `Backend unreachable: ${err}` }, { status: 502 })
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx.params, 'GET')
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx.params, 'POST')
}

export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, ctx.params, 'DELETE')
}
