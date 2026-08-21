import type { SettlementPosition } from '@/lib/options/settlement'

/** Una barra diaria reducida a lo que necesita el portafolio. */
export interface DailyClose {
  /** Día natural en formato YYYY-MM-DD. */
  date: string
  close: number
}

/** Series de cierres diarios indexadas por ticker. */
export type ClosesByTicker = Record<string, DailyClose[]>

/** Campos comunes a las posiciones de los dos portafolios. */
interface BasePosition {
  id: string
  ticker: string
  /** Nombre visible del agente que la originó: Peter, Small, Gamma o Theta. */
  agente: string
  category: string
  /** Fecha de entrada (YYYY-MM-DD). */
  fechaEntrada: string
  /** Fecha de cierre (YYYY-MM-DD), null si sigue abierta. */
  fechaCierre: string | null
  /** true si `fechaCierre` se dedujo por no existir `closed_at` en la fila. */
  fechaCierreEstimada: boolean
  abierta: boolean
  /** Capital que el portafolio tiene comprometido en esta posición. */
  capitalComprometido: number
  /** Valor de mercado hoy. En las cerradas, el importe con el que se liquidó. */
  valorActual: number | null
  /** Resultado en dólares. null si falta el precio para calcularlo. */
  pnl: number | null
  /** Resultado en porcentaje sobre el capital comprometido. */
  pnlPct: number | null
}

export interface StockPosition extends BasePosition {
  empresa: string | null
  precioEntrada: number
  /** Acciones compradas: TICKET_ACCIONES / precioEntrada. Fraccional. */
  cantidad: number
  precioSalida: number | null
  precioActual: number | null
}

export interface OptionPosition extends BasePosition {
  posicion: SettlementPosition
  strike: number
  expiration: string
  /** Prima por acción con la que se abrió. */
  primaEntrada: number
  /** Prima por acción de hoy, o el valor de liquidación si ya venció. */
  primaActual: number | null
  contratos: number
  /** true si el portafolio cobró la prima al abrir (Theta). */
  esCorta: boolean
  /** Explicación del capital comprometido, para el tooltip del pastel. */
  detalleCapital: string
}

export type PortfolioPosition = StockPosition | OptionPosition

/** Un punto de la curva de equity. */
export interface EquityPoint {
  date: string
  /** Valor total del portafolio ese día. */
  valor: number
}

/** Serie del portafolio y del benchmark ya alineadas por fecha. */
export interface EquitySeriesPoint {
  date: string
  portafolio: number
  benchmark: number | null
}

/** Métricas de rendimiento y riesgo de un portafolio. */
export interface PortfolioMetrics {
  capital: number
  /** Capital comprometido en las posiciones abiertas. */
  invertido: number
  /** Capital sin desplegar, incluido el producto de las ventas. */
  caja: number
  valorTotal: number
  pnlRealizado: number
  pnlNoRealizado: number
  pnlTotal: number
  rendimientoPct: number
  posicionesAbiertas: number
  posicionesCerradas: number
  ganadoras: number
  perdedoras: number
  winRate: number | null
  gananciaMedia: number | null
  perdidaMedia: number | null
  profitFactor: number | null
  mejor: { ticker: string; pnl: number } | null
  peor: { ticker: string; pnl: number } | null
  diasMediosEnCartera: number | null
  exposicionPorAgente: Array<{ agente: string; valor: number; peso: number }>
}

/** Métricas que solo tienen sentido con una curva temporal. */
export interface CurveMetrics {
  maxDrawdown: number
  volatilidadAnualizada: number | null
  sharpe: number | null
  sortino: number | null
  cagr: number | null
  beta: number | null
  alpha: number | null
  trackingError: number | null
  informationRatio: number | null
  /** Rendimiento del benchmark en el mismo periodo, en porcentaje. */
  rendimientoBenchmark: number | null
}

/** Fila del libro de operaciones cerradas. */
export interface ClosedTrade {
  id: string
  ticker: string
  agente: string
  fechaEntrada: string
  fechaCierre: string
  fechaCierreEstimada: boolean
  entrada: number
  salida: number
  dias: number
  pnl: number
  pnlPct: number
  /** Detalle del contrato, solo en opciones. */
  contrato: string | null
}
