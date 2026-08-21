'use client'

import { AGENT_COLORS, fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import type { OptionPosition, PortfolioPosition, StockPosition } from '@/lib/portafolios/types'
import { diasEntre } from '@/lib/portafolios/metrics'

function esOpcion(p: PortfolioPosition): p is OptionPosition {
  return 'strike' in p
}

const hoy = () => new Date().toISOString().slice(0, 10)

interface Props {
  positions: PortfolioPosition[]
  /** Total con el que se calcula el peso de cada posición. */
  total: number
}

/** Distintivo con el color del agente que originó la posición. */
function AgentBadge({ agente }: { agente: string }) {
  const color = AGENT_COLORS[agente] ?? 'var(--color-text-secondary)'
  return (
    <span
      className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
    >
      {agente}
    </span>
  )
}

/**
 * Posiciones vivas del portafolio. Es la foto de lo que está en riesgo ahora
 * mismo; lo ya cerrado vive en el track record.
 */
export function PositionsTable({ positions, total }: Props) {
  const abiertas = [...positions]
    .filter(p => p.abierta)
    .sort((a, b) => (b.valorActual ?? b.capitalComprometido) - (a.valorActual ?? a.capitalComprometido))

  if (abiertas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-text-muted">
        No hay posiciones abiertas en este portafolio.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[860px] text-xs">
        <thead>
          <tr className="border-b border-border bg-surface text-left font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2">Agente</th>
            <th className="px-3 py-2">Posición</th>
            <th className="px-3 py-2">Entrada</th>
            <th className="px-3 py-2">Actual</th>
            <th className="px-3 py-2 text-right">Invertido</th>
            <th className="px-3 py-2 text-right">Valor</th>
            <th className="px-3 py-2 text-right">Peso</th>
            <th className="px-3 py-2 text-right">Días</th>
            <th className="px-3 py-2 text-right">Result. ($)</th>
            <th className="px-3 py-2 text-right">Result. (%)</th>
          </tr>
        </thead>
        <tbody>
          {abiertas.map(p => {
            const opcion = esOpcion(p)
            const entrada = opcion ? p.primaEntrada : (p as StockPosition).precioEntrada
            const actual = opcion ? p.primaActual : (p as StockPosition).precioActual
            const valor = p.valorActual
            const peso = total > 0 && valor != null ? (valor / total) * 100 : null
            return (
              <tr key={p.id} className="border-b border-border-subtle last:border-0 hover:bg-surface">
                <td className="px-3 py-2 font-mono font-semibold text-text-primary">{p.ticker}</td>
                <td className="px-3 py-2"><AgentBadge agente={p.agente} /></td>
                <td className="px-3 py-2 text-text-secondary">
                  {opcion
                    ? <span title={p.detalleCapital}>{p.posicion.replace('_', ' ')} ${p.strike} · {p.expiration}</span>
                    : <span className="text-text-secondary">{(p as StockPosition).cantidad.toFixed(2)} acc.</span>}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-text-secondary">${entrada.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-text-secondary">
                  {actual != null ? `$${actual.toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                  {fmtUsd(p.capitalComprometido, 0)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                  {valor != null ? fmtUsd(valor, 0) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                  {peso != null ? `${peso.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                  {diasEntre(p.fechaEntrada, hoy())}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono font-semibold tabular-nums"
                  style={{ color: p.pnl == null ? 'var(--color-text-secondary)' : p.pnl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                >
                  {p.pnl != null ? fmtUsd(p.pnl) : '—'}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono tabular-nums"
                  style={{ color: p.pnlPct == null ? 'var(--color-text-secondary)' : p.pnlPct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                >
                  {fmtPct(p.pnlPct)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
