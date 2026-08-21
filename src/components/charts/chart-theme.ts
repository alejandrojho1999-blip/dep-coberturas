/**
 * Paleta y formatos comunes a los gráficos.
 *
 * El dashboard no usa tokens de Tailwind sino hex literales, así que los
 * gráficos beben de las mismas constantes para no desentonar con el resto de
 * la interfaz.
 */

export const CHART_COLORS = {
  fondo: '#0f0f17',
  borde: '#1e2035',
  texto: '#e2e8f0',
  muted: '#64748b',
  grid: '#1e1e2e',
  ambar: '#F59E0B',
  verde: '#00ff88',
  morado: '#a78bfa',
  naranja: '#fb923c',
  cian: '#38bdf8',
  positivo: '#22c55e',
  negativo: '#ef4444',
  /** Porción del pastel que representa el capital sin desplegar. */
  caja: '#334155',
} as const

/** Colores por agente, los mismos que usan sus pestañas en /agentes. */
export const AGENT_COLORS: Record<string, string> = {
  Peter: '#00ff88',
  Small: '#38bdf8',
  Gamma: '#a78bfa',
  Theta: '#fb923c',
}

/**
 * Rueda de colores para las porciones del pastel. Se recorre en orden para que
 * un mismo ticker conserve su color entre refrescos mientras no cambie la
 * composición de la cartera.
 */
const RUEDA = [
  '#F59E0B', '#38bdf8', '#a78bfa', '#00ff88', '#fb923c',
  '#f472b6', '#facc15', '#2dd4bf', '#818cf8', '#fb7185',
  '#4ade80', '#c084fc', '#60a5fa', '#fbbf24', '#34d399',
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
  backgroundColor: '#12121a',
  border: `1px solid ${CHART_COLORS.borde}`,
  borderRadius: '8px',
  fontSize: '12px',
  color: CHART_COLORS.texto,
} as const
