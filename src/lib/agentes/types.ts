/**
 * Forma de una fila de `agent_recommendations`, la única tabla donde escriben
 * los cuatro agentes (Peter, Small, Gamma y Theta). La categoría es lo que
 * distingue a unos de otros; el detalle del contrato de opciones vive dentro
 * de `ai_report`.
 */
export interface AgentRec {
  id: string
  user_id: string
  ticker: string
  empresa: string | null
  category: string
  precio_entrada: number | null
  precio_objetivo: number | null
  stop_loss: number | null
  precio_venta: number | null
  cantidad_acciones: number | null
  direction: string | null
  riesgo: string | null
  timeframe: string | null
  resumen: string | null
  score: number | null
  market_cap_m: number | null
  estado: string | null
  /** Rentabilidad de cierre. Solo la escribe el agente al vender. */
  rentabilidad?: number | null
  created_at: string
  /** Fecha de cierre. NULL en las filas cerradas antes de la migración 017. */
  closed_at?: string | null
  ai_report?: Record<string, unknown> | null
}

/** Categorías que escribe cada agente en la columna `category`. */
export const CATEGORIA_PETER = 'PETER_LYNCH'
/** El renombrado visible a "Agente Small" no tocó el valor en BD. */
export const CATEGORIA_SMALL = 'SMALL_CAPS'
export const CATEGORIA_GAMMA = 'OPTIONS_GAMMA'
export const CATEGORIA_THETA = 'OPTIONS_THETA'

/** Nombre visible del agente que originó una recomendación. */
export function nombreAgente(category: string): string {
  switch (category) {
    case CATEGORIA_PETER: return 'Peter'
    case CATEGORIA_SMALL: return 'Small'
    case CATEGORIA_GAMMA: return 'Gamma'
    case CATEGORIA_THETA: return 'Theta'
    default: return category
  }
}

/**
 * Una posición está abierta mientras el agente no la haya vendido.
 *
 * Se exigen las dos señales porque conviven dos caminos de cierre: el agente
 * marca `estado = 'Vender'` y anota el precio, mientras que un cierre manual
 * puede escribir solo el precio de venta.
 */
export function estaAbierta(rec: AgentRec): boolean {
  return rec.estado !== 'Vender' && rec.precio_venta == null
}
