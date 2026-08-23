import { contractKey, type OptionContractRef } from './occ-symbol'
import { evaluarSalida, nivelesSalida } from './exit-levels'
import { optionRefFromRec, type OptionSide } from './mark'
import type { AgentPickForSettlement } from './settle-picks'

/**
 * Revisión de los niveles de salida de las posiciones vivas de Gamma y Theta.
 *
 * Se ejecuta al principio del agente, antes de liquidar los vencidos. Pide la
 * prima actual de cada contrato y, si un nivel ya se tocó, cierra la posición
 * en la base de datos asumiendo que la orden OCO estaba puesta en el bróker y
 * saltó sola.
 *
 * No es un stop-loss: entre dos ejecuciones del agente no se vigila nada. Lo
 * que hace este módulo es reflejar lo que ya ocurrió en la cuenta.
 */

export interface ExitReviewSummary {
  /** Posiciones vivas revisadas contra una prima real. */
  revisadas: number
  /** Posiciones cerradas por haber tocado el objetivo. */
  porObjetivo: number
  /** Posiciones cerradas por haber tocado el stop. */
  porStop: number
  /** Posiciones que Yahoo no cotizaba y se dejan vivas. */
  sinCotizar: number
}

const VACIO: ExitReviewSummary = { revisadas: 0, porObjetivo: 0, porStop: 0, sinCotizar: 0 }

/**
 * Un contrato ya vencido no se revisa por nivel: su cierre es el valor
 * intrínseco contra el subyacente, y de eso se encarga `settleExpiredPicks`
 * justo después. La hora es la misma que usa aquel módulo.
 */
function yaVencido(expiration: string, now = new Date()): boolean {
  const exp = new Date(`${expiration}T21:00:00.000Z`)
  return !Number.isNaN(exp.getTime()) && exp.getTime() <= now.getTime()
}

/**
 * Revisa las posiciones abiertas y cierra las que hayan tocado un nivel.
 *
 * `picks` debe traer ya solo las posiciones vivas (`estado !== 'Vender'`).
 */
export async function reviewExitLevels(
  picks: AgentPickForSettlement[],
  side: OptionSide,
  signal: AbortSignal,
  addLog: (msg: string) => void
): Promise<ExitReviewSummary> {
  const refs: Array<{ pick: AgentPickForSettlement; ref: OptionContractRef }> = []
  for (const pick of picks) {
    const ref = optionRefFromRec(pick)
    if (!ref) {
      addLog(`⚠ ${pick.ticker}: sin contrato utilizable en el informe — no se revisa`)
      continue
    }
    if (yaVencido(ref.expiration)) continue
    refs.push({ pick, ref })
  }
  if (!refs.length) return { ...VACIO }

  let prices: Record<string, number> = {}
  try {
    const res = await fetch('/api/informes/option-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contracts: refs.map(r => r.ref) }),
      signal,
    })
    if (res.ok) prices = await res.json() as Record<string, number>
    else addLog(`⚠ No se pudieron obtener las primas actuales (HTTP ${res.status}) — no se cierra nada`)
  } catch (e) {
    if (signal.aborted) return { ...VACIO }
    addLog(`⚠ Error obteniendo las primas actuales — ${(e as Error).message}`)
  }

  const summary: ExitReviewSummary = { ...VACIO }

  for (const { pick, ref } of refs) {
    if (signal.aborted) break

    const primaViva = prices[contractKey(ref)]
    const niveles = nivelesSalida(side, pick.precio_entrada)

    if (primaViva == null) {
      summary.sinCotizar++
      const nivelesStr = niveles
        ? ` · salida $${niveles.objetivo.toFixed(2)} / $${niveles.stop.toFixed(2)}`
        : ''
      addLog(`· ${pick.ticker}: sin cotización del contrato — se deja viva${nivelesStr}`)
      continue
    }

    const evaluacion = evaluarSalida(side, pick.precio_entrada, primaViva)
    if (!evaluacion) {
      addLog(`⚠ ${pick.ticker}: prima de entrada inutilizable — no se revisa`)
      continue
    }
    summary.revisadas++

    const pnlStr = (evaluacion.pnlPct >= 0 ? '+' : '') + evaluacion.pnlPct.toFixed(1) + '%'

    if (evaluacion.accion === 'mantener') {
      addLog(
        `✓ ${pick.ticker}: prima $${primaViva.toFixed(2)} entre niveles ` +
        `($${evaluacion.niveles.objetivo.toFixed(2)} obj / $${evaluacion.niveles.stop.toFixed(2)} stop) — vigente ${pnlStr}`
      )
      continue
    }

    const motivo = evaluacion.accion === 'objetivo' ? 'OBJETIVO' : 'STOP'
    addLog(
      `⬇ ${pick.ticker}: ${motivo} tocado — entrada $${pick.precio_entrada.toFixed(2)} → ` +
      `prima $${primaViva.toFixed(2)} | ${pnlStr}`
    )

    try {
      const res = await fetch('/api/agentes/picks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pick.id,
          estado: 'Vender',
          precio_venta: parseFloat(primaViva.toFixed(4)),
          rentabilidad: parseFloat(evaluacion.pnlPct.toFixed(2)),
          closed_at: new Date().toISOString(),
          ai_report: { ...(pick.ai_report ?? {}), salida: evaluacion.accion },
        }),
        signal,
      })
      if (!res.ok) {
        addLog(`⚠ ${pick.ticker}: el cierre no se guardó (HTTP ${res.status})`)
        continue
      }
      if (evaluacion.accion === 'objetivo') summary.porObjetivo++
      else summary.porStop++
    } catch {
      if (signal.aborted) break
      addLog(`⚠ ${pick.ticker}: error guardando el cierre por nivel`)
    }
  }

  return summary
}
