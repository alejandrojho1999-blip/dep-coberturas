import { analyzeFaros } from '@/lib/faros/engine'

export const maxDuration = 30

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()
  if (!ticker) return Response.json({ error: 'ticker requerido' }, { status: 400 })
  try {
    const result = await analyzeFaros(ticker)
    return Response.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return Response.json({ error: msg }, { status: 500 })
  }
}
