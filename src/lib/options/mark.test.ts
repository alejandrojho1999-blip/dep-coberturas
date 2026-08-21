import { describe, it, expect } from 'vitest'
import type { AgentRec } from '@/lib/agentes/types'
import { optionOutcome, optionRefFromRec, sideForCategory } from './mark'

function rec(over: Partial<AgentRec>): AgentRec {
  return {
    id: 'id', user_id: 'u', ticker: 'FSLR', empresa: null, category: 'OPTIONS_GAMMA',
    precio_entrada: 15.75, precio_objetivo: null, stop_loss: null, precio_venta: null,
    cantidad_acciones: null, direction: 'COMPRA', riesgo: null, timeframe: null,
    resumen: null, score: null, market_cap_m: null, estado: 'Comprar',
    created_at: '2026-01-05T14:30:00.000Z',
    ai_report: { strike: 230, expiration: '2026-06-18', optionType: 'CALL' },
    ...over,
  }
}

describe('optionRefFromRec', () => {
  it('lee el contrato de Gamma desde optionType', () => {
    expect(optionRefFromRec(rec({}))).toEqual({
      ticker: 'FSLR', expiration: '2026-06-18', strike: 230, type: 'CALL',
    })
  })

  it('deriva el tipo de la estrategia de Theta: SELL_PUT es un put', () => {
    const r = rec({ ai_report: { strike: 400, expiration: '2026-07-17', strategy: 'SELL_PUT' } })
    expect(optionRefFromRec(r)?.type).toBe('PUT')
  })

  it('una call cubierta es un call', () => {
    const r = rec({ ai_report: { strike: 400, expiration: '2026-07-17', strategy: 'COVERED_CALL' } })
    expect(optionRefFromRec(r)?.type).toBe('CALL')
  })

  it('devuelve null si falta strike o vencimiento', () => {
    expect(optionRefFromRec(rec({ ai_report: { expiration: '2026-06-18' } }))).toBeNull()
    expect(optionRefFromRec(rec({ ai_report: { strike: 230 } }))).toBeNull()
    expect(optionRefFromRec(rec({ ai_report: null }))).toBeNull()
  })
})

describe('sideForCategory', () => {
  it('Theta vende la prima y Gamma la compra', () => {
    expect(sideForCategory('OPTIONS_THETA')).toBe('short')
    expect(sideForCategory('OPTIONS_GAMMA')).toBe('long')
  })
})

describe('optionOutcome', () => {
  it('un largo gana lo que sube la prima, sobre 100 acciones', () => {
    const o = optionOutcome(rec({}), 20, 'long')!
    expect(o.usd).toBeCloseTo(425, 6)
    expect(o.pct).toBeCloseTo(26.984, 3)
    expect(o.cerrada).toBe(false)
  })

  it('un largo pierde si la prima cae', () => {
    expect(optionOutcome(rec({}), 10, 'long')!.usd).toBeCloseTo(-575, 6)
  })

  it('un corto gana justo lo contrario', () => {
    const o = optionOutcome(rec({ category: 'OPTIONS_THETA', precio_entrada: 4 }), 1.5, 'short')!
    expect(o.usd).toBeCloseTo(250, 6)
    expect(o.pct).toBeCloseTo(62.5, 6)
  })

  it('una posición cerrada usa el precio de liquidación, no la prima de mercado', () => {
    // Caso real: FSLR CALL $230 venció con el subyacente en 257.70.
    const o = optionOutcome(rec({ estado: 'Vender', precio_venta: 27.7 }), 5, 'long')!
    expect(o.cerrada).toBe(true)
    expect(o.valorActual).toBe(27.7)
    expect(o.usd).toBeCloseTo(1195, 6)
    expect(o.pct).toBeCloseTo(75.873, 3)
  })

  it('devuelve null sin prima de entrada utilizable', () => {
    expect(optionOutcome(rec({ precio_entrada: null }), 20, 'long')).toBeNull()
    expect(optionOutcome(rec({ precio_entrada: 0 }), 20, 'long')).toBeNull()
  })

  it('devuelve null cuando Yahoo no cotiza el contrato', () => {
    expect(optionOutcome(rec({}), undefined, 'long')).toBeNull()
  })

  it('el detalle explica el cálculo con las dos patas', () => {
    const o = optionOutcome(rec({}), 20, 'long')!
    expect(o.detalle).toContain('Prima pagada: $15.75 × 100 = $1575.00')
    expect(o.detalle).toContain('Resultado: +$425.00 por contrato')
  })
})
