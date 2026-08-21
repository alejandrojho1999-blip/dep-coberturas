import type {
  ClosesByTicker,
  DailyClose,
  EquityPoint,
  EquitySeriesPoint,
  OptionPosition,
  StockPosition,
} from './types'

/**
 * Reconstrucción de la curva de equity de los dos portafolios.
 *
 * Todo es puro: las series diarias llegan ya descargadas. La curva no se guarda
 * en ninguna tabla — se recalcula en cada carga a partir de las posiciones y de
 * los cierres históricos, así que corregir un dato corrige también el pasado.
 */

/** Último cierre disponible en o antes de `date`. */
function closeAsOf(serie: DailyClose[], date: string): number | null {
  let valor: number | null = null
  for (const c of serie) {
    if (c.date > date) break
    valor = c.close
  }
  return valor
}

/**
 * Eje temporal común: los días de mercado del benchmark desde la primera
 * entrada. Se usa SPY como calendario porque cotiza todas las sesiones, cosa
 * que no garantiza ningún ticker suelto de la cartera.
 */
export function ejeTemporal(benchmark: DailyClose[], desde: string): string[] {
  return benchmark.filter(c => c.date >= desde).map(c => c.date)
}

/**
 * Curva del portafolio de acciones, valorada día a día.
 *
 * Cada día vale la caja de ese momento más el precio de mercado de lo que
 * seguía en cartera. La caja arranca en el capital asignado, se reduce con
 * cada ticket desplegado y se recupera con el importe de cada venta, así que
 * el dinero de una posición cerrada nunca se cuenta dos veces.
 */
export function buildStockEquityCurve(
  positions: StockPosition[],
  closes: ClosesByTicker,
  capital: number,
  eje: string[]
): EquityPoint[] {
  return eje.map(date => {
    let caja = capital
    let mercado = 0

    for (const p of positions) {
      if (p.fechaEntrada > date) continue
      caja -= p.capitalComprometido

      const cerradaYa = p.fechaCierre != null && p.fechaCierre <= date
      if (cerradaYa) {
        const salida = p.precioSalida ?? p.precioActual
        caja += salida != null ? p.cantidad * salida : p.capitalComprometido
        continue
      }

      const precio = closeAsOf(closes[p.ticker] ?? [], date) ?? p.precioEntrada
      mercado += p.cantidad * precio
    }

    return { date, valor: caja + mercado }
  })
}

/**
 * Curva del portafolio de opciones.
 *
 * Es escalonada por necesidad: Yahoo no publica histórico de primas, así que
 * entre cierres no hay ningún precio real con el que mover la línea. Cada
 * escalón es un contrato liquidado con su resultado verificable, y el último
 * punto añade el valor de mercado de hoy de las posiciones vivas.
 */
export function buildOptionEquityCurve(
  positions: OptionPosition[],
  capital: number,
  eje: string[]
): EquityPoint[] {
  if (eje.length === 0) return []

  const ultimo = eje[eje.length - 1]
  const noRealizado = positions
    .filter(p => p.abierta)
    .reduce((s, p) => s + (p.pnl ?? 0), 0)

  return eje.map(date => {
    const realizado = positions
      .filter(p => !p.abierta && p.fechaCierre != null && p.fechaCierre <= date)
      .reduce((s, p) => s + (p.pnl ?? 0), 0)
    const vivo = date === ultimo ? noRealizado : 0
    return { date, valor: capital + realizado + vivo }
  })
}

/**
 * Benchmark normalizado al mismo capital que el portafolio, para que las dos
 * líneas arranquen del mismo punto y la comparación sea legible.
 */
export function buildBenchmarkCurve(
  benchmark: DailyClose[],
  capital: number,
  eje: string[]
): EquityPoint[] {
  const dentro = benchmark.filter(c => eje.includes(c.date))
  if (dentro.length === 0) return []
  const base = dentro[0].close
  if (base <= 0) return []
  return dentro.map(c => ({ date: c.date, valor: (c.close / base) * capital }))
}

/** Casa la curva del portafolio con la del benchmark por fecha. */
export function alignSeries(portafolio: EquityPoint[], benchmark: EquityPoint[]): EquitySeriesPoint[] {
  const porFecha = new Map(benchmark.map(p => [p.date, p.valor]))
  return portafolio.map(p => ({
    date: p.date,
    portafolio: p.valor,
    benchmark: porFecha.get(p.date) ?? null,
  }))
}

/** Fecha de entrada más antigua de un conjunto de posiciones. */
export function primeraEntrada(fechas: string[]): string | null {
  if (fechas.length === 0) return null
  return fechas.reduce((min, f) => (f < min ? f : min))
}
