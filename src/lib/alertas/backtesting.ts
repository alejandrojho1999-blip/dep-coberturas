/**
 * Lectura del corpus de eventos medidos.
 *
 * Las tablas `severity_events` y `severity_event_moves` guardan qué hizo el
 * precio después de cada hecho histórico del patrón oro. Este módulo las
 * convierte en las cifras que la ficha enseña.
 *
 * La agrupación por **clase** es el motivo de que el corpus exista. La pregunta
 * útil no es «cuánto movió este dron» sino «cuánto mueve un dron, en general»:
 * una sola incursión es una anécdota y cuatro son una expectativa.
 *
 * Todo aquí es puro. Quien lee de la base es la página.
 */

import {
  huboMovimiento,
  magnitudComparable,
  UMBRAL_MATERIAL,
  VENTANA_JUICIO,
  type MovimientoMedido,
} from '@/lib/alertas/calibracion'

export interface Movimiento extends MovimientoMedido {
  ventana: number
  /** Retorno de cierre a cierre, en tanto por uno. Nulo si el activo no cotizaba. */
  retorno: number | null
}

export interface EventoMedido {
  fecha: string
  titulo: string
  tramo: string
  tema: string
  clase: string
  severidad: number
  nota: string | null
  movimientos: readonly Movimiento[]
}

/** Los tres activos que resumen la reacción sin llenar la pantalla. */
export const TICKERS_RESUMEN = ['GC=F', '^VIX', 'ES=F'] as const

export const ETIQUETA_TICKER: Record<string, string> = {
  'GC=F': 'Oro',
  'SI=F': 'Plata',
  'BTC-USD': 'Bitcoin',
  'CL=F': 'WTI',
  'NQ=F': 'Nasdaq',
  'ES=F': 'S&P 500',
  '^VIX': 'VIX',
  'DX-Y.NYB': 'Dólar',
}

export const ETIQUETA_TRAMO: Record<string, string> = {
  principal: 'Principal (2022→hoy)',
  control_2014: 'Control 2014-2020',
  control_shocks: 'Control de shocks',
  placebo: 'Grupo de control (fechas al azar)',
}

/**
 * El tramo que no es un hecho sino el denominador.
 *
 * Sus filas son fechas de sesión elegidas al azar, sin suceso detrás. Se separan
 * de todo lo demás porque mezclarlas con los hechos curados haría mentir a
 * cualquier media: la severidad 1 de una fecha de control no significa «leve»,
 * significa que no hay nada que puntuar.
 */
export const TRAMO_PLACEBO = 'placebo'

export function esPlacebo(evento: EventoMedido): boolean {
  return evento.tramo === TRAMO_PLACEBO
}

/** Los hechos curados: todo menos el grupo de control. */
export function soloCurados(eventos: readonly EventoMedido[]): EventoMedido[] {
  return eventos.filter((e) => !esPlacebo(e))
}

/**
 * Con qué frecuencia se mueve el precio en un día cualquiera.
 *
 * Es la cifra que da sentido a todas las demás. Sin ella, «el 86% de estos
 * eventos movió el mercado» no se puede interpretar: puede ser mucho o puede ser
 * menos que el azar. Devuelve `null` cuando todavía no hay grupo de control,
 * que no es lo mismo que cero.
 */
export function lineaBase(eventos: readonly EventoMedido[]): { base: number; n: number } | null {
  const placebo = eventos.filter(esPlacebo)
  if (!placebo.length) return null
  return {
    base: placebo.filter(eventoMovioElPrecio).length / placebo.length,
    n: placebo.length,
  }
}

/**
 * El movimiento de un activo en la ventana de juicio.
 *
 * Devuelve `null` cuando no hay medición, que no es lo mismo que cero: el activo
 * no cotizaba esa fecha (Bitcoin antes de 2014) o la ventana no llegó a cerrar.
 */
export function movimientoDe(
  evento: EventoMedido,
  ticker: string,
  ventana = VENTANA_JUICIO,
): Movimiento | null {
  return evento.movimientos.find((m) => m.ticker === ticker && m.ventana === ventana) ?? null
}

/** Los movimientos de la ventana de juicio, que son los que deciden el veredicto. */
export function movimientosDeJuicio(evento: EventoMedido): Movimiento[] {
  return evento.movimientos.filter((m) => m.ventana === VENTANA_JUICIO)
}

/** ¿Superó algún activo su umbral tras este evento? */
export function eventoMovioElPrecio(evento: EventoMedido): boolean {
  return huboMovimiento(movimientosDeJuicio(evento))
}

export interface ResumenClase {
  clase: string
  n: number
  /** Severidad media que el analista asignó a los eventos de esta familia. */
  severidadMedia: number
  /** Cuántos de ellos movieron algún activo por encima de su umbral. */
  movieron: number
  /** Media del retorno del oro a cinco sesiones, en tanto por uno. */
  oroMedio: number | null
  /** Media del mayor desplazamiento del VIX, en tanto por uno. */
  vixExtremoMedio: number | null
}

function media(valores: readonly number[]): number | null {
  if (!valores.length) return null
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

/**
 * Qué hace, en general, cada familia de suceso.
 *
 * Ordena por número de casos y luego por nombre, para que la tabla no baile
 * entre recargas y las familias con más respaldo salgan arriba.
 */
export function resumirPorClase(eventos: readonly EventoMedido[]): ResumenClase[] {
  const porClase = new Map<string, EventoMedido[]>()
  for (const e of eventos) {
    porClase.set(e.clase, [...(porClase.get(e.clase) ?? []), e])
  }

  const resumenes: ResumenClase[] = []
  for (const [clase, delGrupo] of porClase) {
    const oros = delGrupo
      .map((e) => movimientoDe(e, 'GC=F')?.retorno)
      .filter((v): v is number => v != null)
    const vix = delGrupo
      .map((e) => movimientoDe(e, '^VIX')?.extremo)
      .filter((v): v is number => v != null)

    resumenes.push({
      clase,
      n: delGrupo.length,
      severidadMedia: delGrupo.reduce((a, e) => a + e.severidad, 0) / delGrupo.length,
      movieron: delGrupo.filter(eventoMovioElPrecio).length,
      oroMedio: media(oros),
      vixExtremoMedio: media(vix),
    })
  }

  return resumenes.sort((a, b) => b.n - a.n || a.clase.localeCompare(b.clase))
}

export interface ResumenGlobal {
  eventos: number
  mediciones: number
  movieron: number
  /** Eventos con severidad 4 o 5 que no movieron ni un activo. */
  gravesSinEfecto: number
  /** Eventos con severidad 1 o 2 que sí movieron algo. */
  levesConEfecto: number
}

/**
 * Las cifras de cabecera.
 *
 * `gravesSinEfecto` y `levesConEfecto` son las dos que importan: cada una es un
 * caso donde la etiqueta del analista y el mercado no coinciden, que es
 * justamente lo que el corpus existe para encontrar.
 */
export function resumirGlobal(eventos: readonly EventoMedido[]): ResumenGlobal {
  return {
    eventos: eventos.length,
    mediciones: eventos.reduce((a, e) => a + e.movimientos.length, 0),
    movieron: eventos.filter(eventoMovioElPrecio).length,
    gravesSinEfecto: eventos.filter((e) => e.severidad >= 4 && !eventoMovioElPrecio(e)).length,
    levesConEfecto: eventos.filter((e) => e.severidad <= 2 && eventoMovioElPrecio(e)).length,
  }
}

/**
 * El percentil `q` (0-1) de una lista, por interpolación lineal.
 *
 * Con 60 fechas de control no hay muestra para nada sofisticado, y este es el
 * método que usan `numpy` y las hojas de cálculo, así que las cifras se pueden
 * comprobar a mano si alguien duda de ellas.
 */
export function percentil(valores: readonly number[], q: number): number | null {
  if (!valores.length) return null
  const orden = [...valores].sort((a, b) => a - b)
  if (orden.length === 1) return orden[0]
  const pos = (orden.length - 1) * q
  const bajo = Math.floor(pos)
  const alto = Math.ceil(pos)
  if (bajo === alto) return orden[bajo]
  return orden[bajo] + (orden[alto] - orden[bajo]) * (pos - bajo)
}

export interface PerfilActivo {
  ticker: string
  /** El umbral a partir del cual el movimiento se considera material. */
  umbral: number
  /** Mediciones válidas del activo en el grupo de control. */
  n: number
  /** Mediana del desplazamiento en una fecha sin hecho detrás. */
  p50: number | null
  p90: number | null
  /** El desplazamiento más grande que se vio sin que pasara nada. */
  max: number | null
  /** Veces que el activo cruzó su umbral en el grupo de control. */
  cruces: number
  /**
   * Cuánto le falta a un día normal para llegar al umbral, en múltiplos de la
   * mediana. Un 8 significa que el umbral está a ocho veces el día corriente:
   * cuanto más alto, más raro es que salte por casualidad.
   */
  vecesLaMediana: number | null
  /** Las mismas cifras en los hechos curados, para poder comparar. */
  nCurados: number
  p50Curados: number | null
  crucesCurados: number
  /**
   * Cuánto más cruza el umbral con noticia que sin ella, en puntos.
   *
   * Es la única columna que dice si el activo sirve. Se compara en tasa y no en
   * cuenta porque los dos grupos tienen tamaños distintos: 60 fechas de control
   * frente a 32 hechos. Un activo con separación cercana a cero cruza igual
   * pase o no pase algo, así que solo añade ruido al veredicto.
   */
  separacion: number | null
}

/**
 * Cómo se comporta cada activo en un día cualquiera, y a qué distancia queda
 * eso de su umbral.
 *
 * La línea base dice que el 25% de las fechas al azar «mueven el precio», pero
 * no dice **cuánto** ni **cuál**: con esa cifra sola no se sabe si un umbral
 * está bien puesto o si un activo salta por su cuenta. Este perfil enseña la
 * distribución de la que sale ese 25%, activo por activo, que es lo que permite
 * ver cuándo un día se está saliendo de lo suyo y acercándose al umbral de un
 * evento noticioso.
 *
 * Se calcula sobre el `extremo`, igual que el veredicto, y con la misma regla de
 * signo: en el VIX solo cuenta la subida.
 */
export function perfilNormalidad(eventos: readonly EventoMedido[]): PerfilActivo[] {
  const control = eventos.filter(esPlacebo)
  const curados = soloCurados(eventos)

  const magnitudes = (grupo: readonly EventoMedido[], ticker: string): number[] =>
    grupo
      .map((e) => movimientoDe(e, ticker)?.extremo)
      .filter((v): v is number => v != null)
      .map((v) => magnitudComparable(ticker, v))

  return Object.entries(UMBRAL_MATERIAL)
    .map(([ticker, umbral]) => {
      const normales = magnitudes(control, ticker)
      const deEventos = magnitudes(curados, ticker)
      const p50 = percentil(normales, 0.5)
      const cruces = normales.filter((v) => v >= umbral).length
      const crucesCurados = deEventos.filter((v) => v >= umbral).length

      return {
        ticker,
        umbral,
        n: normales.length,
        p50,
        p90: percentil(normales, 0.9),
        max: normales.length ? Math.max(...normales) : null,
        cruces,
        // Con mediana cero o negativa el múltiplo no significa nada: pasa en el
        // VIX, donde más de la mitad de los días normales son de bajada.
        vecesLaMediana: p50 != null && p50 > 0 ? umbral / p50 : null,
        nCurados: deEventos.length,
        p50Curados: percentil(deEventos, 0.5),
        crucesCurados,
        separacion: normales.length && deEventos.length
          ? crucesCurados / deEventos.length - cruces / normales.length
          : null,
      }
    })
    // Por poder discriminante: arriba el activo que más distingue una noticia de
    // un martes cualquiera, que es el orden en el que interesa leerlos.
    .sort((a, b) => (b.separacion ?? -Infinity) - (a.separacion ?? -Infinity)
      || a.ticker.localeCompare(b.ticker))
}

/** Porcentaje con signo, para los retornos. Nulo se escribe como raya. */
export function pctConSigno(valor: number | null, decimales = 1): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const n = valor * 100
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimales)}%`
}
