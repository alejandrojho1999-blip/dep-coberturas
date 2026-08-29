import { authorizeCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { marketMoment } from '@/lib/market-hours'
import { archivarCadenas, UNIVERSO_ARCHIVO } from '@/lib/options/chain-archive-run'

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
 * Corre **después del cierre**, no durante la sesión: a media tarde la horquilla
 * se mueve y el interés abierto todavía es el de ayer, así que dos capturas del
 * mismo día no serían comparables. Al cierre el dato está quieto.
 */
const CIERRE_ET = 16 * 60          // 16:00 en Nueva York
const VENTANA_TRAS_CIERRE_MIN = 180 // hasta las 19:00 ET

async function handle(request: Request): Promise<Response> {
  const auth = authorizeCron(request)
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  // La fecha la manda Nueva York, no el servidor: un cron que corre a las 21:05
  // UTC ya está en el día siguiente en Europa y archivaría la sesión con la
  // fecha equivocada, que es un error imposible de detectar meses después.
  const momento = marketMoment(new Date())

  if (momento.diaSemana === 0 || momento.diaSemana === 6) {
    return Response.json({
      ejecutado: false,
      motivo: 'fin-de-semana',
      mensaje: `${momento.fechaET} no es día de mercado`,
    })
  }

  // Antes del cierre los precios se mueven; mucho después, Yahoo ya ha empezado
  // a reflejar la sesión siguiente en los contratos más líquidos.
  if (momento.minutosET < CIERRE_ET || momento.minutosET > CIERRE_ET + VENTANA_TRAS_CIERRE_MIN) {
    return Response.json({
      ejecutado: false,
      motivo: 'fuera-de-ventana',
      mensaje: 'El archivo se captura entre las 16:00 y las 19:00 de Nueva York',
    })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 })
  }

  const r = await archivarCadenas(admin, momento.fechaET)

  return Response.json({
    ejecutado: true,
    fecha: r.fecha,
    universo: UNIVERSO_ARCHIVO.length,
    archivados: r.archivados,
    contratos: r.contratos,
    kb: Math.round(r.bytes / 1024),
    vacios: r.vacios,
    fallidos: r.fallidos,
    log: r.log,
  }, {
    // Que fallen algunos tickers sueltos es normal —Yahoo tiene huecos— y no
    // debe poner el cron en rojo. Que fallen todos sí: significa que la fuente
    // cambió o que las credenciales caducaron, y eso hay que verlo.
    status: r.archivados === 0 ? 500 : 200,
  })
}

export const GET = handle
export const POST = handle
