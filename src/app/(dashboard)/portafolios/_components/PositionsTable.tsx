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
  const color = AGENT_COLORS[agente] ?? '#94a3b8'
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
      <p className="rounded-lg border border-dashed border-[#1e2035] px-4 py-8 text-center text-xs text-[#475569]">
        No hay posiciones abiertas en este portafolio.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#1e2035]">
      <table className="w-full min-w-[860px] text-xs">
        <thead>
          <tr className="border-b border-[#1e2035] bg-[#12121a] text-left font-mono text-[9px] uppercase tracking-[0.12em] text-[#475569]">
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
              <tr key={p.id} className="border-b border-[#161622] last:border-0 hover:bg-[#12121a]">
                <td className="px-3 py-2 font-mono font-semibold text-[#F0EFE8]">{p.ticker}</td>
                <td className="px-3 py-2"><AgentBadge agente={p.agente} /></td>
                <td className="px-3 py-2 text-[#94a3b8]">
                  {opcion
                    ? <span title={p.detalleCapital}>{p.posicion.replace('_', ' ')} ${p.strike} · {p.expiration}</span>
                    : <span className="text-[#64748b]">{(p as StockPosition).cantidad.toFixed(2)} acc.</span>}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums text-[#94a3b8]">${entrada.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-[#94a3b8]">
                  {actual != null ? `$${actual.toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-[#64748b]">
                  {fmtUsd(p.capitalComprometido, 0)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-[#e2e8f0]">
                  {valor != null ? fmtUsd(valor, 0) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-[#64748b]">
                  {peso != null ? `${peso.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-[#64748b]">
                  {diasEntre(p.fechaEntrada, hoy())}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono font-semibold tabular-nums"
                  style={{ color: p.pnl == null ? '#64748b' : p.pnl >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {p.pnl != null ? fmtUsd(p.pnl) : '—'}
                </td>
                <td
                  className="px-3 py-2 text-right font-mono tabular-nums"
                  style={{ color: p.pnlPct == null ? '#64748b' : p.pnlPct >= 0 ? '#22c55e' : '#ef4444' }}
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
