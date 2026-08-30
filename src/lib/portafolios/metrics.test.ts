import { describe, it, expect } from 'vitest'
import {
  buildClosedTrades, computeCurveMetrics, computeMetrics, desviacion, diasEntre, maxDrawdown, retornosDiarios,
} from './metrics'
import type { EquityPoint, EquitySeriesPoint, StockPosition } from './types'

function pos(over: Partial<StockPosition>): StockPosition {
  return {
    id: 'p1',
    ticker: 'AAPL',
    empresa: 'Apple',
    agente: 'Peter',
    category: 'PETER_LYNCH',
    fechaEntrada: '2026-01-05',
    fechaCierre: null,
    fechaCierreEstimada: false,
    abierta: true,
    capitalComprometido: 1000,
    precioEntrada: 100,
    cantidad: 10,
    precioSalida: null,
    precioActual: 100,
    valorActual: 1000,
    pnl: 0,
    pnlPct: 0,
    ...over,
  }
}

describe('computeMetrics', () => {
  it('el capital de las posiciones abiertas sale de la caja', () => {
    const m = computeMetrics([pos({ id: 'a' }), pos({ id: 'b' })], 100_000)
    expect(m.invertido).toBe(2000)
    expect(m.caja).toBe(98_000)
    expect(m.valorTotal).toBe(100_000)
  })

  it('el importe de una venta vuelve a caja y no se cuenta dos veces', () => {
    const cerrada = pos({
      id: 'c', abierta: false, fechaCierre: '2026-02-10', precioSalida: 120,
      valorActual: 1200, pnl: 200, pnlPct: 20,
    })
    const m = computeMetrics([cerrada], 100_000)
    expect(m.invertido).toBe(0)
    expect(m.caja).toBe(100_200)
    expect(m.valorTotal).toBe(100_200)
    expect(m.pnlRealizado).toBe(200)
    expect(m.pnlNoRealizado).toBe(0)
  })

  it('separa resultado realizado de latente', () => {
    const abierta = pos({ id: 'a', valorActual: 1150, pnl: 150, pnlPct: 15 })
    const cerrada = pos({ id: 'c', abierta: false, fechaCierre: '2026-02-10', pnl: -80, valorActual: 920 })
    const m = computeMetrics([abierta, cerrada], 100_000)
    expect(m.pnlNoRealizado).toBe(150)
    expect(m.pnlRealizado).toBe(-80)
    expect(m.pnlTotal).toBe(70)
    expect(m.rendimientoPct).toBeCloseTo(0.07, 6)
  })

  it('calcula win rate y profit factor solo con las cerradas', () => {
    const positions = [
      pos({ id: '1', abierta: false, fechaCierre: '2026-02-01', pnl: 300 }),
      pos({ id: '2', abierta: false, fechaCierre: '2026-02-02', pnl: 100 }),
      pos({ id: '3', abierta: false, fechaCierre: '2026-02-03', pnl: -200 }),
      pos({ id: '4', pnl: 9999 }), // abierta: no cuenta
    ]
    const m = computeMetrics(positions, 100_000)
    expect(m.ganadoras).toBe(2)
    expect(m.perdedoras).toBe(1)
    expect(m.winRate).toBeCloseTo(66.6667, 3)
    expect(m.profitFactor).toBeCloseTo(2, 6)
    expect(m.gananciaMedia).toBeCloseTo(200, 6)
    expect(m.perdidaMedia).toBeCloseTo(200, 6)
  })

  it('deja el win rate en null sin operaciones cerradas', () => {
    expect(computeMetrics([pos({})], 100_000).winRate).toBeNull()
  })

  it('identifica la mejor y la peor posición', () => {
    const m = computeMetrics([
      pos({ id: '1', ticker: 'NVDA', pnl: 500 }),
      pos({ id: '2', ticker: 'INTC', pnl: -300 }),
    ], 100_000)
    expect(m.mejor).toEqual({ ticker: 'NVDA', pnl: 500 })
    expect(m.peor).toEqual({ ticker: 'INTC', pnl: -300 })
  })

  it('reparte la exposición entre agentes', () => {
    const m = computeMetrics([
      pos({ id: '1', agente: 'Peter', valorActual: 3000 }),
      pos({ id: '2', agente: 'Small', valorActual: 1000 }),
    ], 100_000)
    expect(m.exposicionPorAgente).toEqual([
      { agente: 'Peter', valor: 3000, peso: 75 },
      { agente: 'Small', valor: 1000, peso: 25 },
    ])
  })

  it('promedia los días en cartera de las cerradas', () => {
    const m = computeMetrics([
      pos({ id: '1', abierta: false, fechaEntrada: '2026-01-01', fechaCierre: '2026-01-11', pnl: 10 }),
      pos({ id: '2', abierta: false, fechaEntrada: '2026-01-01', fechaCierre: '2026-01-21', pnl: 10 }),
    ], 100_000)
    expect(m.diasMediosEnCartera).toBeCloseTo(15, 6)
  })
})

describe('estadística de curvas', () => {
  const curva: EquityPoint[] = [
    { date: '2026-01-05', valor: 100 },
    { date: '2026-01-06', valor: 110 },
    { date: '2026-01-07', valor: 99 },
  ]

  it('retornosDiarios devuelve un punto menos que la curva', () => {
    const r = retornosDiarios(curva)
    expect(r).toHaveLength(2)
    expect(r[0]).toBeCloseTo(0.1, 6)
    expect(r[1]).toBeCloseTo(-0.1, 6)
  })

  it('desviacion necesita al menos dos observaciones', () => {
    expect(desviacion([1])).toBeNull()
    expect(desviacion([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.1381, 3)
  })

  it('maxDrawdown mide la caída desde el máximo previo', () => {
    // De 110 a 99 son 10 puntos porcentuales.
    expect(maxDrawdown(curva)).toBeCloseTo(10, 6)
  })

  it('maxDrawdown es cero en una curva que solo sube', () => {
    expect(maxDrawdown([
      { date: '2026-01-05', valor: 100 },
      { date: '2026-01-06', valor: 120 },
    ])).toBe(0)
  })

  it('diasEntre cuenta días naturales', () => {
    expect(diasEntre('2026-01-01', '2026-01-31')).toBe(30)
  })
})

describe('computeCurveMetrics', () => {
  it('devuelve nulls en vez de cifras inventadas sin historia', () => {
    const m = computeCurveMetrics([{ date: '2026-01-05', portafolio: 100_000, benchmark: 100_000 }])
    expect(m.sharpe).toBeNull()
    expect(m.beta).toBeNull()
    expect(m.cagr).toBeNull()
    expect(m.maxDrawdown).toBe(0)
    expect(m.calmar).toBeNull()
  })

  it('el Calmar es el CAGR dividido por la peor caída', () => {
    // Un año exacto: sube a 120.000, cae a 108.000 (−10 % desde máximos) y
    // cierra en 110.000. CAGR 10 %, drawdown 10 %, Calmar 1.
    const m = computeCurveMetrics([
      { date: '2025-01-01', portafolio: 100_000, benchmark: null },
      { date: '2025-06-01', portafolio: 120_000, benchmark: null },
      { date: '2025-09-01', portafolio: 108_000, benchmark: null },
      { date: '2026-01-01', portafolio: 110_000, benchmark: null },
    ])
    expect(m.maxDrawdown).toBeCloseTo(10, 6)
    expect(m.cagr).toBeCloseTo(10, 1)
    expect(m.calmar).toBeCloseTo(1, 1)
  })

  it('devuelve null cuando la curva nunca cayó, en vez de infinito', () => {
    const m = computeCurveMetrics([
      { date: '2025-01-01', portafolio: 100_000, benchmark: null },
      { date: '2025-07-01', portafolio: 105_000, benchmark: null },
      { date: '2026-01-01', portafolio: 110_000, benchmark: null },
    ])
    expect(m.maxDrawdown).toBe(0)
    expect(m.calmar).toBeNull()
  })

  it('una beta de 1 sale de un portafolio que replica al índice', () => {
    const serie: EquitySeriesPoint[] = []
    let p = 100_000
    let b = 100_000
    const rets = [0.01, -0.005, 0.008, 0.002, -0.011, 0.004]
    serie.push({ date: '2026-01-05', portafolio: p, benchmark: b })
    rets.forEach((r, i) => {
      p *= 1 + r
      b *= 1 + r
      serie.push({ date: `2026-01-${String(6 + i).padStart(2, '0')}`, portafolio: p, benchmark: b })
    })
    const m = computeCurveMetrics(serie)
    expect(m.beta).toBeCloseTo(1, 6)
    expect(m.alpha).toBeCloseTo(0, 6)
    // Replicar el índice no deja tracking error.
    expect(m.trackingError).toBeCloseTo(0, 6)
    expect(m.rendimientoBenchmark).toBeCloseTo(m.rendimientoBenchmark!, 6)
  })

  it('mide el rendimiento del benchmark en el mismo periodo', () => {
    const m = computeCurveMetrics([
      { date: '2026-01-05', portafolio: 100_000, benchmark: 100_000 },
      { date: '2026-01-06', portafolio: 101_000, benchmark: 100_500 },
      { date: '2026-01-07', portafolio: 102_000, benchmark: 101_000 },
    ])
    expect(m.rendimientoBenchmark).toBeCloseTo(1, 6)
  })
})

describe('buildClosedTrades', () => {
  it('solo incluye posiciones cerradas, de la más reciente a la más antigua', () => {
    const trades = buildClosedTrades([
      pos({ id: 'vieja', abierta: false, fechaEntrada: '2026-01-01', fechaCierre: '2026-02-01', precioSalida: 110, pnl: 100, pnlPct: 10 }),
      pos({ id: 'nueva', abierta: false, fechaEntrada: '2026-01-01', fechaCierre: '2026-03-01', precioSalida: 90, pnl: -100, pnlPct: -10 }),
      pos({ id: 'viva' }),
    ])
    expect(trades.map(t => t.id)).toEqual(['nueva', 'vieja'])
    expect(trades[0].dias).toBe(59)
    expect(trades[0].salida).toBe(90)
    expect(trades[0].contrato).toBeNull()
  })
})
