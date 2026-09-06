import { authorizeCron, cronUserId } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  describeMarketStatus,
  enVentanaPrecierre,
  marketStatus,
  minutosParaCierre,
  PRECIERRE_MINUTOS,
} from '@/lib/market-hours'
import {
  CASCADA_CATEGORIES,
  ejecutarCascada,
  isCascadaCategory,
  type CascadaCategory,
  type CascadaResult,
} from '@/lib/agentes/cascada'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// El screener recorre ~440 tickers de Yahoo en lotes de 25 antes de que empiece
// lo demás. Es el paso lento de toda la cascada.
export const maxDuration = 300

/**
 * Ejecución programada de los agentes Peter y Small.
 *
 * Es la versión sin sesión del botón «Ejecutar» de `/agentes`: misma cascada,
 * misma función `ejecutarCascada`, pero autenticada con un secreto compartido y
 * operando sobre la cuenta de `CRON_USER_ID`.
 *
 * Corre una vez al día y no más. No es tacañería de tokens: los fundamentales
 * de Lynch se publican por trimestres, así que dos pasadas el mismo día
 * evaluarían los mismos números y solo moverían el ruido del precio. El dedupe
 * de `agent_recommendations` protege de todos modos contra duplicar una
 * posición viva, de manera que repetir la ejecución es inofensivo, solo inútil.
 *
 * Y corre una hora antes del cierre, para que dé tiempo a abrir o cerrar la
 * posición recomendada ese mismo día. Como el horario del planificador se fija
 * en UTC y el desfase con Nueva York cambia dos veces al año, el workflow
 * dispara a las 19:00 y a las 20:00 UTC y `enVentanaPrecierre` deja pasar solo
 * la que caiga a una hora del cierre. `?forzar=1` salta esa ventana para poder
 * lanzarlo a mano; lo que no se salta nunca es que el mercado esté abierto.
 *
 * Con `?agente=peter` o `?agente=small` se ejecuta uno solo. Sin parámetro van
 * los dos, en serie: el screener mantiene dos cachés independientes y lanzarlos
 * a la vez duplicaría la carga contra Yahoo en el mismo instante.
 */
async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const userId = cronUserId()
  if (!userId) {
    return Response.json({ error: 'CRON_USER_ID no está configurado' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const pedido = searchParams.get('agente')
  let categorias: readonly CascadaCategory[] = CASCADA_CATEGORIES
  if (pedido) {
    const mapa: Record<string, string> = { peter: 'PETER_LYNCH', small: 'SMALL_CAPS' }
    const cat = mapa[pedido.toLowerCase()] ?? pedido.toUpperCase()
    if (!isCascadaCategory(cat)) {
      return Response.json(
        { error: `agente no reconocido: ${pedido}. Usa 'peter' o 'small'.` },
        { status: 400 },
      )
    }
    categorias = [cat]
  }

  // El paso 4 pide el precio real de mercado y de él salen el precio de entrada,
  // el objetivo y el stop. Fuera de sesión Yahoo devuelve el último cierre, así
  // que la recomendación nacería anclada a un precio que ya no existe.
  const ahora = new Date()
  const estado = marketStatus(ahora)
  if (!estado.abierto) {
    return Response.json({
      ejecutado: false,
      motivo: estado.motivo,
      mensaje: describeMarketStatus(estado),
    })
  }

  const forzar = searchParams.get('forzar') === '1'
  if (!forzar && !enVentanaPrecierre(ahora)) {
    const faltan = minutosParaCierre(ahora)
    return Response.json({
      ejecutado: false,
      motivo: 'fuera-de-ventana',
      mensaje: `Faltan ${faltan} min para el cierre; la ventana apunta a ${PRECIERRE_MINUTOS} min. Usa ?forzar=1 para ejecutar igualmente.`,
    })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }

  const resultados: CascadaResult[] = []
  const errores: string[] = []

  for (const category of categorias) {
    try {
      resultados.push(await ejecutarCascada(admin, userId, category))
    } catch (e) {
      errores.push(`${category}: ${(e as Error).message}`)
    }
  }

  const creadas = resultados.reduce((n, x) => n + x.creadas, 0)
  const vendidas = resultados.reduce((n, x) => n + x.vendidas, 0)
  const fallidos = resultados.reduce((n, x) => n + x.fallidos, 0)
  const truncadas = resultados.reduce((n, x) => n + x.truncadas, 0)

  return Response.json({
    ejecutado: true,
    mensaje: describeMarketStatus(estado),
    creadas,
    vendidas,
    fallidos,
    truncadas,
    errores,
    resultados,
  }, {
    // Un fallo parcial tiene que ser visible en el panel del planificador, no
    // esconderse tras un 200 con el detalle enterrado en el cuerpo.
    status: errores.length ? 500 : 200,
  })
}

export const GET = handle
export const POST = handle
