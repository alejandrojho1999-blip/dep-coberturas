import type { PuntoCurva } from '@/lib/estrategias/types'
import { CHART_COLORS } from '@/components/charts/chart-theme'

interface Props {
  serie: PuntoCurva[]
  ancho?: number
  alto?: number
}

/**
 * Curva de resultado en miniatura para las tarjetas del índice.
 *
 * Se dibuja como SVG plano en el servidor en vez de con Recharts: son seis
 * gráficos diminutos y sin interacción, así que no compensa enviar la librería
 * al cliente ni convertir las tarjetas en componentes cliente.
 */
export function Sparkline({ serie, ancho = 280, alto = 44 }: Props) {
  if (serie.length < 2) return null

  const maximoPuntos = 120
  const paso = Math.max(1, Math.floor(serie.length / maximoPuntos))
  const puntos = serie.filter((_, i) => i % paso === 0)
  if (puntos.at(-1) !== serie.at(-1)) puntos.push(serie[serie.length - 1])

  const valores = puntos.map(p => p.valor)
  const min = Math.min(...valores, 0)
  const max = Math.max(...valores, 0)
  const rango = max - min || 1

  const x = (i: number) => (i / (puntos.length - 1)) * ancho
  const y = (v: number) => alto - ((v - min) / rango) * alto

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')
  const area = `${linea} L${ancho},${alto} L0,${alto} Z`
  const cero = y(0)

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="h-11 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.azul} stopOpacity={0.3} />
          <stop offset="100%" stopColor={CHART_COLORS.azul} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      {cero > 0 && cero < alto && (
        <line x1={0} y1={cero} x2={ancho} y2={cero} stroke={CHART_COLORS.borde} strokeWidth={1} />
      )}
      <path d={linea} fill="none" stroke={CHART_COLORS.azul} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
