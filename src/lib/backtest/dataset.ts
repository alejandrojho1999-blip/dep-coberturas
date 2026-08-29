/**
 * Construcción del dataset descargable del backtest.
 *
 * Son funciones puras: reciben el dataset publicado y devuelven el contenido del
 * fichero en memoria. No tocan disco ni importan el JSON —eso lo hace
 * `dataset-source.ts`—, así que sirven igual en el script que las valida al
 * publicar y en la ruta de API que las entrega al usuario, y no hay dos
 * versiones del mismo exportador que puedan divergir.
 *
 * Los ficheros no se guardan generados en `public/`: allí serían accesibles sin
 * sesión, mientras que la pantalla que los enseña sí exige iniciarla. Se generan
 * al vuelo detrás de `/api/backtest/dataset`, que comprueba la sesión antes de
 * responder.
 *
 * Dos formatos por decisión, no por indecisión:
 *   · `.xlsx` — para abrir en Excel. Los números van como números, así que no
 *     depende de la configuración regional de quien lo abra.
 *   · `.csv`  — separado por comas y con punto decimal, el estándar que esperan
 *     pandas, R y demás. Abrirlo directamente en un Excel en español descoloca
 *     las columnas; para eso está el .xlsx.
 */
import * as XLSX from 'xlsx'

/* ── El dataset publicado ────────────────────────────────────────────────── */

export interface OperacionPublicada {
  ticker: string
  fechaEntrada: string
  fechaSalida: string
  precioEntrada: number
  precioSalida: number
  retorno: number
  motivoSalida: string
  scoreEntrada: number
  criteriosEntrada: Record<string, boolean>
}

/** Métricas de una curva; las claves son las que produce el motor. */
type Metricas = Record<string, number> & { contraste?: { tStat: number; pValor: number } }

export interface VarianteDataset {
  id: string
  agente: string
  capas: string
  universo: string
  generado: string
  muestra: Record<string, number | string>
  base: Metricas & { contraste: { tStat: number; pValor: number } }
  benchmark: (Metricas & { ticker: string }) | null
  mercadoAmplio: (Metricas & { ticker: string }) | null
  ventajaEstadistica: {
    contrasteRetornoActivo: { tStat: number; pValor: number }
    bootstrapBloques: { pValor: number }
    deflatedSharpe: { probabilidad: number; sharpeEsperadoPorAzar: number }
    nConfiguracionesProbadas: number
  }
  testDeControl: Record<string, number>
  atribucion: {
    porCapa: Record<string, Metricas>
    porScore: Record<string, Metricas>
    leaveOneOut: Record<string, Metricas>
  }
  robustez: Record<string, Metricas>
  subperiodos: Array<{
    nombre: string
    nPeriodos: number
    retornoAcumulado: number | null
    retornoActivoMedio: number | null
  }>
  paridad: {
    comparados: number
    jaccard: number
    acuerdoPorCriterio: Record<string, number>
  } | null
  curvas: {
    cartera: Array<{ fecha: string; valor: number }>
    benchmark: Array<{ fecha: string; valor: number }>
    mercadoAmplio: Array<{ fecha: string; valor: number }> | null
  }
  operaciones: OperacionPublicada[]
}

export interface DatasetPublicado {
  generado: string
  variantes: VarianteDataset[]
}

/** Nombre legible de la variante, el mismo que usa la pantalla. */
export const nombreVariante = (v: { agente: string; capas: string }) =>
  `${v.agente} · ${v.capas === 'lynch' ? 'solo Lynch' : 'cascada'}`

/* ── Filas ───────────────────────────────────────────────────────────────── */

type Fila = Record<string, string | number | null>

/** Una fila por operación, con los criterios del screener desplegados. */
function filasOperaciones(v: VarianteDataset): Fila[] {
  return v.operaciones.map(o => ({
    variante: nombreVariante(v),
    agente: v.agente,
    capas: v.capas,
    ticker: o.ticker,
    fecha_entrada: o.fechaEntrada,
    fecha_salida: o.fechaSalida,
    precio_entrada: o.precioEntrada,
    precio_salida: o.precioSalida,
    retorno: o.retorno,
    motivo_salida: o.motivoSalida,
    score_entrada: o.scoreEntrada,
    ...Object.fromEntries(
      Object.entries(o.criteriosEntrada).map(([k, val]) => [`criterio_${k}`, val ? 1 : 0]),
    ),
  }))
}

/** Una fila por variante con todo lo que la pantalla enseña como métrica. */
function filaMetricas(v: VarianteDataset): Fila {
  return {
    variante: nombreVariante(v),
    agente: v.agente,
    capas: v.capas,
    universo: v.universo,
    benchmark: v.benchmark?.ticker ?? '',
    ventana_desde: String(v.muestra.desde),
    ventana_hasta: String(v.muestra.hasta),
    meses: v.base.nPeriodos,
    rebalanceos: Number(v.muestra.nRebalanceos),
    cagr: v.base.cagr,
    cagr_benchmark: v.benchmark?.cagr ?? null,
    retorno_total: v.base.retornoTotal,
    retorno_total_benchmark: v.benchmark?.retornoTotal ?? null,
    volatilidad_anual: v.base.volatilidadAnual,
    sharpe: v.base.sharpe,
    sharpe_benchmark: v.benchmark?.sharpe ?? null,
    max_drawdown: v.base.maxDrawdown,
    max_drawdown_benchmark: v.benchmark?.maxDrawdown ?? null,
    retorno_activo_medio: v.base.retornoActivoMedio,
    tracking_error: v.base.trackingError,
    information_ratio: v.base.informationRatio,
    beta: v.base.beta,
    alpha_anual: v.base.alphaAnual,
    t_stat: v.base.contraste.tStat,
    p_valor: v.base.contraste.pValor,
    bootstrap_p_valor: v.ventajaEstadistica.bootstrapBloques.pValor,
    deflated_sharpe: v.ventajaEstadistica.deflatedSharpe.probabilidad,
    sharpe_esperado_por_azar: v.ventajaEstadistica.deflatedSharpe.sharpeEsperadoPorAzar,
    configuraciones_probadas: v.ventajaEstadistica.nConfiguracionesProbadas,
    control_percentil: v.testDeControl.percentilDeLaCarteraReal,
    control_cagr_mediano: v.testDeControl.cagrControlMediano,
    control_n_carteras: v.testDeControl.nCarteras,
    n_operaciones: v.base.nOperaciones,
    hit_rate: v.base.hitRate,
    retorno_medio_operacion: v.base.retornoMedioOperacion,
    posiciones_medias: v.base.posicionesMedias,
    mercado_amplio: v.mercadoAmplio?.ticker ?? '',
    cagr_mercado_amplio: v.mercadoAmplio?.cagr ?? null,
    tickers_universo: Number(v.muestra.tickersDeclarados),
    tickers_con_datos: Number(v.muestra.tickersConDatos),
    sesgo_supervivencia_pct: Number(v.muestra.sesgoSupervivenciaPct),
    generado: v.generado,
  }
}

/** Aplana un bloque `{ nombre: métricas }` en filas comparables. */
function filasBloque(v: VarianteDataset, bloque: Record<string, Metricas>, columna: string): Fila[] {
  return Object.entries(bloque).map(([k, m]) => ({
    variante: nombreVariante(v),
    [columna]: k,
    cagr: m.cagr ?? null,
    sharpe: m.sharpe ?? null,
    information_ratio: m.informationRatio ?? null,
    max_drawdown: m.maxDrawdown ?? null,
    n_operaciones: m.nOperaciones ?? null,
  }))
}

function filasTramos(v: VarianteDataset): Fila[] {
  return v.subperiodos.map(s => ({
    variante: nombreVariante(v),
    tramo: s.nombre,
    meses: s.nPeriodos,
    retorno_acumulado: s.retornoAcumulado,
    retorno_activo_medio: s.retornoActivoMedio,
  }))
}

function filasCurvas(v: VarianteDataset): Fila[] {
  return v.curvas.cartera.map((p, i) => ({
    variante: nombreVariante(v),
    fecha: p.fecha,
    cartera: p.valor,
    benchmark: v.curvas.benchmark[i]?.valor ?? null,
    mercado_amplio: v.curvas.mercadoAmplio?.[i]?.valor ?? null,
  }))
}

function filasParidad(v: VarianteDataset): Fila[] {
  if (!v.paridad) return []
  const p = v.paridad
  return Object.entries(p.acuerdoPorCriterio).map(([criterio, acuerdo]) => ({
    variante: nombreVariante(v),
    criterio,
    acuerdo,
    tickers_comparados: p.comparados,
    jaccard_seleccion: p.jaccard,
  }))
}

/* ── Formatos ────────────────────────────────────────────────────────────── */

/** Escapa un valor según RFC 4180: comillas dobladas y campo entrecomillado. */
function campoCsv(valor: string | number | null): string {
  if (valor == null) return ''
  const s = String(valor)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function aCsv(filas: Fila[]): string {
  if (!filas.length) return ''
  const columnas = Object.keys(filas[0])
  const lineas = [columnas.join(',')]
  for (const f of filas) lineas.push(columnas.map(c => campoCsv(f[c])).join(','))
  return lineas.join('\n') + '\n'
}

function hoja(libro: XLSX.WorkBook, nombre: string, filas: Fila[]) {
  if (!filas.length) return
  // Excel corta los nombres de hoja a 31 caracteres y falla con duplicados.
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), nombre.slice(0, 31))
}

/**
 * Libro de un agente, con sus dos variantes en cada hoja.
 *
 * Se agrupa por agente y no por variante porque la pregunta que responde el
 * estudio es "¿aportan las capas técnicas?", y eso se lee comparando las dos
 * variantes del mismo agente en la misma tabla.
 */
function libroDelAgente(variantes: VarianteDataset[]): Buffer {
  const libro = XLSX.utils.book_new()
  hoja(libro, 'Métricas', variantes.map(filaMetricas))
  hoja(libro, 'Operaciones', variantes.flatMap(filasOperaciones))
  hoja(libro, 'Tramos anuales', variantes.flatMap(filasTramos))
  hoja(libro, 'Atribución por capa', variantes.flatMap(v => filasBloque(v, v.atribucion.porCapa, 'capa')))
  hoja(libro, 'Atribución por criterio', variantes.flatMap(v => filasBloque(v, v.atribucion.leaveOneOut, 'criterio_retirado')))
  hoja(libro, 'Atribución por score', variantes.flatMap(v => filasBloque(v, v.atribucion.porScore, 'corte_score')))
  hoja(libro, 'Robustez', variantes.flatMap(v => filasBloque(v, v.robustez, 'variante_robustez')))
  hoja(libro, 'Curvas', variantes.flatMap(filasCurvas))
  hoja(libro, 'Paridad screener', variantes.flatMap(filasParidad))
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/* ── Catálogo ────────────────────────────────────────────────────────────── */

export const TIPO_MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
} as const

export interface EntradaCatalogo {
  fichero: string
  formato: 'xlsx' | 'csv'
  etiqueta: string
  descripcion: string
  /** Construye el contenido en memoria. */
  construir: () => Buffer | string
}

/**
 * Los ficheros que la aplicación sabe entregar.
 *
 * La ruta de API solo sirve nombres de esta lista, así que el parámetro de la
 * petición nunca llega a tocar una ruta del sistema de ficheros.
 */
export function catalogoDataset(dataset: DatasetPublicado): EntradaCatalogo[] {
  const entradas: EntradaCatalogo[] = []

  const porAgente = new Map<string, VarianteDataset[]>()
  for (const v of dataset.variantes) {
    const clave = v.agente.toLowerCase()
    porAgente.set(clave, [...(porAgente.get(clave) ?? []), v])
  }

  for (const [agente, variantes] of porAgente) {
    entradas.push({
      fichero: `backtest-${agente}.xlsx`,
      formato: 'xlsx',
      etiqueta: `Agente ${variantes[0].agente} · libro completo`,
      descripcion: 'Métricas, operaciones, tramos, atribución, robustez, curvas y paridad de sus dos variantes, en hojas separadas.',
      construir: () => libroDelAgente(variantes),
    })
  }

  for (const v of dataset.variantes) {
    entradas.push({
      fichero: `operaciones-${v.id}.csv`,
      formato: 'csv',
      etiqueta: `Operaciones · ${nombreVariante(v)}`,
      descripcion: `${v.operaciones.length.toLocaleString('es-ES')} operaciones con entrada, salida, retorno, motivo de cierre y los criterios que cumplía cada una.`,
      construir: () => aCsv(filasOperaciones(v)),
    })
  }

  entradas.push({
    fichero: 'metricas-backtest.csv',
    formato: 'csv',
    etiqueta: 'Métricas · las cuatro variantes',
    descripcion: 'Una fila por variante con rentabilidad, riesgo, contrastes estadísticos y datos de la muestra.',
    construir: () => aCsv(dataset.variantes.map(filaMetricas)),
  })

  return entradas
}
