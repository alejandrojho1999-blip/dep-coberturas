'use client'

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { EquitySeriesPoint } from '@/lib/portafolios/types'
import { CHART_COLORS, fmtFechaEje, fmtUsd, fmtUsdCorto, TOOLTIP_STYLE } from './chart-theme'

interface Props {
  serie: EquitySeriesPoint[]
  /** Nombre del benchmark, para la leyenda. */
  benchmark: string
  color?: string
  altura?: number
  /** Nota al pie del gráfico, p. ej. para explicar una curva escalonada. */
  nota?: string
  /** Dibuja la curva en escalones en vez de interpolar entre puntos. */
  escalonada?: boolean
}

/**
 * Curva de equity del portafolio contra su benchmark.
 *
 * Las dos series arrancan del mismo capital, así que la distancia vertical
 * entre líneas es directamente el dinero de más (o de menos) que habría dado
 * la estrategia frente a comprar el índice.
 */
export function EquityChart({ serie, benchmark, color = CHART_COLORS.azul, altura = 300, nota, escalonada }: Props) {
  if (serie.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted"
        style={{ height: altura }}
      >
        Aún no hay historia suficiente para dibujar la curva
      </div>
    )
  }

  const valores = serie.flatMap(p => [p.portafolio, p.benchmark ?? p.portafolio])
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const margen = (max - min) * 0.08 || max * 0.02

  return (
    <div className="flex flex-col gap-2">
      <div style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtFechaEje}
              stroke={CHART_COLORS.muted}
              tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.borde }}
              minTickGap={40}
            />
            <YAxis
              domain={[min - margen, max + margen]}
              tickFormatter={fmtUsdCorto}
              stroke={CHART_COLORS.muted}
              tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={label => String(label)}
              formatter={(value, name) => [fmtUsd(Number(value)), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: CHART_COLORS.muted }}
              iconType="plainline"
            />
            <Line
              type={escalonada ? 'stepAfter' : 'monotone'}
              dataKey="portafolio"
              name="Portafolio"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmark}
              stroke={CHART_COLORS.muted}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {nota && <p className="text-[10px] leading-relaxed text-text-muted">{nota}</p>}
    </div>
  )
}
