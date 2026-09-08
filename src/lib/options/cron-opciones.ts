/**
 * Las dos tareas programadas de opciones, sin HTTP de por medio.
 *
 * Vivían dentro de sus rutas de API porque el planificador era GitHub Actions y
 * la única forma de disparar trabajo era una petición. Eso resultó ser caro: el
 * `schedule` de GitHub no es puntual y, medido el 2026-09-08, se comía el 80 %
 * de las citas de la revisión de salidas —dos o tres ejecuciones al día de las
 * catorce declaradas—. El planificador pasa al VPS, que ya sostiene el motor de
 * alerta temprana y la cascada de agentes con este mismo patrón.
 *
 * La lógica sale aquí, y no se duplica en un script, para que la ruta HTTP y el
 * cron ejecuten literalmente el mismo código. Dos copias de una regla de ventana
 * horaria son dos reglas que acaban divergiendo, y la divergencia solo se vería
 * al comparar un archivo con fecha equivocada meses después.
 *
 * Estas funciones **no autentican**: la ruta comprueba el secreto compartido y
 * el cron corre ya como root en la máquina. Aquí solo está la decisión de si
 * toca trabajar y el trabajo en sí.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { describeMarketStatus, marketMoment, marketStatus } from '@/lib/market-hours'
import { archivarCadenas, UNIVERSO_ARCHIVO } from '@/lib/options/chain-archive-run'
import {
  OPTION_CATEGORIES,
  runExitReview,
  type ExitReviewResult,
} from '@/lib/options/exit-review-run'

/** Resultado común: lo primero que hay que saber es si llegó a ejecutarse. */
interface Programada {
  ejecutado: boolean
  /** Por qué no se ejecutó. Ausente cuando sí lo hizo. */
  motivo?: string
  mensaje: string
}

export interface ResultadoRevision extends Programada {
  cerradas: number
  fallidos: number
  errores: string[]
  resultados: ExitReviewResult[]
}

export interface ResultadoArchivoProgramado extends Programada {
  fecha?: string
  universo?: number
  archivados?: number
  contratos?: number
  kb?: number
  /** Tickers cuya cadena no traía contratos utilizables. */
  vacios?: string[]
  /** Tickers que fallaron, con el motivo. Que haya algunos es normal. */
  fallidos?: Array<{ ticker: string; error: string }>
  log?: string[]
}

/**
 * Revisión de los niveles de salida de Gamma y Theta.
 *
 * No es un stop automático y no debe nombrarse como tal. Entre dos ejecuciones
 * no vigila nadie: la protección real es la orden puesta en el bróker, y esto
 * solo pone al día el registro con lo que ya ocurrió en la cuenta.
 *
 * Solo corre con la sesión regular abierta. Cotizar fuera de ella sería comparar
 * los niveles contra la horquilla congelada del último cierre.
 */
export async function revisarSalidasProgramada(
  admin: SupabaseClient,
  userId: string,
  ahora = new Date(),
): Promise<ResultadoRevision> {
  const estado = marketStatus(ahora)
  const mensaje = describeMarketStatus(estado)

  if (!estado.abierto) {
    return { ejecutado: false, motivo: estado.motivo, mensaje, cerradas: 0, fallidos: 0, errores: [], resultados: [] }
  }

  const resultados: ExitReviewResult[] = []
  const errores: string[] = []

  for (const category of OPTION_CATEGORIES) {
    try {
      resultados.push(await runExitReview(admin, userId, category))
    } catch (e) {
      // Que falle Gamma no puede impedir que se revise Theta: son carteras
      // distintas y cada una se mide contra su propio capital.
      errores.push(`${category}: ${(e as Error).message}`)
    }
  }

  return {
    ejecutado: true,
    mensaje,
    cerradas: resultados.reduce((n, r) => n + r.cerradas, 0),
    fallidos: resultados.reduce((n, r) => n + r.fallidos, 0),
    errores,
    resultados,
  }
}

/** 16:00 en Nueva York, en minutos desde medianoche. */
const CIERRE_ET = 16 * 60
/** Hasta las 19:00 ET. */
const VENTANA_TRAS_CIERRE_MIN = 180

/**
 * Archivo diario de las cadenas de opciones del universo de Gamma y Theta.
 *
 * Recolección de datos, no una función del sistema de trading: no lee ni escribe
 * posiciones. El backtest de opciones tuvo que reconstruir las primas con
 * Black-Scholes porque no existe histórico gratuito de cadenas, y ese supuesto
 * es justo la capa que decide si los agentes ganan.
 *
 * Corre después del cierre, no durante la sesión: a media tarde la horquilla se
 * mueve y el interés abierto todavía es el de ayer, así que dos capturas del
 * mismo día no serían comparables. Al cierre el dato está quieto.
 *
 * La fecha la manda Nueva York, no el reloj del servidor: a las 21:05 UTC en
 * Europa ya es el día siguiente, y archivar la sesión con la fecha equivocada es
 * un error imposible de detectar meses después.
 */
export async function archivarCadenasProgramado(
  admin: SupabaseClient,
  ahora = new Date(),
): Promise<ResultadoArchivoProgramado> {
  const momento = marketMoment(ahora)

  if (momento.diaSemana === 0 || momento.diaSemana === 6) {
    return {
      ejecutado: false,
      motivo: 'fin-de-semana',
      mensaje: `${momento.fechaET} no es día de mercado`,
    }
  }

  // Antes del cierre los precios se mueven; mucho después, Yahoo ya empieza a
  // reflejar la sesión siguiente en los contratos más líquidos.
  if (momento.minutosET < CIERRE_ET || momento.minutosET > CIERRE_ET + VENTANA_TRAS_CIERRE_MIN) {
    return {
      ejecutado: false,
      motivo: 'fuera-de-ventana',
      mensaje: 'El archivo se captura entre las 16:00 y las 19:00 de Nueva York',
    }
  }

  const r = await archivarCadenas(admin, momento.fechaET)

  return {
    ejecutado: true,
    mensaje: `Archivo de ${momento.fechaET}`,
    fecha: r.fecha,
    universo: UNIVERSO_ARCHIVO.length,
    archivados: r.archivados,
    contratos: r.contratos,
    kb: Math.round(r.bytes / 1024),
    vacios: r.vacios,
    fallidos: r.fallidos,
    log: r.log,
  }
}
