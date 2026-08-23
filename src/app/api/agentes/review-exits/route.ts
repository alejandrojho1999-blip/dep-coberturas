import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin'
import { isOptionCategory, runExitReview } from '@/lib/options/exit-review-run'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Revisión de los niveles de salida de las posiciones vivas de un agente de
 * opciones, con la sesión del usuario que la pide.
 *
 * Antes esto era un bucle en el navegador que encadenaba una petición por paso.
 * Aquí ocurre entero en el servidor. La versión programada vive en
 * `/api/cron/review-exits` y comparte el mismo `runExitReview`.
 *
 * Lo que NO es: vigilancia continua. Cierra lo que ya tocó un nivel, asumiendo
 * que la orden OCO del bróker saltó sola. La protección real vive en el bróker.
 */
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // Cierra posiciones, así que es escritura sobre la cartera del administrador.
  if (!isAdminEmail(user.email)) {
    return Response.json(
      { error: 'Solo el administrador puede modificar las recomendaciones' },
      { status: 403 }
    )
  }

  let body: { category?: unknown }
  try {
    body = await request.json() as { category?: unknown }
  } catch {
    return Response.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  if (!isOptionCategory(body.category)) {
    return Response.json(
      { error: 'category debe ser OPTIONS_GAMMA u OPTIONS_THETA' },
      { status: 400 }
    )
  }

  try {
    const result = await runExitReview(supabase, user.id, body.category)
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
