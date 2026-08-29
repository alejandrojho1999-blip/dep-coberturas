'use client'

import {
  Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { PuntoCurva } from '@/lib/backtest/types'
import {
  CHART_COLORS, fmtFechaEje, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
} from '@/components/charts/chart-theme'

interface Props {
  cartera: PuntoCurva[]
  benchmark: PuntoCurva[]
  /** Índice amplio como coste de oportunidad; ausente en gran capitalización. */
  mercadoAmplio: PuntoCurva[] | null
  nombreCartera: string
  tickerBenchmark: string
  tickerMercadoAmplio?: string
  color: string
}

/**
 * Curva de la cartera simulada frente a sus índices.
 *
 * Las series vienen en base 1, no en dólares: el backtest mide la selección,
 * no un tamaño de cuenta concreto. Se pintan como crecimiento acumulado en
 * porcentaje para que las tres sean comparables de un vistazo.
 */
export function CurvaBacktest({
  cartera, benchmark, mercadoAmplio, nombreCartera,
  tickerBenchmark, tickerMercadoAmplio, color,
}: Props) {
  const datos = cartera.map((p, i) => ({
    fecha: p.fecha,
    cartera: (p.valor - 1) * 100,
    benchmark: benchmark[i] ? (benchmark[i].valor - 1) * 100 : null,
    mercado: mercadoAmplio?.[i] ? (mercadoAmplio[i].valor - 1) * 100 : null,
  }))

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="curvaBacktest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={fmtFechaEje}
            tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
            stroke={CHART_COLORS.borde}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(0)} %`}
            tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
            stroke={CHART_COLORS.borde}
            width={52}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            labelFormatter={f => fmtFechaEje(String(f))}
            formatter={value => (typeof value === 'number' ? `${value.toFixed(1)} %` : '—')}
          />
          <Area
            type="monotone"
            dataKey="cartera"
            name={nombreCartera}
            stroke={color}
            strokeWidth={2}
            fill="url(#curvaBacktest)"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            name={tickerBenchmark}
            stroke={CHART_COLORS.muted}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {mercadoAmplio && (
            <Line
              type="monotone"
              dataKey="mercado"
              name={tickerMercadoAmplio ?? 'Mercado amplio'}
              stroke={CHART_COLORS.borde}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
