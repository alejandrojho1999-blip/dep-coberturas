'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PuntoCurva } from '@/lib/estrategias/types'
import { CHART_COLORS, fmtFechaEje, fmtUsd, fmtUsdCorto, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './chart-theme'

interface Props {
  serie: PuntoCurva[]
  /** Peor caída del histórico, para anotarla en el gráfico. */
  maximo?: number
  fechaMaximo?: string | null
  altura?: number
}

function submuestrear(serie: PuntoCurva[], maximo: number): PuntoCurva[] {
  if (serie.length <= maximo) return serie
  const paso = serie.length / maximo
  const salida: PuntoCurva[] = []
  // En una serie underwater interesa conservar los mínimos, no un punto
  // cualquiera del tramo: el peor momento de cada ventana es el dato relevante.
  for (let i = 0; i < maximo; i++) {
    const desde = Math.floor(i * paso)
    const hasta = Math.min(serie.length, Math.floor((i + 1) * paso))
    let peor = serie[desde]
    for (let j = desde; j < hasta; j++) {
      if (serie[j].valor < peor.valor) peor = serie[j]
    }
    salida.push(peor)
  }
  return salida
}

/**
 * Serie underwater: distancia al máximo previo en cada momento.
 *
 * Responde a la pregunta que un comité hace siempre antes que ninguna otra:
 * cuánto se llegó a perder desde el pico, y cuánto tiempo se tardó en volver.
 */
export function DrawdownChart({ serie, maximo, fechaMaximo, altura = 200 }: Props) {
  if (serie.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted"
        style={{ height: altura }}
      >
        Sin histórico suficiente
      </div>
    )
  }

  const data = submuestrear(serie, 400)

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: altura }}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gradDrawdown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.negativo} stopOpacity={0.05} />
              <stop offset="100%" stopColor={CHART_COLORS.negativo} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="fecha"
            tickFormatter={f => String(f).slice(0, 4)}
            tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
            stroke={CHART_COLORS.borde}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={fmtUsdCorto}
            tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
            stroke={CHART_COLORS.borde}
            width={62}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={TOOLTIP_ITEM_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            labelFormatter={f => fmtFechaEje(String(f))}
            formatter={value => [fmtUsd(Number(value), 0), 'Bajo el máximo previo']}
          />

          {maximo != null && (
            <ReferenceLine
              y={maximo}
              stroke={CHART_COLORS.negativo}
              strokeDasharray="4 4"
              label={{
                value: `peor: ${fmtUsd(maximo, 0)}${fechaMaximo ? ` · ${fmtFechaEje(fechaMaximo)}` : ''}`,
                position: 'insideBottomRight',
                fill: CHART_COLORS.negativo,
                fontSize: 10,
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="valor"
            stroke={CHART_COLORS.negativo}
            strokeWidth={1.5}
            fill="url(#gradDrawdown)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
