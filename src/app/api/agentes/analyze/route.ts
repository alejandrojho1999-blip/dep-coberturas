import { createClient } from '@/lib/supabase/server'
import { analizarTicker, AnalisisError, type AnalyzeInput } from '@/lib/agentes/analisis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Dictamen del modelo sobre un candidato, con la sesión del usuario.
 *
 * El trabajo vive en `lib/agentes/analisis.ts` porque el cron necesita el mismo
 * análisis sin sesión. Aquí solo queda la autenticación y la traducción del
 * error a un código HTTP.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as AnalyzeInput

  try {
    return Response.json(await analizarTicker(body))
  } catch (e) {
    if (e instanceof AnalisisError) {
      const cuerpo: Record<string, unknown> = { error: e.message }
      if (e.raw != null) cuerpo.raw = e.raw
      return Response.json(cuerpo, { status: e.status })
    }
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
