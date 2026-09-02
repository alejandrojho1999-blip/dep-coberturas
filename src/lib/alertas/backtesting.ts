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

import { huboMovimiento, VENTANA_JUICIO, type MovimientoMedido } from '@/lib/alertas/calibracion'

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

/** Porcentaje con signo, para los retornos. Nulo se escribe como raya. */
export function pctConSigno(valor: number | null, decimales = 1): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  const n = valor * 100
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimales)}%`
}
