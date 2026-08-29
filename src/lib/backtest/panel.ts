/**
 * Fase 2 — Panel point-in-time.
 *
 * Para cada (ticker, fecha de rebalanceo) reconstruye el vector de features
 * del screener usando **solo información ya publicada** en esa fecha. Es la
 * pieza que evita el look-ahead: `fundamentalsTimeSeries` devuelve el cierre
 * del ejercicio fiscal, no la fecha de presentación del informe, así que se
 * aplica un retardo conservador (`REPORTING_LAG_DIAS_ANUAL`).
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { calcDebtToMarketCap, crecimientoAnual } from '@/lib/peter-lynch/screener'
import { FUNDAMENTALS_DIR, PRICES_DIR, REPORTING_LAG_DIAS_ANUAL } from '@/lib/backtest/config'
import type {
  FundamentalesTicker, Panel, PanelRow, PriceRow, PriceSeries,
  ReporteFundamental, Universo,
} from '@/lib/backtest/types'

const MS_DIA = 24 * 60 * 60 * 1000

export function sumarDias(fecha: string, dias: number): string {
  return new Date(new Date(`${fecha}T00:00:00Z`).getTime() + dias * MS_DIA)
    .toISOString().slice(0, 10)
}

// ── Carga de los ficheros en caché ──────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizarReporte(raw: any): ReporteFundamental | null {
  const asOfDate = raw?.date ? new Date(raw.date).toISOString().slice(0, 10) : null
  if (!asOfDate) return null
  return {
    asOfDate,
    netIncome: num(raw.netIncome) ?? num(raw.netIncomeCommonStockholders),
    dilutedEPS: num(raw.dilutedEPS) ?? num(raw.basicEPS),
    totalDebt: num(raw.totalDebt),
    cash: num(raw.cashAndCashEquivalents),
    shares: num(raw.ordinarySharesNumber) ?? num(raw.shareIssued) ?? num(raw.dilutedAverageShares),
    stockholdersEquity: num(raw.stockholdersEquity),
    totalRevenue: num(raw.totalRevenue),
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function cargarFundamentales(ticker: string): Promise<FundamentalesTicker | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(FUNDAMENTALS_DIR, `${ticker}.json`), 'utf8'))
    const orden = (a: ReporteFundamental, b: ReporteFundamental) => a.asOfDate.localeCompare(b.asOfDate)
    return {
      ticker,
      annual: (raw.annual ?? []).map(normalizarReporte).filter(Boolean).sort(orden) as ReporteFundamental[],
      quarterly: (raw.quarterly ?? []).map(normalizarReporte).filter(Boolean).sort(orden) as ReporteFundamental[],
    }
  } catch {
    return null
  }
}

export async function cargarPrecios(ticker: string): Promise<PriceSeries | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(PRICES_DIR, `${ticker}.json`), 'utf8'))
    return { ticker, rows: raw.rows ?? [], splits: raw.splits ?? [] }
  } catch {
    return null
  }
}

export async function tickersDescargados(): Promise<string[]> {
  const files = await readdir(PRICES_DIR)
  return files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
}

// ── Utilidades de series ────────────────────────────────────────────────────

/**
 * Última fila con `date <= fecha`. Búsqueda binaria: se llama una vez por
 * (ticker × fecha de rebalanceo).
 */
export function filaEn(rows: PriceRow[], fecha: string): PriceRow | null {
  let lo = 0, hi = rows.length - 1, res: PriceRow | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].date <= fecha) { res = rows[mid]; lo = mid + 1 } else { hi = mid - 1 }
  }
  return res
}

export function indiceEn(rows: PriceRow[], fecha: string): number {
  let lo = 0, hi = rows.length - 1, res = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].date <= fecha) { res = mid; lo = mid + 1 } else { hi = mid - 1 }
  }
  return res
}

/**
 * Factor acumulado de los splits posteriores a `desde`.
 *
 * Los precios de Yahoo vienen ajustados retroactivamente, pero el nº de
 * acciones y el BPA del informe están en la base de aquel momento. Multiplicar
 * las acciones (y dividir el BPA) por este factor las lleva a la misma base
 * que los precios.
 */
export function factorSplitDesde(splits: PriceSeries['splits'], desde: string): number {
  return splits.reduce((acc, s) => (s.date > desde ? acc * s.factor : acc), 1)
}

// ── Construcción del panel ──────────────────────────────────────────────────

/** Último ejercicio anual ya público en `fecha`, y el inmediatamente anterior. */
export function reportesVigentes(
  annual: ReporteFundamental[],
  fecha: string,
  lagDias = REPORTING_LAG_DIAS_ANUAL,
): { actual: ReporteFundamental; previo: ReporteFundamental | null; publicoDesde: string } | null {
  let idx = -1
  for (let i = 0; i < annual.length; i++) {
    if (sumarDias(annual[i].asOfDate, lagDias) <= fecha) idx = i
    else break
  }
  if (idx < 0) return null
  return {
    actual: annual[idx],
    previo: idx > 0 ? annual[idx - 1] : null,
    publicoDesde: sumarDias(annual[idx].asOfDate, lagDias),
  }
}

/**
 * Features de un ticker en una fecha. `null` si no hay precio o no hay ningún
 * ejercicio publicado todavía.
 */
export function construirFila(
  ticker: string,
  fecha: string,
  precios: PriceSeries,
  fundamentales: FundamentalesTicker,
  lagDias = REPORTING_LAG_DIAS_ANUAL,
): PanelRow | null {
  const fila = filaEn(precios.rows, fecha)
  if (!fila) return null

  const vig = reportesVigentes(fundamentales.annual, fecha, lagDias)
  if (!vig) return null

  const { actual, previo, publicoDesde } = vig
  const factor = factorSplitDesde(precios.splits, actual.asOfDate)

  // Acciones y BPA reexpresados a la base de precios actual.
  const shares = actual.shares != null ? actual.shares * factor : null
  const eps = actual.dilutedEPS != null ? actual.dilutedEPS / factor : null

  const marketCap = shares != null ? fila.close * shares : null
  const trailingPE = eps != null && eps > 0 ? fila.close / eps : null

  // Misma función que usa el screener en vivo: no pueden divergir.
  const earningsGrowth = actual.netIncome != null && previo?.netIncome != null
    ? crecimientoAnual([previo.netIncome, actual.netIncome])
    : null

  // Proxy de forwardPE: sin histórico de consenso, se asume que el mercado
  // extrapola el crecimiento ya publicado. Nunca se usa el BPA futuro
  // realizado, que sería look-ahead.
  const g = earningsGrowth
  const forwardPE =
    trailingPE != null && g != null && 1 + g > 0 ? trailingPE / (1 + g) : null

  // Proxy de PEG con el mismo crecimiento histórico.
  const pegRatio =
    trailingPE != null && g != null && g > 0 ? trailingPE / (g * 100) : null

  return {
    ticker,
    fecha,
    close: fila.close,
    adjClose: fila.adjClose,
    reporteAsOf: actual.asOfDate,
    reportePublicoDesde: publicoDesde,
    trailingPE,
    forwardPE,
    debtToEquity: calcDebtToMarketCap(actual.totalDebt, actual.cash, marketCap),
    earningsGrowth,
    pegRatio,
    marketCap,
  }
}

/** Últimas sesiones de cada mes presentes en la serie del benchmark. */
export function fechasRebalanceoMensual(benchmark: PriceRow[], desde: string, hasta: string): string[] {
  const porMes = new Map<string, string>()
  for (const r of benchmark) {
    if (r.date < desde || r.date > hasta) continue
    porMes.set(r.date.slice(0, 7), r.date)  // gana la última del mes
  }
  return [...porMes.values()].sort()
}

export interface ConstruirPanelOpts {
  universo: Universo
  tickers: string[]
  fechas: string[]
  series: Map<string, PriceSeries>
  fundamentales: Map<string, FundamentalesTicker>
  /** Retardo de publicación. Ponerlo a 0 introduce look-ahead a propósito. */
  lagDias?: number
}

export function construirPanel(
  { universo, tickers, fechas, series, fundamentales, lagDias = REPORTING_LAG_DIAS_ANUAL }: ConstruirPanelOpts,
): Panel {
  const porFecha = new Map<string, PanelRow[]>(fechas.map(f => [f, []]))

  for (const ticker of tickers) {
    const precios = series.get(ticker)
    const fund = fundamentales.get(ticker)
    if (!precios?.rows.length || !fund?.annual.length) continue

    for (const fecha of fechas) {
      const fila = construirFila(ticker, fecha, precios, fund, lagDias)
      if (fila) porFecha.get(fecha)!.push(fila)
    }
  }

  return { universo, fechas, porFecha }
}

/**
 * Carga precios y fundamentales de todos los tickers en memoria.
 *
 * Recorta las series a partir de `desdeTrim`: guardar 20 años de cotizaciones
 * de 700 valores no cabe holgadamente en memoria y el backtest solo mira unos
 * meses hacia atrás desde la primera fecha de rebalanceo.
 */
export async function cargarTodo(
  tickers: string[],
  desdeTrim: string,
): Promise<{ series: Map<string, PriceSeries>; fundamentales: Map<string, FundamentalesTicker> }> {
  const series = new Map<string, PriceSeries>()
  const fundamentales = new Map<string, FundamentalesTicker>()

  for (const ticker of tickers) {
    const [p, f] = await Promise.all([cargarPrecios(ticker), cargarFundamentales(ticker)])
    if (p?.rows.length) {
      series.set(ticker, { ...p, rows: p.rows.filter(r => r.date >= desdeTrim) })
    }
    if (f?.annual.length) fundamentales.set(ticker, f)
  }

  return { series, fundamentales }
}
