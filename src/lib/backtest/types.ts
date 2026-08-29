/** Tipos compartidos por el motor de backtest de los agentes Peter y Small. */
import type { ScreenerCriteria } from '@/lib/peter-lynch/screener'

// ── Datos crudos en caché (`data/backtest/`) ────────────────────────────────

export interface PriceRow {
  /** 'YYYY-MM-DD' */
  date: string
  /** Cierre ajustado por splits (base actual), sin ajustar por dividendos. */
  close: number
  /** Cierre ajustado por splits y dividendos: es el que sirve para retornos. */
  adjClose: number
  volume: number
}

export interface SplitRow {
  date: string
  /** 4 en un 4:1. Los precios anteriores ya vienen divididos por este factor. */
  factor: number
}

export interface PriceSeries {
  ticker: string
  rows: PriceRow[]
  splits: SplitRow[]
}

/** Una línea de `fundamentalsTimeSeries`, con solo los campos que usamos. */
export interface ReporteFundamental {
  /** Cierre del ejercicio fiscal ('YYYY-MM-DD'). NO es la fecha de publicación. */
  asOfDate: string
  netIncome: number | null
  dilutedEPS: number | null
  totalDebt: number | null
  cash: number | null
  shares: number | null
  stockholdersEquity: number | null
  totalRevenue: number | null
}

export interface FundamentalesTicker {
  ticker: string
  annual: ReporteFundamental[]
  quarterly: ReporteFundamental[]
}

// ── Panel point-in-time ─────────────────────────────────────────────────────

/** Features de un ticker en una fecha, con solo información ya publicada. */
export interface PanelRow {
  ticker: string
  /** Fecha de rebalanceo ('YYYY-MM-DD'). */
  fecha: string
  close: number
  adjClose: number
  /** Ejercicio del que salen los fundamentales, y cuándo se consideró público. */
  reporteAsOf: string
  reportePublicoDesde: string

  trailingPE: number | null
  /** Proxy: no existe histórico de consenso de analistas en Yahoo gratis. */
  forwardPE: number | null
  debtToEquity: number | null
  earningsGrowth: number | null
  /** Proxy: el `pegRatio` de Yahoo usa crecimiento forward. */
  pegRatio: number | null
  marketCap: number | null
}

export type Universo = 'large_cap' | 'small_cap'

export interface Panel {
  universo: Universo
  fechas: string[]
  /** Indexado por fecha → filas de esa fecha. */
  porFecha: Map<string, PanelRow[]>
}

// ── Resultado del backtest ──────────────────────────────────────────────────

export interface Operacion {
  ticker: string
  fechaEntrada: string
  fechaSalida: string | null
  precioEntrada: number
  precioSalida: number | null
  /** Retorno total en fracción, ajustado por dividendos y neto de costes. */
  retorno: number | null
  motivoSalida: 'senal' | 'tope_temporal' | 'fin_muestra' | null
  scoreEntrada: number
  criteriosEntrada: ScreenerCriteria
}

export interface PuntoCurva {
  fecha: string
  valor: number
}
