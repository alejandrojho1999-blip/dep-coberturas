import { authorizeCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { archivarCadenasProgramado } from '@/lib/options/cron-opciones'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Archivo diario de las cadenas de opciones del universo de Gamma y Theta.
 *
 * No es una función del sistema de trading: no lee ni escribe posiciones. Es
 * recolección de datos para un backtest futuro. El de hoy tuvo que reconstruir
 * las primas con Black-Scholes porque no existe histórico gratuito de cadenas, y
 * ese supuesto es justo la capa que decide si los agentes ganan. Con doce o
 * dieciocho meses de este archivo habrá datos reales para responderlo.
 *
 * **Quien dispara esto ya no es la nube.** Desde el 2026-09-08 el planificador
 * es el crontab del VPS (`scripts/opciones/`). La ruta se conserva como respaldo
 * y para dispararla a mano; la ventana horaria y la fecha de Nueva York viven en
 * `archivarCadenasProgramado`, compartida con el cron.
 */
async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }

  const r = await archivarCadenasProgramado(admin)

  return Response.json(r, {
    // Que fallen algunos tickers sueltos es normal —Yahoo tiene huecos— y no
    // debe poner el cron en rojo. Que fallen todos sí: significa que la fuente
    // cambió o que las credenciales caducaron, y eso hay que verlo.
    status: r.ejecutado && r.archivados === 0 ? 500 : 200,
  })
}

export const GET = handle
export const POST = handle
