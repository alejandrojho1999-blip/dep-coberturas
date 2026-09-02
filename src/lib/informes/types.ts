export interface HistorialIngreso {
  año: number
  revenue: number | null
  gross_profit: number | null
  net_income: number | null
}

export interface HistorialFCF {
  año: number
  cfo: number | null
  capex: number | null
  fcf: number | null
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
  free_cashflow: number | null
  fcf_history: HistorialFCF[]
  dcf_value: number | null
  revenue_growth_rate: number | null
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

export interface ClienteProveedor {
  nombre: string
  relevancia: string
}

/** Valoración construida con los datos que aportó el usuario, no con Yahoo. */
export interface ValoracionPropia {
  metodo: string
  supuestos: string[]
  valor_por_accion: number | null
  upside_pct: number | null
}

/**
 * Una cifra y el archivo del que salió.
 *
 * Es la pieza que convierte «el adjunto es fuente de verdad» en algo
 * comprobable: sin poder señalar el archivo, una cifra no entra en el
 * documento. `verificado` lo pone el servidor tras buscar el valor en el texto
 * extraído; el modelo no puede escribirlo.
 */
export interface TrazaDato {
  dato: string
  valor: string
  archivo: string
  ubicacion: string
  nota?: string
  verificado?: boolean
}

/** Archivo que el usuario adjuntó y que alimentó la tesis. */
export interface FuenteAdjunta {
  filename: string
  doc_type: string
  chars: number
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
  dcf_analysis: string
  principales_clientes: ClienteProveedor[]
  principales_proveedores: ClienteProveedor[]
  principales_competidores: ClienteProveedor[]
  financieros: string
  valoracion: string
  factores_positivos: FactorInversion[]
  factores_riesgo: FactorInversion[]
  conclusion: string
  mes_año: string

  // ── Campos de tesis ───────────────────────────────────────────────────────
  // Todos opcionales, y a propósito: las filas de `informes_history` anteriores
  // a esta versión guardan el esquema de arriba y tienen que seguir
  // regenerándose sin ramas especiales. Ausentes ⇒ el documento sale como el
  // informe de siempre.

  /** Ausente equivale a 'informe'. */
  tipo_documento?: 'informe' | 'tesis'
  /** Qué se compra y por qué, en tres o cuatro frases. */
  tesis_central?: string
  horizonte?: string
  catalizadores?: FactorInversion[]
  /** Qué habría que observar para dar la tesis por rota. */
  invalidadores?: FactorInversion[]
  valoracion_propia?: ValoracionPropia
  trazabilidad?: TrazaDato[]
  fuentes_adjuntas?: FuenteAdjunta[]
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
  /** Decisión del CEO. Distinta de `estado`, que es el estado de la posición. */
  aprobacion: 'Revision' | 'Aprobada' | 'Rechazada' | 'Observacion' | null
  /** Cuándo se registró esa decisión: origen del rendimiento de las rechazadas. */
  aprobacion_at: string | null
  comision_cobrada: boolean | null
  comision_cobrada_at: string | null
  /** Importe congelado al marcar el cobro; null en las filas históricas. */
  comision_cobrada_monto: number | null
}
