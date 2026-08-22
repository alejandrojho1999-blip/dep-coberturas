/**
 * Tipos de la sección de Estrategias.
 *
 * Hay dos fuentes distintas y conviene no mezclarlas:
 *
 *   · Los tipos `Backtest*` describen lo que produce
 *     `scripts/build-estrategias.mjs` a partir de las operaciones reales.
 *     Son datos calculados.
 *   · Los tipos `Ficha*` describen el contenido curado de las tesis: la
 *     narrativa, los criterios y todo lo que un CSV no puede contener.
 */

// ─────────────────────────── Datos calculados ───────────────────────────

export interface PuntoCurva {
  fecha: string
  valor: number
}

export interface ResumenBacktest {
  operaciones: number
  neto: number
  drawdown: number
  fechaDrawdown: string | null
  netoSobreDrawdown: number | null
  profitFactor: number | null
  tStat: number | null
  aciertos: number
  porOperacion: number
  medianaOperacion: number | null
  mejor: number
  peor: number
  desde: string | null
  hasta: string | null
}

export interface AnioBacktest {
  anio: string
  pnl: number
  operaciones: number
  ganadoras: number
}

export interface CuboDistribucion {
  desde: number | null
  hasta: number | null
  operaciones: number
  cola?: 'izquierda' | 'derecha'
}

export interface TramoConcentracion {
  top: number
  suma: number
  porcentajeDelNeto: number | null
  resto: number
}

export interface BloqueRegimen {
  operaciones: number
  neto: number
  profitFactor: number | null
  tStat: number | null
  porOperacion: number
}

export interface RegimenBacktest {
  corte: string
  anterior: BloqueRegimen | null
  posterior: BloqueRegimen | null
}

export interface AvisoVerificacion {
  campo: string
  obtenido: number
  esperado: number
  desvio: number
}

export interface BacktestEstrategia {
  slug: string
  nombre: string
  resumen: ResumenBacktest
  equity: PuntoCurva[]
  drawdown: PuntoCurva[]
  anual: AnioBacktest[]
  distribucion: CuboDistribucion[]
  concentracion: TramoConcentracion[]
  regimen: RegimenBacktest
  verificacion: {
    contrastadoCon: string
    avisos: AvisoVerificacion[]
  }
}

export interface ComponenteCartera {
  slug: string
  nombre: string
  neto: number
  drawdown: number
  netoSobreDrawdown: number | null
  operaciones: number
  porcentajeDelNeto: number
}

export interface BacktestCartera {
  resumen: {
    estrategias: number
    operaciones: number
    neto: number
    drawdown: number
    fechaDrawdown: string | null
    netoSobreDrawdown: number
    tStat: number | null
    sumaDrawdownsIndividuales: number
    reduccionDrawdown: number
    mesesPositivos: number
    mesesTotales: number
    mesesEnPositivo: number
    porAnio: number
    desde: string | null
    hasta: string | null
  }
  equity: PuntoCurva[]
  drawdown: PuntoCurva[]
  anual: AnioBacktest[]
  componentes: ComponenteCartera[]
  curvasIndividuales: { slug: string; nombre: string; equity: PuntoCurva[] }[]
  regimen: {
    corte: string
    anterior: { neto: number; drawdown: number; netoSobreDrawdown: number | null } | null
    posterior: { neto: number; drawdown: number; netoSobreDrawdown: number | null } | null
  }
}

// ──────────────────────── Contenido curado ─────────────────────────────

/** Fila de una tabla simple etiqueta → valor. */
export interface FilaDato {
  etiqueta: string
  valor: string
  nota?: string
}

/** Métricas que solo están publicadas en la tesis, no en el CSV. */
export interface MetricasTesis {
  /** Neto en NQ, tal como lo publica la tesis. */
  netoNQ: number
  drawdownNQ: number
  /** Probabilidad de que el resultado sea azar, según el Strategy Analyzer. */
  probability?: number
  rCuadrado?: number
  /** Días que tardó en recuperar el peor drawdown. */
  maxTiempoRecuperacion?: number
}

export interface AporteCartera {
  /** Net/DD del conjunto si se retira esta estrategia. */
  netoSobreDrawdownSinElla: number
  /** Cuánto Net/DD cuesta quitarla. Negativo. */
  coste: number
  /** Cociente entre el t-stat posterior y el anterior a julio de 2020. */
  ratioRegimen: string
  tAnterior: number | null
  tPosterior: number | null
  correlaciones?: { con: string; media: number; peoresDias: number | null }[]
  nota?: string
}

export interface FichaEstrategia {
  slug: string
  nombre: string
  /** Subtítulo de portada de la tesis. */
  subtitulo: string
  /** El sistema en una frase, sin jerga. */
  enUnaFrase: string
  /** Familia: qué tipo de ineficiencia explota. */
  estilo: string
  instrumento: string
  grafico: string
  sesion: 'RTH' | 'ETH'
  direccion: string
  contratos: number
  /** Fecha de arranque de la Fase E, en simulado. */
  desdeFaseE: string
  comoOpera: FilaDato[]
  metricasTesis: MetricasTesis
  aporteCartera: AporteCartera
  /** Puntos fuertes, en la voz de la tesis. */
  loQueSostiene: string[]
  /** Criterios que la estrategia NO cumple. Es lo que da credibilidad. */
  loQueNoCumple: string[]
  riesgos: FilaDato[]
  configProduccion: FilaDato[]
  /** Condición fijada por escrito para pasar a capital real. */
  graduacion?: string
  /** Diagramas extra, además de la infografía. */
  diagramas?: { archivo: string; titulo: string; descripcion: string }[]
  /** Diferencias entre la tesis individual y el documento de cartera. */
  discrepancias?: string[]
}

export interface EstrategiaCompleta {
  ficha: FichaEstrategia
  backtest: BacktestEstrategia
}
