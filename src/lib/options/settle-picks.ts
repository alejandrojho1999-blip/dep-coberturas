import { settleOption, positionFromReport, type SettlementPosition } from './settlement'

/**
 * Liquidación de las recomendaciones de opciones que ya vencieron.
 *
 * Antes, los agentes daban por hecho el resultado: Gamma marcaba siempre
 * −100% (pérdida total) y Theta siempre +100% (prima íntegra), sin mirar
 * dónde había quedado el subyacente. Aquí se calcula el resultado real
 * pidiendo el cierre histórico del subyacente en la fecha de vencimiento.
 */

export interface AgentPickForSettlement {
  id: string
  ticker: string
  estado: string
  precio_entrada: number
  rentabilidad?: number | null
  ai_report?: Record<string, unknown> | null
}

export interface SettlementOutcome {
  id: string
  ticker: string
  expiration: string
  position: SettlementPosition
  strike: number
  premium: number
  underlyingAtExpiry: number
  /** Valor intrínseco por acción con el que se cierra la posición. */
  precioVenta: number
  /** Resultado sobre la prima, en porcentaje. */
  rentabilidad: number
  /** Resultado en dólares para 1 contrato (100 acciones). */
  pnlTotal: number
  expiredInTheMoney: boolean
  isShort: boolean
  /** true si la posición ya estaba cerrada con el resultado cableado. */
  wasMisreported: boolean
  /** Informe original, para poder ampliarlo sin perder lo que ya contenía. */
  aiReport: Record<string, unknown>
}

export interface SettlementSkip {
  ticker: string
  reason: string
}

/** Firma del cálculo cableado que hay que rehacer: ±100% exacto. */
function hasHardcodedOutcome(pick: AgentPickForSettlement): boolean {
  return pick.rentabilidad === -100 || pick.rentabilidad === 100
}

/**
 * Una liquidación fiable deja anotado el precio del subyacente con el que se
 * calculó. Su ausencia marca las filas cerradas por versiones anteriores, que
 * pudieron usar el cierre del día anterior al vencimiento.
 */
function lacksSettlementPrice(pick: AgentPickForSettlement): boolean {
  return (pick.ai_report ?? {}).underlyingAtExpiry == null
}

function daysToExpiry(expiration: string, now: Date): number {
  const exp = new Date(`${expiration}T21:00:00.000Z`)
  return Math.ceil((exp.getTime() - now.getTime()) / 86_400_000)
}

/**
 * Selecciona las posiciones que necesitan liquidarse: las abiertas cuyo
 * contrato ya venció, y las ya cerradas con el resultado cableado.
 */
export function pickPositionsToSettle(
  picks: AgentPickForSettlement[],
  now = new Date()
): { pending: AgentPickForSettlement[]; skipped: SettlementSkip[] } {
  const pending: AgentPickForSettlement[] = []
  const skipped: SettlementSkip[] = []

  for (const pick of picks) {
    const report = pick.ai_report ?? {}
    const expiration = typeof report.expiration === 'string' ? report.expiration : null
    if (!expiration) {
      skipped.push({ ticker: pick.ticker, reason: 'sin fecha de vencimiento en el informe' })
      continue
    }
    if (daysToExpiry(expiration, now) > 0) continue

    const closed = pick.estado === 'Vender'
    if (!closed || hasHardcodedOutcome(pick) || lacksSettlementPrice(pick)) pending.push(pick)
  }

  return { pending, skipped }
}

/** Contratos cuyo precio de liquidación hay que consultar. */
export function settlementQueries(
  picks: AgentPickForSettlement[]
): Array<{ ticker: string; expiration: string }> {
  const seen = new Set<string>()
  const out: Array<{ ticker: string; expiration: string }> = []
  for (const pick of picks) {
    const expiration = (pick.ai_report ?? {}).expiration
    if (typeof expiration !== 'string') continue
    const key = `${pick.ticker.toUpperCase()}|${expiration}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ticker: pick.ticker, expiration })
  }
  return out
}

/** Clave con la que `/api/informes/settlement-prices` indexa su respuesta. */
export function settlementKey(ticker: string, expiration: string): string {
  return `${ticker.toUpperCase()}|${expiration}`
}

/**
 * Calcula el resultado real de cada posición vencida a partir de los cierres
 * históricos del subyacente. Las que no tengan precio disponible se devuelven
 * en `skipped` en vez de liquidarse con un valor inventado.
 */
export function computeSettlements(
  picks: AgentPickForSettlement[],
  underlyingPrices: Record<string, number>
): { outcomes: SettlementOutcome[]; skipped: SettlementSkip[] } {
  const outcomes: SettlementOutcome[] = []
  const skipped: SettlementSkip[] = []

  for (const pick of picks) {
    const report = pick.ai_report ?? {}
    const expiration = typeof report.expiration === 'string' ? report.expiration : null
    const strike = Number(report.strike)
    const position = positionFromReport(report)
    const premium = Number(pick.precio_entrada)

    if (!expiration || !position || !Number.isFinite(strike)) {
      skipped.push({ ticker: pick.ticker, reason: 'informe incompleto (strike/tipo/vencimiento)' })
      continue
    }

    const underlyingAtExpiry = underlyingPrices[settlementKey(pick.ticker, expiration)]
    if (underlyingAtExpiry == null) {
      skipped.push({ ticker: pick.ticker, reason: `sin cierre histórico para ${expiration}` })
      continue
    }

    const result = settleOption({ position, strike, premium, underlyingAtExpiry })
    if (!result) {
      skipped.push({ ticker: pick.ticker, reason: 'datos no liquidables' })
      continue
    }

    outcomes.push({
      id: pick.id,
      ticker: pick.ticker,
      expiration,
      position,
      strike,
      premium,
      underlyingAtExpiry,
      precioVenta: parseFloat(result.intrinsicValue.toFixed(4)),
      rentabilidad: parseFloat((result.pnlPct ?? 0).toFixed(2)),
      pnlTotal: result.pnlTotal,
      expiredInTheMoney: result.expiredInTheMoney,
      isShort: result.isShort,
      wasMisreported: pick.estado === 'Vender'
        && (hasHardcodedOutcome(pick) || lacksSettlementPrice(pick)),
      aiReport: report,
    })
  }

  return { outcomes, skipped }
}

/**
 * Liquida las posiciones vencidas de un agente y persiste el resultado.
 *
 * Devuelve cuántas se cerraron y cuántas eran recálculos de un resultado
 * previamente cableado, para que el agente lo resuma en su log.
 */
export async function settleExpiredPicks(
  picks: AgentPickForSettlement[],
  signal: AbortSignal,
  addLog: (msg: string) => void
): Promise<{ settled: number; recalculated: number }> {
  const { pending, skipped: noExpiry } = pickPositionsToSettle(picks)
  for (const s of noExpiry) addLog(`⚠ ${s.ticker}: ${s.reason}`)
  if (!pending.length) return { settled: 0, recalculated: 0 }

  addLog(`⚖ Liquidando ${pending.length} contrato(s) vencido(s) con el cierre real del subyacente...`)

  let prices: Record<string, number> = {}
  try {
    const res = await fetch('/api/informes/settlement-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contracts: settlementQueries(pending) }),
      signal,
    })
    if (res.ok) prices = await res.json() as Record<string, number>
    else addLog(`⚠ No se pudieron obtener los cierres de liquidación (HTTP ${res.status})`)
  } catch (e) {
    if (signal.aborted) return { settled: 0, recalculated: 0 }
    addLog(`⚠ Error obteniendo cierres de liquidación — ${(e as Error).message}`)
  }

  const { outcomes, skipped } = computeSettlements(pending, prices)
  for (const s of skipped) addLog(`⚠ ${s.ticker}: ${s.reason} — se deja sin liquidar`)

  let settled = 0
  let recalculated = 0
  for (const o of outcomes) {
    if (signal.aborted) break
    addLog(describeSettlement(o))
    try {
      await fetch('/api/agentes/picks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: o.id,
          estado: 'Vender',
          precio_venta: o.precioVenta,
          rentabilidad: o.rentabilidad,
          // El contrato dejó de existir el día del vencimiento, no hoy: esa es
          // la fecha con la que el portafolio debe registrar el cierre.
          closed_at: `${o.expiration}T21:00:00.000Z`,
          // Se conserva el informe original y se le añade el precio del
          // subyacente en el vencimiento, para que la tabla pueda mostrar el
          // dato con el que se liquidó en vez del precio de mercado de hoy.
          ai_report: { ...o.aiReport, underlyingAtExpiry: o.underlyingAtExpiry },
        }),
        signal,
      })
      settled++
      if (o.wasMisreported) recalculated++
    } catch {
      if (signal.aborted) break
      addLog(`⚠ ${o.ticker}: error guardando la liquidación`)
    }
  }

  if (recalculated > 0) {
    addLog(`↻ ${recalculated} posición(es) traían un resultado incorrecto y se han recalculado`)
  }
  return { settled, recalculated }
}

/** Línea de log legible con el desenlace de una posición liquidada. */
export function describeSettlement(o: SettlementOutcome): string {
  const signo = o.pnlTotal >= 0 ? '+' : '−'
  const money = `${signo}$${Math.abs(o.pnlTotal).toFixed(2)}`
  const pct = `${o.rentabilidad >= 0 ? '+' : ''}${o.rentabilidad.toFixed(1)}%`
  const estado = o.expiredInTheMoney
    ? (o.isShort ? 'asignada' : 'ITM')
    : 'sin valor'
  const prefijo = o.wasMisreported ? '↻ RECALCULADO' : '✓ LIQUIDADA'
  return `${prefijo} ${o.ticker} ${o.expiration}: venció ${estado} · subyacente $${o.underlyingAtExpiry.toFixed(2)} vs strike $${o.strike} · prima $${o.premium.toFixed(2)} → ${money} por contrato (${pct})`
}
