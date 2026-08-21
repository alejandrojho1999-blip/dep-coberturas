/**
 * Paleta y formatos comunes a los gráficos.
 *
 * Las superficies (fondo, borde, texto, grid) replican los tokens de marca de
 * `globals.css` en hex literal porque Recharts los recibe como atributos SVG,
 * donde `var(--color-*)` no es fiable. Los colores de serie son funcionales,
 * no de marca: el manual SynerGy no cubre visualización de datos, así que se
 * eligen tonos fríos que conviven con el azul corporativo.
 */

export const CHART_COLORS = {
  fondo: '#0c1e2c',
  borde: '#24405a',
  texto: '#ffffff',
  muted: '#8fa3b4',
  grid: '#16293a',
  marca: '#003d66',
  azul: '#4d95d0',
  verde: '#10b981',
  morado: '#8b8ff0',
  naranja: '#e0a458',
  cian: '#38bdf8',
  positivo: '#10b981',
  negativo: '#f04438',
  /** Porción del pastel que representa el capital sin desplegar. */
  caja: '#24405a',
} as const

/** Colores por agente, los mismos que usan sus pestañas en /agentes. */
export const AGENT_COLORS: Record<string, string> = {
  Peter: '#10b981',
  Small: '#38bdf8',
  Gamma: '#8b8ff0',
  Theta: '#e0a458',
}

/**
 * Rueda de colores para las porciones del pastel. Se recorre en orden para que
 * un mismo ticker conserve su color entre refrescos mientras no cambie la
 * composición de la cartera. Arranca en el azul corporativo y se abre a tonos
 * fríos legibles sobre el fondo #05141f.
 */
const RUEDA = [
  '#4d95d0', '#38bdf8', '#8b8ff0', '#10b981', '#2dd4bf',
  '#7dd3fc', '#a5b4fc', '#5eead4', '#60a5fa', '#818cf8',
  '#34d399', '#22d3ee', '#93c5fd', '#c4b5fd', '#6ee7b7',
]

export function sliceColor(index: number): string {
  return RUEDA[index % RUEDA.length]
}

export function fmtUsd(n: number, decimales = 2): string {
  const signo = n < 0 ? '−' : ''
  return `${signo}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`
}

/** Importe compacto para ejes: $102.4k. */
export function fmtUsdCorto(n: number): string {
  const abs = Math.abs(n)
  const signo = n < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${signo}$${(abs / 1_000).toFixed(1)}k`
  return `${signo}$${abs.toFixed(0)}`
}

export function fmtPct(n: number | null, decimales = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimales)}%`
}

/** Fecha corta para los ejes temporales. */
export function fmtFechaEje(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

/** Estilo compartido por los tooltips de todos los gráficos. */
export const TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.fondo,
  border: `1px solid ${CHART_COLORS.borde}`,
  borderRadius: '8px',
  fontSize: '12px',
  color: CHART_COLORS.texto,
} as const
