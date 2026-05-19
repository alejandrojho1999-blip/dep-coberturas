import { runScreener } from '@/lib/peter-lynch/screener'

export const maxDuration = 300

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === '1'
    const universe = searchParams.get('universe') === 'small_cap' ? 'small_cap' as const : 'large_cap' as const
    const data = await runScreener(forceRefresh, universe)
    return Response.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return Response.json({ error: msg }, { status: 500 })
  }
}
