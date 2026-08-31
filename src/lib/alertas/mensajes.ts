/**
 * Textos de los mensajes de WhatsApp.
 *
 * Se leen en el móvil, muchas veces de madrugada y con prisa, así que el orden
 * es siempre el mismo: qué ha pasado, dónde está el precio, dónde va la orden.
 * Sin adornos y sin obligar a abrir el enlace para entender el aviso.
 *
 * Todo el formateo vive aquí y se prueba aparte, porque un número mal escrito
 * en una orden stop es dinero real.
 */

import type { Clasificacion } from '@/lib/alertas/clasificador'
import type { NivelOrden } from '@/lib/alertas/niveles'
import type { SimboloAlerta } from '@/lib/alertas/simbolos'
import type { Titular } from '@/lib/alertas/rss'
import type { ProbabilidadTasas } from '@/lib/alertas/fedwatch'
import type { MetricaDebasement } from '@/lib/alertas/debasement'
import { formatearFalta, type EventoCalendario } from '@/lib/alertas/calendario'

export interface NivelConSimbolo {
  simbolo: SimboloAlerta
  nivel: NivelOrden
}

/** Formato español: punto para los miles y coma para los decimales. */
export function num(valor: number, decimales = 2): string {
  return valor.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

export function pct(valor: number | null, decimales = 1): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return `${valor >= 0 ? '+' : ''}${num(valor, decimales)}%`
}

/** Hora de Ecuador, que es donde se lee el mensaje. */
export function horaEcuador(iso: string | null): string {
  if (!iso) return 'hora desconocida'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'hora desconocida'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(t)) + ' ECT'
}

const SEMAFORO: Record<number, string> = { 1: '⚪', 2: '🟡', 3: '🟠', 4: '🔴', 5: '🚨' }

export function lineaNivel({ simbolo, nivel }: NivelConSimbolo): string {
  const verbo = nivel.direccion === 'buy' ? 'buy stop' : 'sell stop'
  return `${simbolo.etiqueta}: ${num(nivel.precio, simbolo.decimales)} → ${verbo} ${num(nivel.nivel, simbolo.decimales)}`
    + `  (ATR14 ${num(nivel.atr, simbolo.decimales)}, ${num(nivel.distanciaPct, 2)}%)`
}

export function mensajeGuerra(params: {
  titular: Titular
  clasificacion: Clasificacion
  niveles: NivelConSimbolo[]
  mercadoAbierto: boolean
  faltantes?: string[]
}): string {
  const { titular, clasificacion, niveles, mercadoAbierto, faltantes = [] } = params
  const icono = SEMAFORO[clasificacion.severidad] ?? '⚪'

  const lineas = [
    `${icono} ESCALADA RUSIA–OTAN · severidad ${clasificacion.severidad}/5`,
    titular.titulo,
    `${titular.fuente} · ${horaEcuador(titular.publicadoAt)}`,
    titular.url,
    '',
    ...(clasificacion.resumen ? [clasificacion.resumen, ''] : []),
    ...niveles.map(lineaNivel),
  ]

  if (!niveles.length) lineas.push('Sin niveles: no se pudo cotizar ningún activo.')
  if (faltantes.length) lineas.push(`Sin nivel: ${faltantes.join(', ')}`)

  lineas.push('', mercadoAbierto ? 'Mercado: sesión regular abierta.' : 'Mercado: fuera de sesión regular, precios de futuros.')
  if (clasificacion.motivo) lineas.push(`Lectura: ${clasificacion.motivo}`)

  return lineas.join('\n')
}

export function mensajeMacro(params: {
  titular: Titular
  clasificacion: Clasificacion
  probabilidad?: ProbabilidadTasas | null
}): string {
  const { titular, clasificacion, probabilidad } = params
  const icono = SEMAFORO[clasificacion.severidad] ?? '⚪'

  const lineas = [
    `${icono} FED vs TESORO · severidad ${clasificacion.severidad}/5`,
    titular.titulo,
    `${titular.fuente} · ${horaEcuador(titular.publicadoAt)}`,
    titular.url,
  ]

  if (clasificacion.resumen) lineas.push('', clasificacion.resumen)
  if (clasificacion.motivo) lineas.push(`Lectura: ${clasificacion.motivo}`)
  if (probabilidad) lineas.push('', lineaProbabilidad(probabilidad))

  return lineas.join('\n')
}

export function lineaProbabilidad(p: ProbabilidadTasas): string {
  return `Prob. próxima reunión (${p.etiqueta}): subir ${num(p.probSubida, 1)}% · mantener ${num(p.probMantener, 1)}% · bajar ${num(p.probBajada, 1)}%`
}

export function mensajeSnapshot(params: {
  probabilidad: ProbabilidadTasas
  metricas: MetricaDebasement[]
  proximaReunionFaltaMin: number | null
}): string {
  const { probabilidad, metricas, proximaReunionFaltaMin } = params

  const lineas = [
    '📊 PULSO MACRO',
    lineaProbabilidad(probabilidad),
    `Tasa efectiva actual ${num(probabilidad.tasaActual, 2)}% → implícita tras la reunión ${num(probabilidad.tasaImplicitaPost, 3)}%`,
    `Contrato ${probabilidad.contrato} a ${num(probabilidad.precioContrato, 3)}${probabilidad.aproximado ? ' (aproximado)' : ''}`,
  ]

  if (proximaReunionFaltaMin != null) {
    lineas.push(`Faltan ${formatearFalta(proximaReunionFaltaMin)} para la decisión.`)
  }

  if (metricas.length) {
    lineas.push('', 'Envilecimiento:')
    for (const m of metricas) {
      const variacion = m.var12mPct == null ? '' : ` (12m ${pct(m.var12mPct)})`
      lineas.push(`· ${m.etiqueta}: ${num(m.valor, m.unidad === '%' ? 2 : 2)} ${m.unidad}${variacion}`)
    }
  }

  return lineas.join('\n')
}

export function mensajeAvisoPrevio(params: {
  evento: EventoCalendario
  faltanMin: number
  probabilidad?: ProbabilidadTasas | null
}): string {
  const { evento, faltanMin, probabilidad } = params
  const que = evento.tipo === 'fomc' ? 'DECISIÓN DE TASAS EEUU' : 'DATO DE INFLACIÓN EEUU (IPC)'

  const lineas = [
    `⏰ ${que} en ${formatearFalta(faltanMin)}`,
    `${evento.etiqueta} · ${evento.fechaET} ${horaTexto(evento.horaET)} Nueva York`,
  ]

  if (probabilidad) lineas.push('', lineaProbabilidad(probabilidad))

  lineas.push(
    '',
    'Si suben tasas: Nasdaq y S&P a la baja, se preparan sell stop.',
    'Si mantienen o bajan: se aprecian los activos de riesgo.',
  )

  return lineas.join('\n')
}

export function horaTexto(minutosDesdeMedianoche: number): string {
  const h = Math.floor(minutosDesdeMedianoche / 60)
  const m = minutosDesdeMedianoche % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Mensaje del momento de la publicación.
 *
 * Sale con los dos escenarios porque el comunicado tarda unos minutos en ser
 * legible y el precio no espera: quien lee esto necesita ya los dos niveles
 * calculados, y la confirmación llega en el mensaje siguiente.
 */
export function mensajeDecision(params: {
  evento: EventoCalendario
  nivelesVenta: NivelConSimbolo[]
  nivelesCompra: NivelConSimbolo[]
  probabilidad?: ProbabilidadTasas | null
  titularComunicado?: Titular | null
}): string {
  const { evento, nivelesVenta, nivelesCompra, probabilidad, titularComunicado } = params

  const lineas = [
    `🚨 ${evento.tipo === 'fomc' ? 'PUBLICACIÓN DE TASAS' : 'PUBLICACIÓN DEL IPC'} · ${evento.etiqueta}`,
  ]

  if (titularComunicado) {
    lineas.push(titularComunicado.titulo, titularComunicado.url)
  } else {
    lineas.push('Comunicado aún no localizado; niveles preparados para ambos escenarios.')
  }

  if (probabilidad) lineas.push('', lineaProbabilidad(probabilidad))

  if (nivelesVenta.length) {
    lineas.push('', 'SI SUBEN TASAS (riesgo a la baja):', ...nivelesVenta.map(lineaNivel))
  }
  if (nivelesCompra.length) {
    lineas.push('', 'SI MANTIENEN O BAJAN (riesgo al alza):', ...nivelesCompra.map(lineaNivel))
  }

  return lineas.join('\n')
}
