import type { AgentRec } from '@/lib/agentes/types'
import type { OccOptionType, OptionContractRef } from './occ-symbol'
import { CONTRACT_MULTIPLIER } from './settlement'

/**
 * Valoración a mercado de las recomendaciones de opciones de Gamma y Theta.
 *
 * Vivía dentro de la pantalla de Recomendaciones; se extrajo aquí porque los
 * portafolios necesitan exactamente el mismo cálculo y dos implementaciones
 * del P&L de un contrato acabarían divergiendo.
 */

/**
 * Extrae el contrato de opción de una recomendación de agente.
 * Devuelve null si el `ai_report` no trae strike/expiración/tipo utilizables.
 *
 * Solo pide los dos campos que usa, para que también valga con las filas
 * recortadas que manejan los agentes en su paso 0.
 */
export function optionRefFromRec(rec: Pick<AgentRec, 'ticker' | 'ai_report'>): OptionContractRef | null {
  const rpt = rec.ai_report ?? {}
  const strike = rpt.strike as number | undefined
  const expiration = rpt.expiration as string | undefined
  if (strike == null || !expiration) return null
  // THETA guarda la estrategia en vez del tipo: SELL_PUT es un put, el resto call.
  const rawType = rpt.optionType as string | undefined
  const type: OccOptionType = rawType === 'PUT' || rawType === 'CALL'
    ? rawType
    : (rpt.strategy === 'SELL_PUT' ? 'PUT' : 'CALL')
  return { ticker: rec.ticker, expiration, strike, type }
}

export interface OptionOutcome {
  /** Resultado en dólares para 1 contrato = 100 acciones. */
  usd: number
  /** Resultado sobre la prima, en porcentaje. */
  pct: number | null
  /** Valor por acción con el que se calcula el resultado. */
  valorActual: number
  /** true si el contrato ya venció y la cifra es definitiva. */
  cerrada: boolean
  /** Desglose legible del cálculo, para el tooltip. */
  detalle: string
}

/** Lado de la operación: Gamma compra la prima, Theta la cobra. */
export type OptionSide = 'long' | 'short'

/**
 * Lado que le corresponde a una recomendación según el agente que la generó.
 */
export function sideForCategory(category: string): OptionSide {
  return category === 'OPTIONS_THETA' ? 'short' : 'long'
}

/**
 * Resultado de una recomendación de opciones, siempre expresado sobre 1
 * contrato estándar (100 acciones).
 *
 * Para una posición viva se compara la prima de entrada con la prima que
 * cotiza ahora. Para una vencida se usa el valor de liquidación que dejó
 * grabado el agente en `precio_venta`.
 *
 * El signo depende del lado: GAMMA compra la prima y gana si sube; THETA la
 * cobra al abrir y gana si cae.
 */
export function optionOutcome(
  rec: AgentRec,
  primaViva: number | undefined,
  side: OptionSide
): OptionOutcome | null {
  const entrada = rec.precio_entrada
  if (entrada == null || entrada === 0) return null

  const cerrada = rec.precio_venta != null
  const valorActual = cerrada ? rec.precio_venta! : primaViva
  if (valorActual == null) return null

  const porAccion = side === 'short' ? entrada - valorActual : valorActual - entrada
  const usd = porAccion * CONTRACT_MULTIPLIER
  const cobro = side === 'short' ? 'cobrada' : 'pagada'
  const cierre = cerrada ? 'liquidación al vencimiento' : 'prima actual'

  return {
    usd,
    pct: (porAccion / entrada) * 100,
    valorActual,
    cerrada,
    detalle:
      `Prima ${cobro}: $${entrada.toFixed(2)} × 100 = $${(entrada * CONTRACT_MULTIPLIER).toFixed(2)}\n` +
      `Valor (${cierre}): $${valorActual.toFixed(2)} × 100 = $${(valorActual * CONTRACT_MULTIPLIER).toFixed(2)}\n` +
      `Resultado: ${usd >= 0 ? '+' : '−'}$${Math.abs(usd).toFixed(2)} por contrato`,
  }
}
