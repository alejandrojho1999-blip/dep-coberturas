import { runScreener } from '@/lib/peter-lynch/screener'

export const maxDuration = 60

export async function GET(): Promise<Response> {
  try {
    const data = await runScreener()
    return Response.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return Response.json({ error: msg }, { status: 500 })
  }
}
