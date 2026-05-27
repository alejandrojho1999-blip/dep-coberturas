import { createClient } from '@/lib/supabase/server'

// Render Starter can take up to 60s for heavy computations (portfolio, causal)
export const maxDuration = 60

const API_URL = process.env.ERGO_QUANT_API_URL ?? ''
const API_KEY = process.env.ERGO_QUANT_API_KEY ?? ''
const ALLOWED_SEGMENT = /^[a-zA-Z0-9._-]+$/

function normalizeApiUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `http://${trimmed}`
}

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
  if (!API_KEY) {
    return Response.json({ error: 'ERGO_QUANT_API_KEY not configured' }, { status: 503 })
  }

  const { path } = await params
  if (!path.length || path.some((segment) => !ALLOWED_SEGMENT.test(segment))) {
    return Response.json({ error: 'Invalid upstream path' }, { status: 400 })
  }

  const endpoint = path.map(encodeURIComponent).join('/')
  const incoming = new URL(req.url)
  const upstreamUrl = new URL(`${normalizeApiUrl(API_URL)}/${endpoint}`)
  upstreamUrl.search = incoming.search

  const headers: HeadersInit = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY }

  const init: RequestInit = { method, headers }
  if (method !== 'GET') {
    try {
      init.body = JSON.stringify(await req.json())
    } catch {
      init.body = '{}'
    }
  }

  try {
    const upstream = await fetch(upstreamUrl, init)
    const text = await upstream.text()
    if (!text) return new Response(null, { status: upstream.status })

    try {
      return Response.json(JSON.parse(text), { status: upstream.status })
    } catch {
      return new Response(text, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/plain' },
      })
    }
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
