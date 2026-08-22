'use client'

import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CuboDistribucion } from '@/lib/estrategias/types'
import { CHART_COLORS, fmtUsd, fmtUsdCorto, TOOLTIP_STYLE } from './chart-theme'

interface Props {
  cubos: CuboDistribucion[]
  altura?: number
}

/** Etiqueta legible de cada cubo, incluidos los abiertos de las colas. */
function etiqueta(c: CuboDistribucion): string {
  if (c.desde == null) return `≤ ${fmtUsdCorto(c.hasta ?? 0)}`
  if (c.hasta == null) return `≥ ${fmtUsdCorto(c.desde)}`
  return fmtUsdCorto((c.desde + c.hasta) / 2)
}

/**
 * Histograma de resultados por operación.
 *
 * Los cubos ganadores y perdedores se colorean distinto para que la asimetría
 * salte a la vista: en varias de estas estrategias hay muchas operaciones
 * pequeñas positivas y una cola larga a ambos lados, que es el perfil de un
 * vendedor de volatilidad.
 */
export function DistributionChart({ cubos, altura = 220 }: Props) {
  if (cubos.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted"
        style={{ height: altura }}
      >
        Sin operaciones que representar
      </div>
    )
  }

  const data = cubos.map(c => ({
    ...c,
    etiqueta: etiqueta(c),
    // El signo del centro del cubo decide el color.
    positivo: (c.desde ?? c.hasta ?? 0) >= 0,
  }))

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: altura }}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <XAxis
            dataKey="etiqueta"
            tick={{ fill: CHART_COLORS.muted, fontSize: 9 }}
            stroke={CHART_COLORS.borde}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
            stroke={CHART_COLORS.borde}
            width={40}
            label={{
              value: 'operaciones',
              angle: -90,
              position: 'insideLeft',
              fill: CHART_COLORS.muted,
              fontSize: 10,
            }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={TOOLTIP_STYLE}
            formatter={value => [`${Number(value)} operaciones`, '']}
            labelFormatter={(_, payload) => {
              const c = payload?.[0]?.payload as CuboDistribucion | undefined
              if (!c) return ''
              if (c.desde == null) return `Cola izquierda · hasta ${fmtUsd(c.hasta ?? 0, 0)}`
              if (c.hasta == null) return `Cola derecha · desde ${fmtUsd(c.desde, 0)}`
              return `${fmtUsd(c.desde, 0)} a ${fmtUsd(c.hasta, 0)}`
            }}
          />
          <ReferenceLine x={0} stroke={CHART_COLORS.borde} />
          <Bar dataKey="operaciones" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.positivo ? CHART_COLORS.positivo : CHART_COLORS.negativo}
                fillOpacity={d.cola ? 0.55 : 0.9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
