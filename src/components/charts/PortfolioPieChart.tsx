'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS, fmtUsd, sliceColor, TOOLTIP_STYLE } from './chart-theme'

export interface PieSlice {
  /** Etiqueta de la porción: normalmente el ticker. */
  nombre: string
  /** Capital que representa. */
  valor: number
  /** Línea extra para el tooltip: agente, contrato, resultado… */
  detalle?: string
}

interface Props {
  slices: PieSlice[]
  /** Capital sin desplegar. Se dibuja como una porción gris aparte. */
  caja?: number
  /** Texto grande en el centro del donut. */
  centro?: string
  centroSub?: string
  altura?: number
}

interface SliceDatum extends PieSlice {
  color: string
}

/**
 * Composición del portafolio en donut.
 *
 * Solo entran las posiciones abiertas: en cuanto un agente vende, su porción
 * desaparece sola porque las posiciones se derivan de la tabla en cada
 * refresco. El capital sin desplegar se muestra en gris para que el pastel
 * represente siempre el total asignado, no solo lo invertido.
 */
export function PortfolioPieChart({ slices, caja = 0, centro, centroSub, altura = 280 }: Props) {
  const data: SliceDatum[] = slices
    .filter(s => s.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((s, i) => ({ ...s, color: sliceColor(i) }))

  if (caja > 0) {
    data.push({ nombre: 'Sin desplegar', valor: caja, detalle: 'Capital disponible', color: CHART_COLORS.caja })
  }

  const total = data.reduce((s, d) => s + d.valor, 0)

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-[#1e2035] text-xs text-[#475569]"
        style={{ height: altura }}
      >
        Sin posiciones que representar
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative shrink-0" style={{ width: altura, height: altura, maxWidth: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={1}
              stroke={CHART_COLORS.fondo}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map(d => <Cell key={d.nombre} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, _name, item) => {
                const d = item?.payload as SliceDatum | undefined
                const v = Number(value)
                const pct = total > 0 ? (v / total) * 100 : 0
                return [`${fmtUsd(v)} · ${pct.toFixed(1)}%${d?.detalle ? ` · ${d.detalle}` : ''}`, d?.nombre ?? '']
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centro && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-bold tabular-nums text-[#F0EFE8]">{centro}</span>
            {centroSub && <span className="mt-0.5 text-[10px] tracking-wider text-[#64748b]">{centroSub}</span>}
          </div>
        )}
      </div>

      <ul className="grid max-h-[280px] flex-1 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto sm:grid-cols-2">
        {data.map(d => (
          <li key={d.nombre} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="truncate text-[#94a3b8]">{d.nombre}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-[#64748b]">
              {((d.valor / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
