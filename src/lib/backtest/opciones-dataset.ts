/**
 * Construcción del dataset descargable del backtest de opciones.
 *
 * Hermano de `dataset.ts`, que hace lo mismo para acciones. Van separados
 * porque los dos estudios no comparten ni una columna: allí hay criterios del
 * screener y atribución por capa; aquí hay strike, vencimiento, prima, delta y
 * un supuesto de volatilidad calibrado. Forzarlos a una tabla común llenaría
 * cada fila de huecos.
 *
 * Igual que su hermano, son funciones puras: reciben el dataset publicado y
 * devuelven el contenido del fichero en memoria. La carga del JSON y la entrega
 * al usuario ocurren en `dataset-source.ts` y en la ruta de API, que ya
 * comprueba la sesión antes de construir nada.
 */
import * as XLSX from 'xlsx'
import { TIPO_MIME, type EntradaCatalogo } from './dataset'
import type { MetricasOpciones, PuntoBarrido, PuntoCalibracion } from './opciones-publicado'

export { TIPO_MIME }

/* ── El dataset publicado ────────────────────────────────────────────────── */

export interface OperacionOpcionesPublicada {
  ticker: string
  lado: 'long' | 'short'
  tipo: 'call' | 'put'
  strike: number
  vencimiento: string
  fechaEntrada: string
  fechaSalida: string
  primaEntrada: number
  primaSalida: number
  contratos: number
  resultado: number
  retorno: number
  motivoSalida: string
  dteEntrada: number
  deltaEntrada: number
  ivEntrada: number
}

export interface AgenteDatasetOpciones {
  id: string
  nombre: string
  capital: number
  benchmark: string
  metricas: MetricasOpciones
  benchmarkMetricas: { cagr: number; sharpe: number; maxDrawdown: number; volatilidadAnual: number }
  curva: Array<{ fecha: string; valor: number }>
  benchmarkCurva: Array<{ fecha: string; valor: number }>
  barrido: PuntoBarrido[]
  operaciones: OperacionOpcionesPublicada[]
}

export interface VarianteDatasetOpciones {
  id: string
  descripcionModo: string
  modo: string
  conSkew: boolean
  conNivelesDeSalida: boolean
  calibracion: {
    kOptimo: number
    errorSeguimiento: number
    correlacion: number
    rejilla: PuntoCalibracion[]
  }
  agentes: AgenteDatasetOpciones[]
}

export interface DatasetOpciones {
  generado: string
  ventana: { desde: string; hasta: string; nVencimientos: number }
  primaDeVarianzaObservada: Record<string, number>
  variantes: VarianteDatasetOpciones[]
}

/* ── Filas ───────────────────────────────────────────────────────────────── */

type Fila = Record<string, string | number | null>

/**
 * Una fila por operación.
 *
 * Lleva la corrida y el supuesto calibrado en cada fila, no solo en una hoja
 * aparte: quien cargue el CSV en pandas necesita poder agrupar por variante sin
 * tener que cruzar con otro fichero, y sin el `k` de la corrida los números no
 * significan nada.
 */
function filasOperaciones(v: VarianteDatasetOpciones, a: AgenteDatasetOpciones): Fila[] {
  return a.operaciones.map(o => ({
    corrida: v.descripcionModo,
    modo_volatilidad: v.modo,
    con_skew: v.conSkew ? 1 : 0,
    con_niveles_salida: v.conNivelesDeSalida ? 1 : 0,
    k_calibrado: v.calibracion.kOptimo,
    agente: a.nombre,
    ticker: o.ticker,
    lado: o.lado,
    tipo: o.tipo,
    strike: o.strike,
    vencimiento: o.vencimiento,
    fecha_entrada: o.fechaEntrada,
    fecha_salida: o.fechaSalida,
    prima_entrada: o.primaEntrada,
    prima_salida: o.primaSalida,
    contratos: o.contratos,
    resultado_usd: o.resultado,
    retorno: o.retorno,
    motivo_salida: o.motivoSalida,
    dte_entrada: o.dteEntrada,
    delta_entrada: o.deltaEntrada,
    iv_entrada: o.ivEntrada,
  }))
}

/** Una fila por agente y corrida, con todo lo que la pantalla enseña. */
function filaMetricas(v: VarianteDatasetOpciones, a: AgenteDatasetOpciones): Fila {
  const m = a.metricas
  const b = a.benchmarkMetricas
  return {
    corrida: v.descripcionModo,
    modo_volatilidad: v.modo,
    con_skew: v.conSkew ? 1 : 0,
    con_niveles_salida: v.conNivelesDeSalida ? 1 : 0,
    agente: a.nombre,
    capital: a.capital,
    benchmark: a.benchmark,
    k_calibrado: v.calibracion.kOptimo,
    calibracion_correlacion: v.calibracion.correlacion,
    calibracion_error_seguimiento: v.calibracion.errorSeguimiento,
    cagr: m.cagr ?? null,
    cagr_benchmark: b?.cagr ?? null,
    retorno_total: m.retornoTotal ?? null,
    volatilidad_anual: m.volatilidadAnual ?? null,
    sharpe: m.sharpe ?? null,
    sharpe_benchmark: b?.sharpe ?? null,
    max_drawdown: m.maxDrawdown ?? null,
    max_drawdown_benchmark: b?.maxDrawdown ?? null,
    retorno_activo_medio: m.retornoActivoMedio ?? null,
    tracking_error: m.trackingError ?? null,
    information_ratio: m.informationRatio ?? null,
    beta: m.beta ?? null,
    alpha_anual: m.alphaAnual ?? null,
    t_stat: m.tStat ?? null,
    p_valor: m.pValor ?? null,
    bootstrap_p_valor: m.bootstrapPValor ?? null,
    n_operaciones: m.nOperaciones ?? null,
    hit_rate: m.hitRate ?? null,
    vencimientos_sin_posiciones: m.vencimientosSinPosiciones ?? null,
  }
}

/** El barrido del supuesto: qué habría salido con cada valor de `k`. */
function filasBarrido(v: VarianteDatasetOpciones, a: AgenteDatasetOpciones): Fila[] {
  return a.barrido.map(p => ({
    corrida: v.descripcionModo,
    agente: a.nombre,
    k: p.k,
    calibrado: p.calibrado ? 1 : 0,
    cagr: p.cagr,
    sharpe: p.sharpe,
    information_ratio: p.informationRatio,
    t_stat: p.tStat,
    n_operaciones: p.nOperaciones,
  }))
}

/** La calibración contra `^PUT`, que es lo que sostiene todo lo demás. */
function filasCalibracion(v: VarianteDatasetOpciones): Fila[] {
  return v.calibracion.rejilla.map(p => ({
    corrida: v.descripcionModo,
    modo_volatilidad: v.modo,
    k: p.k,
    calibrado: p.calibrado ? 1 : 0,
    error_seguimiento: p.errorSeguimiento,
    correlacion: p.correlacion,
  }))
}

function filasCurvas(v: VarianteDatasetOpciones, a: AgenteDatasetOpciones): Fila[] {
  return a.curva.map((p, i) => ({
    corrida: v.descripcionModo,
    agente: a.nombre,
    fecha: p.fecha,
    cartera: p.valor,
    benchmark: a.benchmarkCurva[i]?.valor ?? null,
  }))
}

/* ── Formatos ────────────────────────────────────────────────────────────── */

/** Escapa un valor según RFC 4180. */
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
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), nombre.slice(0, 31))
}

/**
 * Libro de un agente, con sus cuatro corridas en cada hoja.
 *
 * Se agrupa por agente y no por corrida porque la pregunta que responde el
 * estudio es «¿de qué depende este resultado?», y eso se lee comparando las
 * cuatro corridas del mismo agente en la misma tabla.
 */
function libroDelAgente(d: DatasetOpciones, agenteId: string): Buffer {
  const pares = d.variantes
    .map(v => ({ v, a: v.agentes.find(x => x.id === agenteId) }))
    .filter((p): p is { v: VarianteDatasetOpciones; a: AgenteDatasetOpciones } => !!p.a)

  const libro = XLSX.utils.book_new()
  hoja(libro, 'Métricas', pares.map(p => filaMetricas(p.v, p.a)))
  hoja(libro, 'Operaciones', pares.flatMap(p => filasOperaciones(p.v, p.a)))
  hoja(libro, 'Barrido del supuesto', pares.flatMap(p => filasBarrido(p.v, p.a)))
  hoja(libro, 'Calibración', pares.flatMap(p => filasCalibracion(p.v)))
  hoja(libro, 'Curvas', pares.flatMap(p => filasCurvas(p.v, p.a)))
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/* ── Catálogo ────────────────────────────────────────────────────────────── */

/**
 * Los ficheros de opciones que la aplicación sabe entregar.
 *
 * Los nombres llevan el prefijo `opciones-` para que no puedan chocar con los de
 * acciones: los dos catálogos se concatenan y la ruta de API busca por nombre,
 * así que una colisión serviría el fichero equivocado sin avisar.
 */
export function catalogoOpciones(d: DatasetOpciones): EntradaCatalogo[] {
  const entradas: EntradaCatalogo[] = []

  const agentes = new Map<string, string>()
  for (const v of d.variantes) for (const a of v.agentes) agentes.set(a.id, a.nombre)

  for (const [id, nombre] of agentes) {
    entradas.push({
      fichero: `opciones-backtest-${id}.xlsx`,
      formato: 'xlsx',
      etiqueta: `Agente ${nombre} · libro completo`,
      descripcion: 'Métricas, operaciones, barrido del supuesto de volatilidad, calibración contra ^PUT y curvas, de sus cuatro corridas.',
      construir: () => libroDelAgente(d, id),
    })
  }

  for (const v of d.variantes) {
    const n = v.agentes.reduce((s, a) => s + a.operaciones.length, 0)
    entradas.push({
      fichero: `opciones-operaciones-${v.id}.csv`,
      formato: 'csv',
      etiqueta: `Operaciones · ${v.descripcionModo}`,
      descripcion: `${n.toLocaleString('es-ES')} operaciones de Gamma y Theta con strike, vencimiento, primas, delta y volatilidad implícita de entrada.`,
      construir: () => aCsv(v.agentes.flatMap(a => filasOperaciones(v, a))),
    })
  }

  entradas.push({
    fichero: 'opciones-metricas.csv',
    formato: 'csv',
    etiqueta: 'Métricas · las cuatro corridas',
    descripcion: 'Una fila por agente y corrida, con rentabilidad, riesgo, contrastes y el supuesto de volatilidad calibrado.',
    construir: () => aCsv(d.variantes.flatMap(v => v.agentes.map(a => filaMetricas(v, a)))),
  })

  entradas.push({
    fichero: 'opciones-barrido-supuesto.csv',
    formato: 'csv',
    etiqueta: 'Barrido del supuesto de volatilidad',
    descripcion: 'Qué habría salido con cada valor del multiplicador de volatilidad. Es el fichero que enseña de qué depende cada conclusión.',
    construir: () => aCsv(d.variantes.flatMap(v => v.agentes.flatMap(a => filasBarrido(v, a)))),
  })

  entradas.push({
    fichero: 'opciones-calibracion.csv',
    formato: 'csv',
    etiqueta: 'Calibración contra ^PUT',
    descripcion: 'Error de seguimiento y correlación de la réplica sintética frente al índice PutWrite real, para cada valor del supuesto.',
    construir: () => aCsv(d.variantes.flatMap(filasCalibracion)),
  })

  return entradas
}
