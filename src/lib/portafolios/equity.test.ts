import { describe, it, expect } from 'vitest'
import {
  alignSeries, buildBenchmarkCurve, buildOptionEquityCurve, buildStockEquityCurve, ejeTemporal, primeraEntrada,
} from './equity'
import type { ClosesByTicker, DailyClose, OptionPosition, StockPosition } from './types'

const DIAS = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']

const spy: DailyClose[] = [
  { date: '2026-01-02', close: 500 },
  { date: '2026-01-05', close: 500 },
  { date: '2026-01-06', close: 510 },
  { date: '2026-01-07', close: 505 },
  { date: '2026-01-08', close: 520 },
]

function stock(over: Partial<StockPosition>): StockPosition {
  return {
    id: 'p1', ticker: 'AAPL', empresa: null, agente: 'Peter', category: 'PETER_LYNCH',
    fechaEntrada: '2026-01-05', fechaCierre: null, fechaCierreEstimada: false, abierta: true,
    capitalComprometido: 1000, precioEntrada: 100, cantidad: 10, precioSalida: null,
    precioActual: 100, valorActual: 1000, pnl: 0, pnlPct: 0, ...over,
  }
}

function option(over: Partial<OptionPosition>): OptionPosition {
  return {
    id: 'o1', ticker: 'FSLR', agente: 'Gamma', category: 'OPTIONS_GAMMA',
    fechaEntrada: '2026-01-05', fechaCierre: null, fechaCierreEstimada: false, abierta: true,
    capitalComprometido: 1575, posicion: 'LONG_CALL', strike: 230, expiration: '2026-06-18',
    primaEntrada: 15.75, primaActual: 15.75, contratos: 1, esCorta: false, detalleCapital: '',
    cobertura: null,
    valorActual: 1575, pnl: 0, pnlPct: 0, ...over,
  }
}

describe('ejeTemporal', () => {
  it('toma las sesiones del benchmark desde la primera entrada', () => {
    expect(ejeTemporal(spy, '2026-01-06')).toEqual(['2026-01-06', '2026-01-07', '2026-01-08'])
  })
})

describe('buildStockEquityCurve', () => {
  const closes: ClosesByTicker = {
    AAPL: [
      { date: '2026-01-05', close: 100 },
      { date: '2026-01-06', close: 110 },
      { date: '2026-01-07', close: 105 },
      { date: '2026-01-08', close: 120 },
    ],
  }

  it('arranca en el capital asignado el día de la primera entrada', () => {
    const curva = buildStockEquityCurve([stock({})], closes, 100_000, DIAS)
    expect(curva[0].valor).toBeCloseTo(100_000, 6)
  })

  it('revalora la posición viva con el cierre de cada sesión', () => {
    const curva = buildStockEquityCurve([stock({})], closes, 100_000, DIAS)
    // 99.000 en caja + 10 acciones × 110.
    expect(curva[1].valor).toBeCloseTo(100_100, 6)
    expect(curva[3].valor).toBeCloseTo(100_200, 6)
  })

  it('el dinero de una venta vuelve a caja y deja de moverse con el mercado', () => {
    const cerrada = stock({ abierta: false, fechaCierre: '2026-01-06', precioSalida: 110 })
    const curva = buildStockEquityCurve([cerrada], closes, 100_000, DIAS)
    // El día del cierre ya cuenta como caja: 99.000 + 10 × 110.
    expect(curva[1].valor).toBeCloseTo(100_100, 6)
    // Y a partir de ahí el valor se congela pese a que AAPL sigue subiendo.
    expect(curva[2].valor).toBeCloseTo(100_100, 6)
    expect(curva[3].valor).toBeCloseTo(100_100, 6)
  })

  it('una posición que aún no existe no altera la curva', () => {
    const tardia = stock({ fechaEntrada: '2026-01-07' })
    const curva = buildStockEquityCurve([tardia], closes, 100_000, DIAS)
    expect(curva[0].valor).toBeCloseTo(100_000, 6)
    expect(curva[1].valor).toBeCloseTo(100_000, 6)
    // El día de la entrada: 99.000 + 10 × 105.
    expect(curva[2].valor).toBeCloseTo(100_050, 6)
  })

  it('sin cierre para ese día cae al precio de entrada en vez de romper la curva', () => {
    const curva = buildStockEquityCurve([stock({})], {}, 100_000, DIAS)
    expect(curva.every(p => p.valor === 100_000)).toBe(true)
  })
})

describe('buildOptionEquityCurve', () => {
  it('solo escalona en la fecha de cierre de cada contrato', () => {
    const liquidado = option({ abierta: false, fechaCierre: '2026-01-07', pnl: 1195 })
    const curva = buildOptionEquityCurve([liquidado], 100_000, DIAS)
    expect(curva[0].valor).toBe(100_000)
    expect(curva[1].valor).toBe(100_000)
    expect(curva[2].valor).toBe(101_195)
    expect(curva[3].valor).toBe(101_195)
  })

  it('el último punto incorpora el latente de las posiciones abiertas', () => {
    const curva = buildOptionEquityCurve([option({ pnl: 425 })], 100_000, DIAS)
    expect(curva[0].valor).toBe(100_000)
    expect(curva[2].valor).toBe(100_000)
    expect(curva[3].valor).toBe(100_425)
  })

  it('acumula varios contratos liquidados', () => {
    const curva = buildOptionEquityCurve([
      option({ id: 'a', abierta: false, fechaCierre: '2026-01-06', pnl: 500 }),
      option({ id: 'b', abierta: false, fechaCierre: '2026-01-08', pnl: -300 }),
    ], 100_000, DIAS)
    expect(curva[1].valor).toBe(100_500)
    expect(curva[3].valor).toBe(100_200)
  })

  it('devuelve una curva vacía sin eje temporal', () => {
    expect(buildOptionEquityCurve([option({})], 100_000, [])).toEqual([])
  })
})

describe('buildBenchmarkCurve', () => {
  it('normaliza el índice al capital del portafolio', () => {
    const curva = buildBenchmarkCurve(spy, 100_000, DIAS)
    expect(curva[0].valor).toBeCloseTo(100_000, 6)
    // SPY sube de 500 a 520: un 4 %.
    expect(curva[3].valor).toBeCloseTo(104_000, 6)
  })

  it('ignora las sesiones fuera del eje', () => {
    const curva = buildBenchmarkCurve(spy, 100_000, DIAS)
    expect(curva.map(p => p.date)).toEqual(DIAS)
  })
})

describe('alignSeries', () => {
  it('casa las dos curvas por fecha y deja null donde falta el índice', () => {
    const serie = alignSeries(
      [{ date: '2026-01-05', valor: 100_000 }, { date: '2026-01-06', valor: 100_100 }],
      [{ date: '2026-01-05', valor: 100_000 }],
    )
    expect(serie[0].benchmark).toBe(100_000)
    expect(serie[1].benchmark).toBeNull()
  })
})

describe('primeraEntrada', () => {
  it('devuelve la fecha más antigua', () => {
    expect(primeraEntrada(['2026-03-01', '2026-01-05', '2026-02-01'])).toBe('2026-01-05')
  })

  it('devuelve null sin posiciones', () => {
    expect(primeraEntrada([])).toBeNull()
  })
})
