import { describe, it, expect } from 'vitest'
import {
  evaluarCriterios, contarScore, calcDebtToMarketCap, crecimientoAnual,
  LARGE_CAP_OPTIONS, SMALL_CAP_OPTIONS,
} from '@/lib/peter-lynch/screener'

describe('crecimientoAnual', () => {
  // `fundamentalsTimeSeries` devuelve los ejercicios de más antiguo a más
  // reciente, al revés que el difunto `incomeStatementHistory`.
  it('compara el último ejercicio con el anterior, no al revés', () => {
    expect(crecimientoAnual([100, 150])).toBeCloseTo(0.5, 9)
  })

  it('detecta una caída de beneficio', () => {
    // Caso JPM: el fallback antiguo daba +46,9 % (crecimiento TTM trimestral)
    // cuando el beneficio anual en realidad bajó.
    expect(crecimientoAnual([58471, 57048])).toBeCloseTo(-0.0243, 4)
  })

  it('usa solo los dos últimos ejercicios de una serie larga', () => {
    expect(crecimientoAnual([10, 20, 40, 100, 150])).toBeCloseTo(0.5, 9)
  })

  it('normaliza con el valor absoluto para salir de pérdidas', () => {
    expect(crecimientoAnual([-100, 50])).toBeCloseTo(1.5, 9)
  })

  it('devuelve null con menos de dos ejercicios', () => {
    expect(crecimientoAnual([])).toBeNull()
    expect(crecimientoAnual([100])).toBeNull()
  })

  it('devuelve null si el ejercicio previo fue cero', () => {
    expect(crecimientoAnual([0, 100])).toBeNull()
  })
})

describe('calcDebtToMarketCap', () => {
  it('descuenta la caja de la deuda bruta', () => {
    expect(calcDebtToMarketCap(2000, 500, 10_000)).toBeCloseTo(0.15, 9)
  })

  it('acota a cero cuando la caja supera la deuda', () => {
    expect(calcDebtToMarketCap(500, 2000, 10_000)).toBe(0)
  })

  it('devuelve null sin deuda reportada o sin capitalización', () => {
    expect(calcDebtToMarketCap(null, 500, 10_000)).toBeNull()
    expect(calcDebtToMarketCap(2000, 500, null)).toBeNull()
    expect(calcDebtToMarketCap(2000, 500, 0)).toBeNull()
  })
})

describe('evaluarCriterios', () => {
  const cumpleTodo = {
    trailingPE: 10, forwardPE: 8, debtToEquity: 0.1,
    earningsGrowth: 0.5, pegRatio: 1, marketCap: 10_000_000_000,
  }

  it('puntúa 6 sobre 6 con los umbrales de Peter', () => {
    expect(contarScore(evaluarCriterios(cumpleTodo, LARGE_CAP_OPTIONS))).toBe(6)
  })

  it('un PER negativo (empresa en pérdidas) no cumple el criterio', () => {
    const c = evaluarCriterios({ ...cumpleTodo, trailingPE: -5 }, LARGE_CAP_OPTIONS)
    expect(c.pe_historico).toBe(false)
  })

  it('un dato ausente nunca cuenta como cumplido', () => {
    const c = evaluarCriterios({ ...cumpleTodo, pegRatio: null }, LARGE_CAP_OPTIONS)
    expect(c.peg).toBe(false)
  })

  it('el crecimiento debe superar estrictamente el umbral', () => {
    expect(evaluarCriterios({ ...cumpleTodo, earningsGrowth: 0.15 }, LARGE_CAP_OPTIONS).crecimiento_eps).toBe(false)
    expect(evaluarCriterios({ ...cumpleTodo, earningsGrowth: 0.151 }, LARGE_CAP_OPTIONS).crecimiento_eps).toBe(true)
  })

  it('Small acota el tamaño por arriba y Peter no', () => {
    const gigante = { ...cumpleTodo, marketCap: 3_000_000_000_000 }
    expect(evaluarCriterios(gigante, LARGE_CAP_OPTIONS).market_cap).toBe(true)
    expect(evaluarCriterios(gigante, SMALL_CAP_OPTIONS).market_cap).toBe(false)
  })

  it('Small es más exigente con el PEG y más laxo con la deuda', () => {
    const conPeg18 = { ...cumpleTodo, pegRatio: 1.8, marketCap: 1_000_000_000 }
    expect(evaluarCriterios(conPeg18, LARGE_CAP_OPTIONS).peg).toBe(true)
    expect(evaluarCriterios(conPeg18, SMALL_CAP_OPTIONS).peg).toBe(false)

    const conDeuda04 = { ...cumpleTodo, debtToEquity: 0.4, marketCap: 1_000_000_000 }
    expect(evaluarCriterios(conDeuda04, LARGE_CAP_OPTIONS).deuda_capital).toBe(false)
    expect(evaluarCriterios(conDeuda04, SMALL_CAP_OPTIONS).deuda_capital).toBe(true)
  })
})
