'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PuntoCurva } from '@/lib/estrategias/types'
import { CHART_COLORS, fmtFechaEje, fmtUsd, fmtUsdCorto, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE, TOOLTIP_STYLE } from './chart-theme'

interface SerieSecundaria {
  slug: string
  nombre: string
  equity: PuntoCurva[]
}

interface Props {
  serie: PuntoCurva[]
  /** Curvas de fondo en trazo fino, para situar la principal en contexto. */
  secundarias?: SerieSecundaria[]
  /** Fecha donde dibujar la línea de corte de régimen. */
  corteRegimen?: string
  etiquetaCorte?: string
  color?: string
  altura?: number
  nombre?: string
}

/** Reduce la serie a un máximo de puntos sin perder la forma de la curva. */
function submuestrear<T>(serie: T[], maximo: number): T[] {
  if (serie.length <= maximo) return serie
  const paso = serie.length / maximo
  const salida: T[] = []
  for (let i = 0; i < maximo - 1; i++) salida.push(serie[Math.floor(i * paso)])
  salida.push(serie[serie.length - 1]) // el último punto siempre, es el neto final
  return salida
}

/**
 * Curva de resultado acumulado de una estrategia.
 *
 * El corte de régimen va dibujado como línea vertical porque es el dato que
 * más condiciona la lectura: en cinco de las seis estrategias el edge aparece
 * a partir de julio de 2020, y eso se ve antes en la curva que en cualquier
 * tabla.
 */
export function StrategyEquityChart({
  serie,
  secundarias,
  corteRegimen,
  etiquetaCorte = 'jul 2020',
  color = CHART_COLORS.azul,
  altura = 300,
  nombre = 'Resultado acumulado',
}: Props) {
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

  const principal = submuestrear(serie, 400)

  // Todas las series se alinean por fecha en una sola tabla para que Recharts
  // pueda dibujarlas superpuestas con un único eje temporal.
  const indice = new Map<string, Record<string, number | string>>()
  for (const p of principal) {
    indice.set(p.fecha, { fecha: p.fecha, principal: p.valor })
  }
  for (const s of secundarias ?? []) {
    for (const p of submuestrear(s.equity, 200)) {
      const fila = indice.get(p.fecha) ?? { fecha: p.fecha }
      fila[s.slug] = p.valor
      indice.set(p.fecha, fila)
    }
  }
  const data = [...indice.values()].sort((a, b) =>
    String(a.fecha).localeCompare(String(b.fecha))
  )

  const hayCorte = corteRegimen && serie.some(p => p.fecha >= corteRegimen)

  return (
    <div>
      <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: altura }}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="gradEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
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
            formatter={(value, name) => {
              const clave = String(name)
              return [
                fmtUsd(Number(value), 0),
                clave === 'principal'
                  ? nombre
                  : (secundarias?.find(s => s.slug === clave)?.nombre ?? clave),
              ]
            }}
          />

          {hayCorte && (
            <ReferenceLine
              x={corteRegimen}
              stroke={CHART_COLORS.muted}
              strokeDasharray="4 4"
              label={{
                value: etiquetaCorte,
                position: 'insideTopLeft',
                fill: CHART_COLORS.muted,
                fontSize: 10,
              }}
            />
          )}
          <ReferenceLine y={0} stroke={CHART_COLORS.borde} />

          {(secundarias ?? []).map(s => (
            <Line
              key={s.slug}
              type="monotone"
              dataKey={s.slug}
              stroke={CHART_COLORS.muted}
              strokeWidth={1}
              strokeOpacity={0.45}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}

          <Area
            type="monotone"
            dataKey="principal"
            stroke={color}
            strokeWidth={2}
            fill="url(#gradEquity)"
            dot={false}
            connectNulls
            isAnimationActive={false}
            name={nombre}
          />

        </AreaChart>
      </ResponsiveContainer>
      </div>

      {secundarias && secundarias.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] text-text-secondary">
            <span className="h-0.5 w-4 rounded" style={{ background: color }} />
            {nombre}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <span className="h-px w-4" style={{ background: CHART_COLORS.muted }} />
            Las {secundarias.length} estrategias por separado
          </span>
        </div>
      )}
    </div>
  )
}
