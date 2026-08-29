/**
 * Exporta el dataset del backtest a ficheros descargables.
 *
 * Lo llama `publicar-resumen.mts` en la misma pasada que genera el JSON de la
 * pantalla, para que descargas y pantalla no puedan desincronizarse: si alguien
 * regenera una sin la otra, estaría publicando dos versiones del mismo estudio.
 *
 * Salida en `public/descargas/backtest/`, que Next sirve como estático. No hay
 * ruta de API detrás: `data/backtest/` no existe en producción, así que un
 * endpoint que leyera de ahí funcionaría en local y fallaría en Vercel.
 *
 * Dos formatos por decisión, no por indecisión:
 *   · `.xlsx` — para abrir en Excel. Los números van como números, así que no
 *     depende de la configuración regional de quien lo abra.
 *   · `.csv`  — separado por comas y con punto decimal, el estándar que esperan
 *     pandas, R y demás. Abrirlo directamente en un Excel en español descoloca
 *     las columnas; para eso está el .xlsx.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import XLSX from 'xlsx'

export const DIR_DESCARGAS = path.resolve(process.cwd(), 'public/descargas/backtest')

/** Ruta pública de un fichero del dataset, tal y como la enlaza la pantalla. */
export const rutaPublica = (fichero: string) => `/descargas/backtest/${fichero}`

interface Operacion {
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

/** Lo que este exportador necesita de cada `resultados-*.json`. */
export interface BrutoExportable {
  id: string
  agente: string
  capas: string
  capasDescripcion: string
  generado: string
  universo: string
  muestra: Record<string, number | string>
  base: Record<string, number> & { contraste: { tStat: number; pValor: number } }
  benchmark: (Record<string, number> & { ticker: string }) | null
  mercadoAmplio: (Record<string, number> & { ticker: string }) | null
  ventajaEstadistica: {
    contrasteRetornoActivo: { tStat: number; pValor: number }
    bootstrapBloques: { pValor: number }
    deflatedSharpe: { probabilidad: number; sharpeEsperadoPorAzar: number }
    nConfiguracionesProbadas: number
  }
  testDeControl: Record<string, number>
  atribucion: {
    porCapa: Record<string, Record<string, number>>
    porScore: Record<string, Record<string, number>>
    leaveOneOut: Record<string, Record<string, number>>
  }
  robustez: Record<string, unknown> & {
    subperiodos: Array<{
      nombre: string
      nPeriodos: number
      retornoAcumulado: number | null
      retornoActivoMedio: number | null
    }>
  }
  sensibilidad?: {
    barridoUmbrales?: Array<Record<string, unknown>>
    barridoCorte?: Array<Record<string, unknown>>
  }
  paridadConElScreenerEnVivo?: {
    comparados: number
    jaccard: number
    acuerdoPorCriterio: Record<string, number>
  }
  curvas: {
    cartera: Array<{ fecha: string; valor: number }>
    benchmark: Array<{ fecha: string; valor: number }>
    mercadoAmplio: Array<{ fecha: string; valor: number }> | null
  }
  operaciones: Operacion[]
}

/** Nombre legible de la variante, el mismo que usa la pantalla. */
const nombreVariante = (b: BrutoExportable) =>
  `${b.agente} · ${b.capas === 'lynch' ? 'solo Lynch' : 'cascada'}`

type Fila = Record<string, string | number | null>

/** Un fichero del dataset, tal y como lo enlaza la pantalla. */
export interface FicheroExportado {
  fichero: string
  formato: 'xlsx' | 'csv'
  bytes: number
  etiqueta: string
  descripcion: string
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/** Escapa un valor según RFC 4180: comillas dobladas y campo entrecomillado. */
function campoCsv(v: string | number | null): string {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function aCsv(filas: Fila[]): string {
  if (!filas.length) return ''
  const columnas = Object.keys(filas[0])
  const lineas = [columnas.join(',')]
  for (const f of filas) lineas.push(columnas.map(c => campoCsv(f[c])).join(','))
  return lineas.join('\n') + '\n'
}

/* ── Hojas ───────────────────────────────────────────────────────────────── */

/** Una fila por operación, con los criterios del screener desplegados. */
function filasOperaciones(b: BrutoExportable): Fila[] {
  return b.operaciones.map(o => ({
    variante: nombreVariante(b),
    agente: b.agente,
    capas: b.capas,
    ticker: o.ticker,
    fecha_entrada: o.fechaEntrada,
    fecha_salida: o.fechaSalida,
    precio_entrada: o.precioEntrada,
    precio_salida: o.precioSalida,
    retorno: o.retorno,
    motivo_salida: o.motivoSalida,
    score_entrada: o.scoreEntrada,
    ...Object.fromEntries(
      Object.entries(o.criteriosEntrada).map(([k, v]) => [`criterio_${k}`, v ? 1 : 0]),
    ),
  }))
}

/** Una fila por variante con todo lo que la pantalla enseña como métrica. */
function filaMetricas(b: BrutoExportable): Fila {
  return {
    variante: nombreVariante(b),
    agente: b.agente,
    capas: b.capas,
    universo: b.universo,
    benchmark: b.benchmark?.ticker ?? '',
    ventana_desde: String(b.muestra.desde),
    ventana_hasta: String(b.muestra.hasta),
    meses: b.base.nPeriodos,
    rebalanceos: Number(b.muestra.nRebalanceos),
    cagr: b.base.cagr,
    cagr_benchmark: b.benchmark?.cagr ?? null,
    retorno_total: b.base.retornoTotal,
    retorno_total_benchmark: b.benchmark?.retornoTotal ?? null,
    volatilidad_anual: b.base.volatilidadAnual,
    sharpe: b.base.sharpe,
    sharpe_benchmark: b.benchmark?.sharpe ?? null,
    max_drawdown: b.base.maxDrawdown,
    max_drawdown_benchmark: b.benchmark?.maxDrawdown ?? null,
    retorno_activo_medio: b.base.retornoActivoMedio,
    tracking_error: b.base.trackingError,
    information_ratio: b.base.informationRatio,
    beta: b.base.beta,
    alpha_anual: b.base.alphaAnual,
    t_stat: b.base.contraste.tStat,
    p_valor: b.base.contraste.pValor,
    bootstrap_p_valor: b.ventajaEstadistica.bootstrapBloques.pValor,
    deflated_sharpe: b.ventajaEstadistica.deflatedSharpe.probabilidad,
    sharpe_esperado_por_azar: b.ventajaEstadistica.deflatedSharpe.sharpeEsperadoPorAzar,
    configuraciones_probadas: b.ventajaEstadistica.nConfiguracionesProbadas,
    control_percentil: b.testDeControl.percentilDeLaCarteraReal,
    control_cagr_mediano: b.testDeControl.cagrControlMediano,
    control_n_carteras: b.testDeControl.nCarteras,
    n_operaciones: b.base.nOperaciones,
    hit_rate: b.base.hitRate,
    retorno_medio_operacion: b.base.retornoMedioOperacion,
    posiciones_medias: b.base.posicionesMedias,
    mercado_amplio: b.mercadoAmplio?.ticker ?? '',
    cagr_mercado_amplio: b.mercadoAmplio?.cagr ?? null,
    tickers_universo: Number(b.muestra.tickersDeclarados),
    tickers_con_datos: Number(b.muestra.tickersConDatos),
    sesgo_supervivencia_pct: Number(b.muestra.sesgoSupervivenciaPct),
    generado: b.generado,
  }
}

/** Aplana un bloque `{ nombre: métricas }` en filas comparables. */
function filasBloque(b: BrutoExportable, bloque: Record<string, Record<string, number>>, columna: string): Fila[] {
  return Object.entries(bloque).map(([k, m]) => ({
    variante: nombreVariante(b),
    [columna]: k,
    cagr: m.cagr ?? null,
    sharpe: m.sharpe ?? null,
    information_ratio: m.informationRatio ?? null,
    max_drawdown: m.maxDrawdown ?? null,
    n_operaciones: m.nOperaciones ?? null,
  }))
}

function filasTramos(b: BrutoExportable): Fila[] {
  return b.robustez.subperiodos.map(s => ({
    variante: nombreVariante(b),
    tramo: s.nombre,
    meses: s.nPeriodos,
    retorno_acumulado: s.retornoAcumulado,
    retorno_activo_medio: s.retornoActivoMedio,
  }))
}

function filasCurvas(b: BrutoExportable): Fila[] {
  return b.curvas.cartera.map((p, i) => ({
    variante: nombreVariante(b),
    fecha: p.fecha,
    cartera: p.valor,
    benchmark: b.curvas.benchmark[i]?.valor ?? null,
    mercado_amplio: b.curvas.mercadoAmplio?.[i]?.valor ?? null,
  }))
}

function filasRobustez(b: BrutoExportable): Fila[] {
  const bloque: Record<string, Record<string, number>> = {}
  for (const [k, v] of Object.entries(b.robustez)) {
    if (k === 'subperiodos' || k === 'pruebaLookAhead') continue
    if (v && typeof v === 'object') bloque[k] = v as Record<string, number>
  }
  return filasBloque(b, bloque, 'variante_robustez')
}

function filasParidad(b: BrutoExportable): Fila[] {
  const p = b.paridadConElScreenerEnVivo
  if (!p) return []
  return Object.entries(p.acuerdoPorCriterio).map(([criterio, acuerdo]) => ({
    variante: nombreVariante(b),
    criterio,
    acuerdo,
    tickers_comparados: p.comparados,
    jaccard_seleccion: p.jaccard,
  }))
}

/* ── Escritura ───────────────────────────────────────────────────────────── */

function hoja(libro: XLSX.WorkBook, nombre: string, filas: Fila[]) {
  if (!filas.length) return
  // Excel corta los nombres de hoja a 31 caracteres y falla con duplicados.
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), nombre.slice(0, 31))
}

/**
 * Escribe un libro por agente —cada uno con sus dos variantes— más los CSV
 * sueltos. Se agrupa por agente y no por variante porque la pregunta que el
 * estudio responde es "¿aportan las capas técnicas?", y eso se lee comparando
 * las dos variantes del mismo agente en la misma tabla.
 */
export async function exportarDataset(brutos: BrutoExportable[]): Promise<FicheroExportado[]> {
  await mkdir(DIR_DESCARGAS, { recursive: true })
  const escritos: FicheroExportado[] = []

  const porAgente = new Map<string, BrutoExportable[]>()
  for (const b of brutos) {
    const clave = b.agente.toLowerCase()
    porAgente.set(clave, [...(porAgente.get(clave) ?? []), b])
  }

  for (const [agente, variantes] of porAgente) {
    const libro = XLSX.utils.book_new()
    hoja(libro, 'Métricas', variantes.map(filaMetricas))
    hoja(libro, 'Operaciones', variantes.flatMap(filasOperaciones))
    hoja(libro, 'Tramos anuales', variantes.flatMap(filasTramos))
    hoja(libro, 'Atribución por capa', variantes.flatMap(b => filasBloque(b, b.atribucion.porCapa, 'capa')))
    hoja(libro, 'Atribución por criterio', variantes.flatMap(b => filasBloque(b, b.atribucion.leaveOneOut, 'criterio_retirado')))
    hoja(libro, 'Atribución por score', variantes.flatMap(b => filasBloque(b, b.atribucion.porScore, 'corte_score')))
    hoja(libro, 'Robustez', variantes.flatMap(filasRobustez))
    hoja(libro, 'Curvas', variantes.flatMap(filasCurvas))
    hoja(libro, 'Paridad screener', variantes.flatMap(filasParidad))

    const fichero = `backtest-${agente}.xlsx`
    const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    await writeFile(path.join(DIR_DESCARGAS, fichero), buffer)
    escritos.push({
      fichero,
      formato: 'xlsx',
      bytes: buffer.byteLength,
      etiqueta: `Agente ${variantes[0].agente} · libro completo`,
      descripcion: 'Métricas, operaciones, tramos, atribución, robustez, curvas y paridad de sus dos variantes, en hojas separadas.',
    })
  }

  // CSV de operaciones: uno por variante, para quien quiera cargarlas sin pasar
  // por Excel.
  for (const b of brutos) {
    const fichero = `operaciones-${b.id}.csv`
    const csv = aCsv(filasOperaciones(b))
    await writeFile(path.join(DIR_DESCARGAS, fichero), csv, 'utf8')
    escritos.push({
      fichero,
      formato: 'csv',
      bytes: Buffer.byteLength(csv),
      etiqueta: `Operaciones · ${nombreVariante(b)}`,
      descripcion: `${b.operaciones.length.toLocaleString('es-ES')} operaciones con entrada, salida, retorno, motivo de cierre y los criterios que cumplía cada una.`,
    })
  }

  // Y un CSV con las métricas de las cuatro variantes, que es la tabla que
  // compara el estudio entero de un vistazo.
  const csvMetricas = aCsv(brutos.map(filaMetricas))
  await writeFile(path.join(DIR_DESCARGAS, 'metricas-backtest.csv'), csvMetricas, 'utf8')
  escritos.push({
    fichero: 'metricas-backtest.csv',
    formato: 'csv',
    bytes: Buffer.byteLength(csvMetricas),
    etiqueta: 'Métricas · las cuatro variantes',
    descripcion: 'Una fila por variante con rentabilidad, riesgo, contrastes estadísticos y datos de la muestra.',
  })

  return escritos
}
