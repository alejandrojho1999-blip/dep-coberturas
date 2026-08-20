/**
 * Liquidación de contratos de opciones al vencimiento.
 *
 * Al expirar, una opción vale exactamente su valor intrínseco: lo que se
 * ganaría ejerciéndola contra el precio del subyacente en ese momento. El
 * tiempo ya no vale nada, así que la prima extrínseca desaparece.
 *
 * El signo del resultado depende de si la posición se compró o se vendió:
 * el comprador paga la prima y cobra el valor intrínseco; el vendedor cobra
 * la prima y paga el valor intrínseco.
 */

/** Tamaño estándar de un contrato de opciones en EE. UU. */
export const CONTRACT_MULTIPLIER = 100

export type SettlementPosition =
  /** CALL comprado — Agente Gamma con señal alcista. */
  | 'LONG_CALL'
  /** PUT comprado — Agente Gamma con señal bajista. */
  | 'LONG_PUT'
  /** PUT vendido — Agente Theta cobrando prima. */
  | 'SHORT_PUT'
  /** CALL vendido sobre acciones en cartera — Agente Theta. */
  | 'COVERED_CALL'

export interface SettlementInput {
  position: SettlementPosition
  /** Precio de ejercicio del contrato. */
  strike: number
  /** Prima por acción pagada (comprador) o cobrada (vendedor) al abrir. */
  premium: number
  /** Precio del subyacente en la fecha de vencimiento. */
  underlyingAtExpiry: number
  /** Número de contratos. Por defecto 1 (= 100 acciones). */
  contracts?: number
}

export interface SettlementResult {
  /** Valor del contrato al vencer, por acción. */
  intrinsicValue: number
  /** Resultado por acción, ya con el signo de la posición. */
  pnlPerShare: number
  /** Resultado total en dólares (por acción × 100 × contratos). */
  pnlTotal: number
  /** Resultado sobre la prima, en porcentaje. */
  pnlPct: number | null
  /** true si la opción venció con valor intrínseco. */
  expiredInTheMoney: boolean
  /** true si la posición era vendida (Theta). */
  isShort: boolean
}

const SHORT_POSITIONS: ReadonlySet<SettlementPosition> = new Set<SettlementPosition>([
  'SHORT_PUT',
  'COVERED_CALL',
])

/** Traduce lo que guardan los agentes en `ai_report` a una posición liquidable. */
export function positionFromReport(report: {
  optionType?: unknown
  strategy?: unknown
}): SettlementPosition | null {
  // Theta guarda la estrategia; Gamma guarda el tipo de opción.
  if (report.strategy === 'SELL_PUT') return 'SHORT_PUT'
  if (report.strategy === 'COVERED_CALL') return 'COVERED_CALL'
  if (report.optionType === 'CALL') return 'LONG_CALL'
  if (report.optionType === 'PUT') return 'LONG_PUT'
  return null
}

/**
 * Liquida un contrato vencido. Devuelve `null` si los datos no permiten
 * calcular el resultado (strike, prima o subyacente no finitos).
 */
export function settleOption(input: SettlementInput): SettlementResult | null {
  const { position, strike, premium, underlyingAtExpiry } = input
  const contracts = input.contracts ?? 1

  if (![strike, premium, underlyingAtExpiry, contracts].every(Number.isFinite)) return null
  if (strike <= 0 || underlyingAtExpiry < 0 || contracts <= 0) return null

  const isCall = position === 'LONG_CALL' || position === 'COVERED_CALL'
  const intrinsicValue = isCall
    ? Math.max(0, underlyingAtExpiry - strike)
    : Math.max(0, strike - underlyingAtExpiry)

  const isShort = SHORT_POSITIONS.has(position)
  // El comprador paga prima y recibe el valor; el vendedor cobra prima y lo paga.
  const pnlPerShare = isShort ? premium - intrinsicValue : intrinsicValue - premium

  return {
    intrinsicValue,
    pnlPerShare,
    pnlTotal: pnlPerShare * CONTRACT_MULTIPLIER * contracts,
    pnlPct: premium > 0 ? (pnlPerShare / premium) * 100 : null,
    expiredInTheMoney: intrinsicValue > 0,
    isShort,
  }
}
