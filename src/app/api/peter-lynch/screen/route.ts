import { runScreener } from '@/lib/peter-lynch/screener'

export const maxDuration = 300

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === '1'
    const data = await runScreener(forceRefresh)
    return Response.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return Response.json({ error: msg }, { status: 500 })
  }
}
