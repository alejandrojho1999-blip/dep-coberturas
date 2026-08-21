'use client'

import { AlertTriangle } from 'lucide-react'
import { AGENT_COLORS, fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import type { ClosedTrade } from '@/lib/portafolios/types'

interface Props {
  trades: ClosedTrade[]
  /** Etiqueta de las columnas de precio: "Precio" en acciones, "Prima" en opciones. */
  etiquetaPrecio?: string
}

/**
 * Libro de operaciones cerradas: el track record.
 *
 * Cada fila es una operación terminada con su resultado definitivo. Es la
 * tabla que sostiene la conversación sobre asignar capital real, así que no
 * esconde nada: las fechas de cierre deducidas van marcadas como tales.
 */
export function TrackRecordTable({ trades, etiquetaPrecio = 'Precio' }: Props) {
  if (trades.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-text-muted">
        Todavía no hay operaciones cerradas en este portafolio.
      </p>
    )
  }

  const total = trades.reduce((s, t) => s + t.pnl, 0)
  const ganadoras = trades.filter(t => t.pnl > 0).length
  const estimadas = trades.filter(t => t.fechaCierreEstimada).length

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr className="border-b border-border bg-surface text-left font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Agente</th>
              <th className="px-3 py-2">Detalle</th>
              <th className="px-3 py-2">Entrada</th>
              <th className="px-3 py-2">Cierre</th>
              <th className="px-3 py-2 text-right">{etiquetaPrecio} ent.</th>
              <th className="px-3 py-2 text-right">{etiquetaPrecio} sal.</th>
              <th className="px-3 py-2 text-right">Días</th>
              <th className="px-3 py-2 text-right">Result. ($)</th>
              <th className="px-3 py-2 text-right">Result. (%)</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => {
              const color = AGENT_COLORS[t.agente] ?? 'var(--color-text-secondary)'
              return (
                <tr key={t.id} className="border-b border-border-subtle last:border-0 hover:bg-surface">
                  <td className="px-3 py-2 font-mono font-semibold text-text-primary">{t.ticker}</td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                      style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
                    >
                      {t.agente}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{t.contrato ?? '—'}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-text-secondary">{t.fechaEntrada}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      {t.fechaCierre}
                      {t.fechaCierreEstimada && (
                        <AlertTriangle
                          size={11}
                          className="text-text-primary"
                          aria-label="Fecha de cierre estimada"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">${t.entrada.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">${t.salida.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">{t.dias}</td>
                  <td
                    className="px-3 py-2 text-right font-mono font-semibold tabular-nums"
                    style={{ color: t.pnl >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                  >
                    {fmtUsd(t.pnl)}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-mono tabular-nums"
                    style={{ color: t.pnlPct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                  >
                    {fmtPct(t.pnlPct)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface font-mono text-[11px]">
              <td className="px-3 py-2 uppercase tracking-wider text-text-muted" colSpan={7}>
                {trades.length} operación(es) · {ganadoras} ganadora(s)
              </td>
              <td className="px-3 py-2 text-right text-text-muted">Total</td>
              <td
                className="px-3 py-2 text-right font-semibold tabular-nums"
                style={{ color: total >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                colSpan={2}
              >
                {fmtUsd(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {estimadas > 0 && (
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-text-secondary">
          <AlertTriangle size={11} className="mt-0.5 shrink-0 text-text-primary" />
          <span>
            {estimadas} operación(es) se cerraron antes de que se registrara la fecha de cierre.
            La suya está deducida del vencimiento del contrato o del día en que el precio de mercado
            coincidió con el de venta. El resultado en dólares no se ve afectado.
          </span>
        </p>
      )}
    </div>
  )
}
