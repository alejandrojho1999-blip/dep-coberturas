import { RISK_FREE, SESIONES_ANUALES } from './config'
import type {
  ClosedTrade,
  CurveMetrics,
  EquityPoint,
  EquitySeriesPoint,
  OptionPosition,
  PortfolioMetrics,
  PortfolioPosition,
  StockPosition,
} from './types'

/**
 * Métricas de rendimiento y riesgo. Todo aquí es una función pura sobre datos
 * ya construidos: nada pide precios ni toca la red.
 */

const DIA_MS = 86_400_000

function esOpcion(p: PortfolioPosition): p is OptionPosition {
  return 'strike' in p
}

/** Días naturales entre dos fechas YYYY-MM-DD. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / DIA_MS)
}

/**
 * Agrega las posiciones en las cifras que resumen el portafolio.
 *
 * La caja recoge lo que no está desplegado más el resultado ya materializado:
 * capital − comprometido en abiertas + P&L realizado. Así el valor total nunca
 * cuenta dos veces el dinero de una posición vendida.
 */
export function computeMetrics(positions: PortfolioPosition[], capital: number): PortfolioMetrics {
  const abiertas = positions.filter(p => p.abierta)
  const cerradas = positions.filter(p => !p.abierta)

  const invertido = abiertas.reduce((s, p) => s + p.capitalComprometido, 0)
  const pnlRealizado = cerradas.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const pnlNoRealizado = abiertas.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const caja = capital - invertido + pnlRealizado
  const valorTotal = caja + invertido + pnlNoRealizado

  const conResultado = cerradas.filter(p => p.pnl != null)
  const ganadoras = conResultado.filter(p => (p.pnl ?? 0) > 0)
  const perdedoras = conResultado.filter(p => (p.pnl ?? 0) < 0)
  const sumaGanancias = ganadoras.reduce((s, p) => s + (p.pnl ?? 0), 0)
  const sumaPerdidas = Math.abs(perdedoras.reduce((s, p) => s + (p.pnl ?? 0), 0))

  const conPnl = positions.filter(p => p.pnl != null)
  const ordenadas = [...conPnl].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))

  const duraciones = cerradas
    .filter(p => p.fechaCierre != null)
    .map(p => diasEntre(p.fechaEntrada, p.fechaCierre!))

  const porAgente = new Map<string, number>()
  for (const p of abiertas) {
    porAgente.set(p.agente, (porAgente.get(p.agente) ?? 0) + (p.valorActual ?? p.capitalComprometido))
  }
  const totalExpuesto = [...porAgente.values()].reduce((s, v) => s + v, 0)

  return {
    capital,
    invertido,
    caja,
    valorTotal,
    pnlRealizado,
    pnlNoRealizado,
    pnlTotal: pnlRealizado + pnlNoRealizado,
    rendimientoPct: capital > 0 ? ((pnlRealizado + pnlNoRealizado) / capital) * 100 : 0,
    posicionesAbiertas: abiertas.length,
    posicionesCerradas: cerradas.length,
    ganadoras: ganadoras.length,
    perdedoras: perdedoras.length,
    winRate: conResultado.length > 0 ? (ganadoras.length / conResultado.length) * 100 : null,
    gananciaMedia: ganadoras.length > 0 ? sumaGanancias / ganadoras.length : null,
    perdidaMedia: perdedoras.length > 0 ? sumaPerdidas / perdedoras.length : null,
    profitFactor: sumaPerdidas > 0 ? sumaGanancias / sumaPerdidas : null,
    mejor: ordenadas.length > 0 ? { ticker: ordenadas[0].ticker, pnl: ordenadas[0].pnl! } : null,
    peor: ordenadas.length > 1 ? { ticker: ordenadas[ordenadas.length - 1].ticker, pnl: ordenadas[ordenadas.length - 1].pnl! } : null,
    diasMediosEnCartera: duraciones.length > 0 ? duraciones.reduce((s, d) => s + d, 0) / duraciones.length : null,
    exposicionPorAgente: [...porAgente.entries()]
      .map(([agente, valor]) => ({ agente, valor, peso: totalExpuesto > 0 ? (valor / totalExpuesto) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor),
  }
}

/** Serie de retornos simples día a día. */
export function retornosDiarios(curva: EquityPoint[]): number[] {
  const out: number[] = []
  for (let i = 1; i < curva.length; i++) {
    const prev = curva[i - 1].valor
    if (prev > 0) out.push(curva[i].valor / prev - 1)
  }
  return out
}

export function media(xs: number[]): number {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

/** Desviación típica muestral. Necesita al menos dos observaciones. */
export function desviacion(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = media(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

/**
 * Máxima caída desde un máximo previo, en porcentaje positivo.
 * Es la cifra que responde a "cuánto se llegó a perder en el peor momento".
 */
export function maxDrawdown(curva: EquityPoint[]): number {
  let pico = -Infinity
  let peor = 0
  for (const p of curva) {
    if (p.valor > pico) pico = p.valor
    if (pico > 0) {
      const caida = (pico - p.valor) / pico
      if (caida > peor) peor = caida
    }
  }
  return peor * 100
}

/** Pendiente y ordenada de una regresión simple de `y` sobre `x`. */
function regresion(x: number[], y: number[]): { beta: number; alpha: number } | null {
  const n = Math.min(x.length, y.length)
  if (n < 2) return null
  const mx = media(x.slice(0, n))
  const my = media(y.slice(0, n))
  let cov = 0
  let varx = 0
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my)
    varx += (x[i] - mx) ** 2
  }
  if (varx === 0) return null
  const beta = cov / varx
  return { beta, alpha: my - beta * mx }
}

/**
 * Métricas que exigen la curva completa: riesgo, ratios y comparación con el
 * benchmark. Devuelve nulls cuando no hay historia suficiente en vez de cifras
 * inventadas — un Sharpe con tres días no significa nada.
 */
export function computeCurveMetrics(serie: EquitySeriesPoint[]): CurveMetrics {
  const curva: EquityPoint[] = serie.map(p => ({ date: p.date, valor: p.portafolio }))
  const rets = retornosDiarios(curva)
  const sigma = desviacion(rets)
  const volAnual = sigma != null ? sigma * Math.sqrt(SESIONES_ANUALES) : null

  const rfDiario = RISK_FREE / SESIONES_ANUALES
  const exceso = rets.map(r => r - rfDiario)
  const sigmaExceso = desviacion(exceso)
  const sharpe = sigmaExceso != null && sigmaExceso > 0
    ? (media(exceso) / sigmaExceso) * Math.sqrt(SESIONES_ANUALES)
    : null

  const bajistas = exceso.filter(r => r < 0)
  const downside = bajistas.length > 1
    ? Math.sqrt(bajistas.reduce((s, r) => s + r ** 2, 0) / bajistas.length)
    : null
  const sortino = downside != null && downside > 0
    ? (media(exceso) / downside) * Math.sqrt(SESIONES_ANUALES)
    : null

  let cagr: number | null = null
  if (curva.length > 1 && curva[0].valor > 0) {
    const anios = diasEntre(curva[0].date, curva[curva.length - 1].date) / 365
    if (anios > 0) cagr = ((curva[curva.length - 1].valor / curva[0].valor) ** (1 / anios) - 1) * 100
  }

  const conBench = serie.filter(p => p.benchmark != null)
  let beta: number | null = null
  let alpha: number | null = null
  let trackingError: number | null = null
  let informationRatio: number | null = null
  let rendimientoBenchmark: number | null = null

  if (conBench.length > 2) {
    const benchCurva: EquityPoint[] = conBench.map(p => ({ date: p.date, valor: p.benchmark! }))
    const portCurva: EquityPoint[] = conBench.map(p => ({ date: p.date, valor: p.portafolio }))
    const rb = retornosDiarios(benchCurva)
    const rp = retornosDiarios(portCurva)
    const reg = regresion(rb, rp)
    if (reg) {
      beta = reg.beta
      // El alfa diario se anualiza para poder leerlo junto al resto.
      alpha = reg.alpha * SESIONES_ANUALES * 100
    }
    const activos = rp.map((r, i) => r - rb[i]).filter(r => Number.isFinite(r))
    const sigmaActivo = desviacion(activos)
    if (sigmaActivo != null) {
      trackingError = sigmaActivo * Math.sqrt(SESIONES_ANUALES) * 100
      if (sigmaActivo > 0) informationRatio = (media(activos) / sigmaActivo) * Math.sqrt(SESIONES_ANUALES)
    }
    const primero = benchCurva[0].valor
    if (primero > 0) rendimientoBenchmark = (benchCurva[benchCurva.length - 1].valor / primero - 1) * 100
  }

  return {
    maxDrawdown: maxDrawdown(curva),
    volatilidadAnualizada: volAnual != null ? volAnual * 100 : null,
    sharpe,
    sortino,
    cagr,
    beta,
    alpha,
    trackingError,
    informationRatio,
    rendimientoBenchmark,
  }
}

/** Libro de operaciones cerradas, de la más reciente a la más antigua. */
export function buildClosedTrades(positions: PortfolioPosition[]): ClosedTrade[] {
  return positions
    .filter(p => !p.abierta && p.fechaCierre != null && p.pnl != null)
    .map(p => {
      const opcion = esOpcion(p)
      const entrada = opcion ? p.primaEntrada : (p as StockPosition).precioEntrada
      const salida = opcion
        ? (p.primaActual ?? 0)
        : ((p as StockPosition).precioSalida ?? (p as StockPosition).precioActual ?? 0)
      return {
        id: p.id,
        ticker: p.ticker,
        agente: p.agente,
        fechaEntrada: p.fechaEntrada,
        fechaCierre: p.fechaCierre!,
        fechaCierreEstimada: p.fechaCierreEstimada,
        entrada,
        salida,
        dias: diasEntre(p.fechaEntrada, p.fechaCierre!),
        pnl: p.pnl!,
        pnlPct: p.pnlPct ?? 0,
        contrato: opcion ? `${p.posicion.replace('_', ' ')} $${p.strike} ${p.expiration}` : null,
      }
    })
    .sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre))
}
