export interface HistorialIngreso {
  año: number
  revenue: number | null
  gross_profit: number | null
  net_income: number | null
}

export interface HistorialPrecio {
  fecha: string
  cierre: number
}

export interface MarketData {
  ticker: string
  empresa: string
  bolsa: string
  precio_actual: number | null
  precio_52w_alto: number | null
  precio_52w_bajo: number | null
  market_cap: number | null
  beta: number | null
  shares_outstanding: number | null
  moneda: string | null
  sector: string | null
  industria: string | null
  descripcion: string | null
  pe_ratio: number | null
  ps_ratio: number | null
  ev_ebitda: number | null
  margen_bruto: number | null
  margen_neto: number | null
  margen_operacional: number | null
  eps: number | null
  deuda_total: number | null
  caja_total: number | null
  precio_objetivo: number | null
  recomendacion: string | null
  strong_buy: number
  buy: number
  hold: number
  sell: number
  strong_sell: number
  historial_ingresos: HistorialIngreso[]
  historial_precios: HistorialPrecio[]
}

export interface FuenteIngreso {
  segmento: string
  porcentaje: string
  descripcion: string
}

export interface FactorInversion {
  titulo: string
  desc: string
}

export interface ReportContent {
  ticker: string
  empresa: string
  bolsa: string
  precio_actual: number
  precio_objetivo: number
  informe_numero: number
  resumen: string
  negocio: string
  fuentes_ingresos: FuenteIngreso[]
  financieros: string
  valoracion: string
  factores_positivos: FactorInversion[]
  factores_riesgo: FactorInversion[]
  conclusion: string
  mes_año: string
}

export interface HistoryEntry {
  id: string
  user_id: string
  user_email: string | null
  ticker: string
  empresa: string | null
  bolsa: string | null
  solicitante: string | null
  filename: string
  informe_numero: number
  fecha_generacion: string
  content_json?: ReportContent | null
  custom_docx_path: string | null
  precio_compra: number | null
  cantidad_acciones: number | null
  precio_objetivo_personal: number | null
  estado: 'Comprar' | 'Mantener' | 'Vender' | 'Observacion' | null
  precio_venta: number | null
}
