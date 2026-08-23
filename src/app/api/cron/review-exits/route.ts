import { authorizeCron, cronUserId } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { describeMarketStatus, marketStatus } from '@/lib/market-hours'
import {
  OPTION_CATEGORIES,
  runExitReview,
  type ExitReviewResult,
} from '@/lib/options/exit-review-run'

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
 * El planificador de Vercel usa GET, así que se acepta también POST para poder
 * dispararlo a mano con curl.
 */
async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const userId = cronUserId()
  if (!userId) {
    return Response.json({ error: 'CRON_USER_ID no está configurado' }, { status: 503 })
  }

  // Cotizar fuera de la sesión regular sería comparar los niveles contra la
  // horquilla congelada del último cierre.
  const estado = marketStatus(new Date())
  if (!estado.abierto) {
    return Response.json({
      ejecutado: false,
      motivo: estado.motivo,
      mensaje: describeMarketStatus(estado),
    })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }

  const resultados: ExitReviewResult[] = []
  const errores: string[] = []

  for (const category of OPTION_CATEGORIES) {
    try {
      resultados.push(await runExitReview(admin, userId, category))
    } catch (e) {
      errores.push(`${category}: ${(e as Error).message}`)
    }
  }

  const cerradas = resultados.reduce((n, r) => n + r.cerradas, 0)
  const fallidos = resultados.reduce((n, r) => n + r.fallidos, 0)

  return Response.json({
    ejecutado: true,
    mensaje: describeMarketStatus(estado),
    cerradas,
    fallidos,
    errores,
    resultados,
  }, {
    // Un fallo parcial tiene que ser visible en el panel del planificador,
    // no esconderse tras un 200 con el detalle enterrado en el cuerpo.
    status: errores.length ? 500 : 200,
  })
}

export const GET = handle
export const POST = handle
