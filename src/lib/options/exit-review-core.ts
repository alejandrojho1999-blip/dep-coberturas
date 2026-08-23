import { contractKey } from './occ-symbol'
import { evaluarSalida, nivelesSalida } from './exit-levels'
import { optionRefFromRec, type OptionSide } from './mark'
import type { OptionContractRef } from './occ-symbol'

/**
 * Decisión de la revisión de niveles de salida, sin I/O.
 *
 * Aquí se decide qué posiciones han tocado un nivel y con qué datos hay que
 * cerrarlas; quien llame se encarga de cotizar y de escribir. Separarlo así es
 * lo que permite probar la lógica sin red y reutilizarla desde un cron.
 */

/** Lo mínimo que necesita el revisor de una recomendación guardada. */
export interface ReviewablePick {
  id: string
  ticker: string
  precio_entrada: number
  ai_report?: Record<string, unknown> | null
}

/** Cierre pendiente de escribir, con el patch ya construido. */
export interface PlannedClosure {
  id: string
  ticker: string
  motivo: 'objetivo' | 'stop'
  primaViva: number
  pnlPct: number
  patch: {
    estado: 'Vender'
    precio_venta: number
    rentabilidad: number
    closed_at: string
    ai_report: Record<string, unknown>
  }
}

/** Posición que se queda viva, y por qué. */
export interface HeldPosition {
  ticker: string
  /** `sin-contrato` y `sin-cotizacion` no se han podido revisar. */
  razon: 'entre-niveles' | 'sin-contrato' | 'sin-cotizacion' | 'vencido' | 'prima-invalida'
  primaViva?: number
  objetivo?: number
  stop?: number
  pnlPct?: number
}

export interface ExitReviewPlan {
  closures: PlannedClosure[]
  held: HeldPosition[]
}

/**
 * Un contrato ya vencido no se revisa por nivel: su cierre es el valor
 * intrínseco contra el subyacente, y de eso se encarga la liquidación. La hora
 * es la misma que usa `settle-picks`.
 */
export function yaVencido(expiration: string, now: Date): boolean {
  const exp = new Date(`${expiration}T21:00:00.000Z`)
  return !Number.isNaN(exp.getTime()) && exp.getTime() <= now.getTime()
}

/**
 * Contratos que hay que cotizar para revisar estas posiciones: las vivas con
 * un contrato legible en el informe y que no hayan vencido todavía.
 */
export function contractsToQuote(picks: ReviewablePick[], now = new Date()): OptionContractRef[] {
  const out: OptionContractRef[] = []
  for (const pick of picks) {
    const ref = optionRefFromRec(pick)
    if (!ref || yaVencido(ref.expiration, now)) continue
    out.push(ref)
  }
  return out
}

/**
 * Decide qué posiciones se cierran a la vista de las primas cotizadas.
 *
 * Una posición sin cotización se deja viva: nunca se cierra a ciegas, porque
 * "Yahoo no publica este contrato" no es lo mismo que "el contrato no vale
 * nada".
 */
export function planExitReview(
  picks: ReviewablePick[],
  side: OptionSide,
  prices: Record<string, number>,
  now = new Date()
): ExitReviewPlan {
  const closures: PlannedClosure[] = []
  const held: HeldPosition[] = []
  const closedAt = now.toISOString()

  for (const pick of picks) {
    const ref = optionRefFromRec(pick)
    if (!ref) {
      held.push({ ticker: pick.ticker, razon: 'sin-contrato' })
      continue
    }
    if (yaVencido(ref.expiration, now)) {
      held.push({ ticker: pick.ticker, razon: 'vencido' })
      continue
    }

    const niveles = nivelesSalida(side, pick.precio_entrada)
    const primaViva = prices[contractKey(ref)]

    if (primaViva == null) {
      held.push({
        ticker: pick.ticker,
        razon: 'sin-cotizacion',
        objetivo: niveles?.objetivo,
        stop: niveles?.stop,
      })
      continue
    }

    const evaluacion = evaluarSalida(side, pick.precio_entrada, primaViva)
    if (!evaluacion) {
      held.push({ ticker: pick.ticker, razon: 'prima-invalida', primaViva })
      continue
    }

    if (evaluacion.accion === 'mantener') {
      held.push({
        ticker: pick.ticker,
        razon: 'entre-niveles',
        primaViva,
        objetivo: evaluacion.niveles.objetivo,
        stop: evaluacion.niveles.stop,
        pnlPct: evaluacion.pnlPct,
      })
      continue
    }

    closures.push({
      id: pick.id,
      ticker: pick.ticker,
      motivo: evaluacion.accion,
      primaViva,
      pnlPct: evaluacion.pnlPct,
      patch: {
        estado: 'Vender',
        precio_venta: parseFloat(primaViva.toFixed(4)),
        rentabilidad: parseFloat(evaluacion.pnlPct.toFixed(2)),
        closed_at: closedAt,
        ai_report: { ...(pick.ai_report ?? {}), salida: evaluacion.accion },
      },
    })
  }

  return { closures, held }
}

/** Línea de log legible de un cierre por nivel. */
export function describeClosure(c: PlannedClosure, entrada: number): string {
  const motivo = c.motivo === 'objetivo' ? 'OBJETIVO' : 'STOP'
  const pnl = (c.pnlPct >= 0 ? '+' : '') + c.pnlPct.toFixed(1) + '%'
  return `⬇ ${c.ticker}: ${motivo} tocado — entrada $${entrada.toFixed(2)} → prima $${c.primaViva.toFixed(2)} | ${pnl}`
}

/** Línea de log legible de una posición que sigue viva. */
export function describeHeld(h: HeldPosition): string {
  switch (h.razon) {
    case 'entre-niveles': {
      const pnl = h.pnlPct != null ? (h.pnlPct >= 0 ? '+' : '') + h.pnlPct.toFixed(1) + '%' : '—'
      return `✓ ${h.ticker}: prima $${h.primaViva?.toFixed(2)} entre niveles `
        + `($${h.objetivo?.toFixed(2)} obj / $${h.stop?.toFixed(2)} stop) — vigente ${pnl}`
    }
    case 'sin-cotizacion':
      return `· ${h.ticker}: sin cotización del contrato — se deja viva`
    case 'sin-contrato':
      return `⚠ ${h.ticker}: sin contrato utilizable en el informe — no se revisa`
    case 'prima-invalida':
      return `⚠ ${h.ticker}: prima de entrada inutilizable — no se revisa`
    case 'vencido':
      return `· ${h.ticker}: contrato vencido — lo liquida el paso de vencimientos`
  }
}
