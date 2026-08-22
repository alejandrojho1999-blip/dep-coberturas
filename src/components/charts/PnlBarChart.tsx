'use client'

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS, fmtUsd, fmtUsdCorto, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './chart-theme'

export interface PnlBar {
  nombre: string
  pnl: number
  detalle?: string
}

interface Props {
  barras: PnlBar[]
  altura?: number
}

/**
 * Resultado por posición, de la que más aporta a la que más resta.
 *
 * Sirve para responder de un vistazo la pregunta que siempre llega en una
 * presentación: qué operaciones están sosteniendo el resultado y cuáles lo
 * están lastrando.
 */
export function PnlBarChart({ barras, altura }: Props) {
  const data = [...barras].filter(b => Number.isFinite(b.pnl)).sort((a, b) => b.pnl - a.pnl)

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted">
        Sin resultados que representar
      </div>
    )
  }

  const alto = altura ?? Math.max(140, data.length * 26 + 24)

  return (
    <div style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
          <XAxis type="number" hide tickFormatter={fmtUsdCorto} />
          <YAxis
            type="category"
            dataKey="nombre"
            stroke={CHART_COLORS.muted}
            tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
            tickLine={false}
            axisLine={false}
            width={62}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={(value, _name, item) => {
              const d = item?.payload as PnlBar | undefined
              const v = Number(value)
              return [d?.detalle ? `${fmtUsd(v)} · ${d.detalle}` : fmtUsd(v), 'Resultado']
            }}
          />
          <Bar dataKey="pnl" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map(d => (
              <Cell key={d.nombre} fill={d.pnl >= 0 ? CHART_COLORS.positivo : CHART_COLORS.negativo} />
            ))}
            <LabelList
              dataKey="pnl"
              position="right"
              formatter={label => fmtUsd(Number(label), 0)}
              style={{ fontSize: 10, fill: CHART_COLORS.muted }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
