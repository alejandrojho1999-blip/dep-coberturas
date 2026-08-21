import type { AgentRec } from '@/lib/agentes/types'
import { estaAbierta } from '@/lib/agentes/types'
import type { DailyClose } from './types'

/**
 * Fecha con la que el portafolio da por cerrada una posición.
 *
 * A partir de la migración 017 el dato es exacto: los tres caminos de cierre
 * (venta del agente, liquidación al vencimiento y cierre manual) escriben
 * `closed_at`. Las filas cerradas antes de esa migración no lo tienen, y sin
 * una fecha la curva de equity no puede saber cuándo el dinero volvió a caja.
 * Para ellas se infiere aquí, nunca escribiendo en la base de datos.
 */

/** Tolerancia relativa al casar `precio_venta` con un cierre diario. */
const TOLERANCIA = 0.005

export interface ClosedDate {
  /** Día natural YYYY-MM-DD, o null si la posición sigue abierta. */
  date: string | null
  /** true si la fecha se dedujo en vez de leerse de `closed_at`. */
  estimada: boolean
}

/** Día natural de una fecha ISO, en UTC. */
export function isoDay(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

/**
 * Deduce la fecha de cierre de una posición cerrada sin `closed_at`.
 *
 * En opciones el contrato dejó de existir el día del vencimiento, que está
 * guardado en el informe. En acciones se busca la primera sesión posterior a
 * la entrada cuyo cierre coincida con el precio de venta que anotó el agente:
 * ese precio fue un precio de mercado real, así que la coincidencia identifica
 * el día. Si no aparece, se usa la última sesión disponible y se marca la
 * fecha como estimada para que la interfaz pueda advertirlo.
 */
export function resolveClosedDate(rec: AgentRec, closes?: DailyClose[]): ClosedDate {
  if (estaAbierta(rec)) return { date: null, estimada: false }

  if (rec.closed_at) return { date: isoDay(rec.closed_at), estimada: false }

  const expiration = (rec.ai_report ?? {}).expiration as string | undefined
  if (expiration) return { date: expiration, estimada: true }

  const salida = rec.precio_venta
  if (salida != null && closes && closes.length > 0) {
    const desde = isoDay(rec.created_at)
    const match = closes.find(c => c.date >= desde && Math.abs(c.close - salida) <= Math.abs(salida) * TOLERANCIA)
    if (match) return { date: match.date, estimada: true }
    const ultima = closes[closes.length - 1]
    if (ultima.date >= desde) return { date: ultima.date, estimada: true }
  }

  // Sin histórico ni vencimiento no queda referencia alguna: se ancla en la
  // fecha de entrada, que al menos mantiene la posición dentro del periodo.
  return { date: isoDay(rec.created_at), estimada: true }
}
