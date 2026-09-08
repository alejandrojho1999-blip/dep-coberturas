import { authorizeCron, cronUserId } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revisarSalidasProgramada } from '@/lib/options/cron-opciones'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Revisión programada de los niveles de salida de Gamma y Theta.
 *
 * Es la versión sin sesión de `/api/agentes/review-exits`: mismo trabajo, misma
 * función `runExitReview`, pero autenticada con un secreto compartido y
 * operando sobre la cuenta configurada en `CRON_USER_ID`.
 *
 * Sigue sin ser un stop automático. Entre dos ejecuciones no vigila nadie, y la
 * protección real es la orden OCO puesta en el bróker; esto solo pone al día el
 * registro con lo que ya ocurrió en la cuenta.
 *
 * **Quien dispara esto ya no es la nube.** Desde el 2026-09-08 el planificador
 * es el crontab del VPS (`scripts/opciones/`), porque el `schedule` de GitHub
 * Actions se comía el 80 % de las citas. La ruta se conserva como respaldo y
 * para poder dispararla a mano; la decisión de si toca trabajar vive en
 * `revisarSalidasProgramada`, compartida con el cron, para que no puedan
 * divergir.
 */
async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const userId = cronUserId()
  if (!userId) {
    return Response.json({ error: 'CRON_USER_ID no está configurado' }, { status: 503 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }

  const r = await revisarSalidasProgramada(admin, userId)

  return Response.json(r, {
    // Un fallo parcial tiene que ser visible en el panel del planificador,
    // no esconderse tras un 200 con el detalle enterrado en el cuerpo.
    status: r.errores.length ? 500 : 200,
  })
}

export const GET = handle
export const POST = handle
