import { describe, it, expect } from 'vitest'
import type { AgentRec } from '@/lib/agentes/types'
import { contractKey } from '@/lib/options/occ-symbol'
import { TICKET_ACCIONES } from './config'
import { buildOptionPositions, buildStockPositions, capitalComprometidoOpcion } from './positions'

function rec(over: Partial<AgentRec>): AgentRec {
  return {
    id: over.id ?? 'id-1',
    user_id: 'u',
    ticker: 'AAPL',
    empresa: 'Apple',
    category: 'PETER_LYNCH',
    precio_entrada: 100,
    precio_objetivo: null,
    stop_loss: null,
    precio_venta: null,
    cantidad_acciones: null,
    direction: 'COMPRA',
    riesgo: 'MEDIO',
    timeframe: '6m',
    resumen: null,
    score: 5,
    market_cap_m: null,
    estado: 'Comprar',
    created_at: '2026-01-05T14:30:00.000Z',
    ai_report: { objetivo_fuente: 'consenso' },
    ...over,
  }
}

describe('buildStockPositions', () => {
  it('invierte el ticket fijo por recomendación, en cantidad fraccional', () => {
    const { positions } = buildStockPositions([rec({ precio_entrada: 80 })], { AAPL: 80 })
    expect(positions).toHaveLength(1)
    expect(positions[0].capitalComprometido).toBe(TICKET_ACCIONES)
    expect(positions[0].cantidad).toBeCloseTo(12.5, 6)
  })

  it('valora la posición abierta contra el precio de mercado', () => {
    const { positions } = buildStockPositions([rec({ precio_entrada: 100 })], { AAPL: 110 })
    expect(positions[0].valorActual).toBeCloseTo(1100, 6)
    expect(positions[0].pnl).toBeCloseTo(100, 6)
    expect(positions[0].pnlPct).toBeCloseTo(10, 6)
  })

  it('congela la posición cerrada en su precio de venta, no en el de mercado', () => {
    const { positions } = buildStockPositions(
      [rec({ precio_entrada: 100, precio_venta: 90, estado: 'Vender', closed_at: '2026-03-02T20:00:00.000Z' })],
      { AAPL: 130 },
    )
    expect(positions[0].abierta).toBe(false)
    expect(positions[0].pnl).toBeCloseTo(-100, 6)
    expect(positions[0].fechaCierre).toBe('2026-03-02')
    expect(positions[0].fechaCierreEstimada).toBe(false)
  })

  it('cierra también por precio de venta aunque el estado siga en Comprar', () => {
    const { positions } = buildStockPositions([rec({ precio_venta: 105 })], { AAPL: 130 })
    expect(positions[0].abierta).toBe(false)
    expect(positions[0].pnl).toBeCloseTo(50, 6)
  })

  it('excluye las filas de Peter con precio de entrada fabricado', () => {
    // Huella del bug: objetivo == entrada × 1.15 y sin `objetivo_fuente`.
    const corrupta = rec({
      id: 'mala', ticker: 'APA', precio_entrada: 42.17, precio_objetivo: 42.17 * 1.15, ai_report: {},
    })
    const { positions, excluidas } = buildStockPositions([corrupta, rec({ id: 'buena' })], { AAPL: 100, APA: 44 })
    expect(positions.map(p => p.id)).toEqual(['buena'])
    expect(excluidas).toEqual([{ ticker: 'APA', motivo: 'precio de entrada no fiable' }])
  })

  it('excluye las filas sin precio de entrada utilizable', () => {
    const { positions, excluidas } = buildStockPositions([rec({ precio_entrada: 0 })], {})
    expect(positions).toHaveLength(0)
    expect(excluidas[0].motivo).toBe('sin precio de entrada')
  })

  it('ignora las recomendaciones de opciones', () => {
    const { positions } = buildStockPositions([rec({ category: 'OPTIONS_GAMMA' })], { AAPL: 100 })
    expect(positions).toHaveLength(0)
  })

  it('deja el valor en null cuando falta el precio de mercado', () => {
    const { positions } = buildStockPositions([rec({})], {})
    expect(positions[0].valorActual).toBeNull()
    expect(positions[0].pnl).toBeNull()
  })
})

describe('capitalComprometidoOpcion', () => {
  it('un largo solo compromete la prima que pagó', () => {
    expect(capitalComprometidoOpcion('LONG_CALL', 230, 5.5, 220, 1).capital).toBeCloseTo(550, 6)
  })

  it('un put vendido compromete el efectivo que respalda el strike', () => {
    // La prima cobrada no es capital inmovilizado: el colateral sí lo es.
    expect(capitalComprometidoOpcion('SHORT_PUT', 150, 3, 155, 1).capital).toBeCloseTo(15_000, 6)
  })

  it('una call cubierta compromete el valor de las acciones que la respaldan', () => {
    expect(capitalComprometidoOpcion('COVERED_CALL', 100, 2, 95, 1).capital).toBeCloseTo(9_500, 6)
  })

  it('cae al strike si no hay precio del subyacente en la call cubierta', () => {
    expect(capitalComprometidoOpcion('COVERED_CALL', 100, 2, null, 1).capital).toBeCloseTo(10_000, 6)
  })
})

describe('buildOptionPositions', () => {
  const gamma = rec({
    id: 'g1',
    ticker: 'FSLR',
    category: 'OPTIONS_GAMMA',
    precio_entrada: 15.75,
    ai_report: { strike: 230, expiration: '2026-06-18', optionType: 'CALL', underlying: 225 },
  })

  const theta = rec({
    id: 't1',
    ticker: 'MSFT',
    category: 'OPTIONS_THETA',
    precio_entrada: 4,
    ai_report: { strike: 400, expiration: '2026-07-17', strategy: 'SELL_PUT' },
  })

  it('valora una compra de Gamma contra la prima que cotiza ahora', () => {
    const key = contractKey({ ticker: 'FSLR', expiration: '2026-06-18', strike: 230, type: 'CALL' })
    const { positions } = buildOptionPositions([gamma], { [key]: 20 })
    const p = positions[0]
    expect(p.posicion).toBe('LONG_CALL')
    expect(p.esCorta).toBe(false)
    // Gana lo que sube la prima: (20 − 15.75) × 100.
    expect(p.pnl).toBeCloseTo(425, 6)
    expect(p.capitalComprometido).toBeCloseTo(1575, 6)
  })

  it('invierte el signo en una venta de Theta', () => {
    const key = contractKey({ ticker: 'MSFT', expiration: '2026-07-17', strike: 400, type: 'PUT' })
    const { positions } = buildOptionPositions([theta], { [key]: 1.5 })
    const p = positions[0]
    expect(p.posicion).toBe('SHORT_PUT')
    expect(p.esCorta).toBe(true)
    // Cobró 4 y ahora vale 1.5: gana la diferencia.
    expect(p.pnl).toBeCloseTo(250, 6)
    // El peso en cartera es el colateral, no la prima.
    expect(p.capitalComprometido).toBeCloseTo(40_000, 6)
  })

  it('usa el vencimiento como fecha de cierre cuando falta closed_at', () => {
    const { positions } = buildOptionPositions([{ ...gamma, estado: 'Vender', precio_venta: 27.7 }], {})
    expect(positions[0].abierta).toBe(false)
    expect(positions[0].fechaCierre).toBe('2026-06-18')
    expect(positions[0].fechaCierreEstimada).toBe(true)
  })

  it('prefiere closed_at al vencimiento cuando existe', () => {
    const cerrada = { ...gamma, estado: 'Vender', precio_venta: 27.7, closed_at: '2026-06-18T21:00:00.000Z' }
    const { positions } = buildOptionPositions([cerrada], {})
    expect(positions[0].fechaCierreEstimada).toBe(false)
  })

  it('excluye contratos sin strike o vencimiento', () => {
    const { positions, excluidas } = buildOptionPositions([rec({ category: 'OPTIONS_GAMMA', ai_report: {} })], {})
    expect(positions).toHaveLength(0)
    expect(excluidas[0].motivo).toBe('contrato sin strike o vencimiento')
  })

  it('ignora las recomendaciones de acciones', () => {
    const { positions } = buildOptionPositions([rec({})], {})
    expect(positions).toHaveLength(0)
  })
})
