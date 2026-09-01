'use client'

import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  CHART_COLORS, fmtFechaEje, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE,
} from './chart-theme'

export interface PuntoRiesgo {
  dia: string
  mercado: number | null
  geopolitico: number | null
}

interface Props {
  serie: PuntoRiesgo[]
  /** Frecuencia histórica del suceso; se dibuja como línea de referencia. */
  tasaBase?: number | null
  altura?: number
  nota?: string
}

const fmtPctEje = (v: number) => `${Math.round(v * 100)}%`

/**
 * Las dos curvas de probabilidad, en el mismo eje.
 *
 * Comparten panel porque comparten features y ventana: verlas juntas enseña
 * cuándo la atención pública se mueve sin que el mercado lo recoja todavía, que
 * es justo el hueco que interesa vigilar.
 *
 * La línea de la tasa base es lo que evita el error de lectura más común: un
 * 20% no es «poco» si el suceso ocurre el 20% de los días —ahí el modelo no
 * está diciendo nada—, y sí es mucho si ocurre el 5%.
 */
export function RiesgoChart({ serie, tasaBase, altura = 280, nota }: Props) {
  if (serie.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-text-muted"
        style={{ height: altura }}
      >
        Aún no hay días suficientes para dibujar la curva
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dia"
              tickFormatter={fmtFechaEje}
              stroke={CHART_COLORS.muted}
              tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.borde }}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={fmtPctEje}
              stroke={CHART_COLORS.muted}
              tick={{ fontSize: 10, fill: CHART_COLORS.muted }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              labelFormatter={label => String(label)}
              formatter={(value, name) => [`${(Number(value) * 100).toFixed(1)}%`, String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: CHART_COLORS.muted }} iconType="plainline" />
            {typeof tasaBase === 'number' && (
              <ReferenceLine
                y={tasaBase}
                stroke={CHART_COLORS.muted}
                strokeDasharray="4 4"
                label={{
                  value: `frecuencia histórica ${(tasaBase * 100).toFixed(0)}%`,
                  position: 'insideTopRight',
                  fill: CHART_COLORS.muted,
                  fontSize: 10,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="mercado"
              name="Shock de mercado"
              stroke={CHART_COLORS.azul}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="geopolitico"
              name="Escalada geopolítica"
              stroke={CHART_COLORS.naranja}
              strokeWidth={2}
              strokeDasharray="5 3"
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
