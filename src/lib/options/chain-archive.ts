/**
 * Archivo diario de cadenas de opciones.
 *
 * El backtest de Gamma y Theta tuvo que reconstruir las primas con
 * Black-Scholes: no existe histórico gratuito de cadenas. Eso obligó a modelar
 * la volatilidad implícita, y ese supuesto es precisamente la capa que decide si
 * los agentes ganan, así que el estudio no puede responder si la selección de
 * volatilidad aporta algo.
 *
 * Grabar la cadena cada día es la salida de ese callejón. No sirve de nada hoy;
 * en doce o dieciocho meses habrá un histórico real, sin proxies ni sesgo de
 * reconstrucción, y por eso conviene empezar cuanto antes.
 *
 * Este módulo es puro: convierte cadenas en filas y filas en cadenas. Quién las
 * descarga y dónde se guardan es cosa de `chain-archive-run.ts`.
 */
import type { EnrichedOptionContract } from './yahoo-options'

/* ── Formato de almacenamiento ───────────────────────────────────────────── */

/**
 * Orden de los campos de cada contrato en el array guardado.
 *
 * **Este orden no se puede cambiar.** Las filas ya archivadas son tuplas
 * posicionales sin nombres de campo, así que reordenar o insertar un campo
 * reinterpretaría en silencio todo lo grabado hasta la fecha. Si hiciera falta
 * añadir algo, va al final y las filas antiguas se leen con el campo ausente.
 *
 * Se guardan tuplas y no objetos porque el nombre de cada campo se repetía en
 * cada contrato: el cambio reduce el tamaño un 94 % (647 kB → 40 kB en SPY).
 */
export const CAMPOS_CONTRATO = [
  'tipo', 'strike', 'vencimiento', 'bid', 'ask', 'iv', 'delta', 'openInterest', 'volume',
] as const

/** Una fila del array `contratos`. */
export type ContratoArchivado = [
  tipo: 'C' | 'P',
  strike: number,
  vencimiento: string,
  bid: number | null,
  ask: number | null,
  iv: number | null,
  delta: number | null,
  openInterest: number | null,
  volume: number | null,
]

/* ── Filtro ──────────────────────────────────────────────────────────────── */

/**
 * Qué contratos se archivan.
 *
 * Sin filtrar, los 40 subyacentes ocuparían ~235 MB al mes y agotarían el plan
 * de Supabase en dos meses. Los límites son deliberadamente más anchos que los
 * que usan los agentes hoy —Gamma pide DTE 21-90 y |Δ| 0,30-0,65; Theta, DTE
 * 21-45 y |Δ| 0,15-0,35— para que un estudio futuro pueda mover los umbrales sin
 * descubrir que el dato que necesita nunca se guardó.
 *
 * Lo que queda fuera son contratos muy dentro o muy fuera del dinero, que
 * apenas se negocian y cuyo precio es casi todo intrínseco o casi nada.
 */
export const FILTRO_ARCHIVO = {
  dteMin: 7,
  dteMax: 120,
  deltaMin: 0.05,
  deltaMax: 0.80,
} as const

export type FiltroArchivo = typeof FILTRO_ARCHIVO

export function contratoArchivable(c: EnrichedOptionContract, f: FiltroArchivo = FILTRO_ARCHIVO): boolean {
  if (!Number.isFinite(c.strike) || c.strike <= 0) return false
  if (c.dte < f.dteMin || c.dte > f.dteMax) return false

  // Sin delta no se puede situar el contrato en la superficie, y es justo lo que
  // un estudio de volatilidad necesita. Se descarta en vez de archivar un hueco.
  if (c.delta == null || !Number.isFinite(c.delta)) return false
  const ad = Math.abs(c.delta)
  if (ad < f.deltaMin || ad > f.deltaMax) return false

  // Un contrato sin ninguna cotización no aporta nada: el archivo sería una fila
  // de nulos que después habría que descartar igualmente.
  return c.bid != null || c.ask != null || c.lastPrice != null
}

/* ── Conversión ──────────────────────────────────────────────────────────── */

/** Redondea a los decimales que la fuente ofrece de verdad. */
const r = (x: number | null | undefined, d: number): number | null => {
  if (x == null || !Number.isFinite(x)) return null
  const f = 10 ** d
  return Math.round(x * f) / f
}

export function aContratoArchivado(c: EnrichedOptionContract): ContratoArchivado {
  return [
    c.type === 'call' ? 'C' : 'P',
    r(c.strike, 4) as number,
    c.expiration,
    r(c.bid, 4),
    r(c.ask, 4),
    r(c.impliedVolatility, 6),
    r(c.delta, 6),
    c.openInterest ?? null,
    c.volume ?? null,
  ]
}

/** Vuelve a un objeto con nombres, para quien lea el archivo. */
export function desdeContratoArchivado(t: ContratoArchivado) {
  const [tipo, strike, vencimiento, bid, ask, iv, delta, openInterest, volume] = t
  return {
    tipo: tipo === 'C' ? ('call' as const) : ('put' as const),
    strike, vencimiento, bid, ask, iv, delta, openInterest, volume,
  }
}

/* ── Snapshot ────────────────────────────────────────────────────────────── */

export interface SnapshotCadena {
  fecha: string
  ticker: string
  spot: number
  contratos: ContratoArchivado[]
  n_contratos: number
  filtro: FiltroArchivo
}

/**
 * Prepara la fila que se guarda para un ticker.
 *
 * Devuelve `null` cuando no queda ningún contrato tras el filtro o cuando falta
 * el precio del subyacente: archivar una fila vacía haría creer que ese día se
 * capturó algo, y al reconstruir el histórico un hueco silencioso es peor que
 * una ausencia declarada.
 */
export function prepararSnapshot(args: {
  fecha: string
  ticker: string
  spot: number
  contratos: EnrichedOptionContract[]
  filtro?: FiltroArchivo
}): SnapshotCadena | null {
  const filtro = args.filtro ?? FILTRO_ARCHIVO
  if (!Number.isFinite(args.spot) || args.spot <= 0) return null

  const contratos = args.contratos
    .filter(c => contratoArchivable(c, filtro))
    .map(aContratoArchivado)

  if (!contratos.length) return null

  return {
    fecha: args.fecha,
    ticker: args.ticker,
    spot: r(args.spot, 4) as number,
    contratos,
    n_contratos: contratos.length,
    filtro,
  }
}

/** Tamaño aproximado de un snapshot, para poder vigilar el crecimiento. */
export function bytesAproximados(s: SnapshotCadena): number {
  return Buffer.byteLength(JSON.stringify(s.contratos))
}
