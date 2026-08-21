import { describe, it, expect } from 'vitest'
import type { AgentRec } from '@/lib/agentes/types'
import { isoDay, resolveClosedDate } from './closed-date'
import type { DailyClose } from './types'

function rec(over: Partial<AgentRec>): AgentRec {
  return {
    id: 'id', user_id: 'u', ticker: 'AAPL', empresa: null, category: 'PETER_LYNCH',
    precio_entrada: 100, precio_objetivo: null, stop_loss: null, precio_venta: null,
    cantidad_acciones: null, direction: 'COMPRA', riesgo: null, timeframe: null,
    resumen: null, score: null, market_cap_m: null, estado: 'Comprar',
    created_at: '2026-01-05T14:30:00.000Z', ai_report: null, ...over,
  }
}

const closes: DailyClose[] = [
  { date: '2026-01-05', close: 100 },
  { date: '2026-01-06', close: 108 },
  { date: '2026-01-07', close: 115 },
  { date: '2026-01-08', close: 112 },
]

describe('isoDay', () => {
  it('reduce un timestamp a su día natural en UTC', () => {
    expect(isoDay('2026-06-18T21:00:00.000Z')).toBe('2026-06-18')
  })
})

describe('resolveClosedDate', () => {
  it('una posición abierta no tiene fecha de cierre', () => {
    expect(resolveClosedDate(rec({}))).toEqual({ date: null, estimada: false })
  })

  it('usa closed_at cuando existe y no lo marca como estimado', () => {
    const r = rec({ estado: 'Vender', precio_venta: 115, closed_at: '2026-01-07T20:00:00.000Z' })
    expect(resolveClosedDate(r, closes)).toEqual({ date: '2026-01-07', estimada: false })
  })

  it('closed_at manda sobre el vencimiento del contrato', () => {
    const r = rec({
      estado: 'Vender', precio_venta: 5,
      closed_at: '2026-05-01T20:00:00.000Z',
      ai_report: { expiration: '2026-06-18' },
    })
    expect(resolveClosedDate(r)).toEqual({ date: '2026-05-01', estimada: false })
  })

  it('en opciones sin closed_at cae al vencimiento, marcado como estimado', () => {
    const r = rec({ estado: 'Vender', precio_venta: 27.7, ai_report: { expiration: '2026-06-18' } })
    expect(resolveClosedDate(r)).toEqual({ date: '2026-06-18', estimada: true })
  })

  it('en acciones deduce el día en que el mercado cotizó el precio de venta', () => {
    const r = rec({ estado: 'Vender', precio_venta: 115 })
    expect(resolveClosedDate(r, closes)).toEqual({ date: '2026-01-07', estimada: true })
  })

  it('acepta una diferencia de medio punto porcentual al casar el precio', () => {
    // 115.4 está dentro del 0,5 % de 115.
    const r = rec({ estado: 'Vender', precio_venta: 115.4 })
    expect(resolveClosedDate(r, closes).date).toBe('2026-01-07')
  })

  it('no casa con sesiones anteriores a la entrada', () => {
    const r = rec({ created_at: '2026-01-07T14:30:00.000Z', estado: 'Vender', precio_venta: 108 })
    // 108 solo cotizó el día 6, antes de entrar: cae a la última sesión.
    expect(resolveClosedDate(r, closes)).toEqual({ date: '2026-01-08', estimada: true })
  })

  it('sin coincidencia usa la última sesión disponible', () => {
    const r = rec({ estado: 'Vender', precio_venta: 999 })
    expect(resolveClosedDate(r, closes)).toEqual({ date: '2026-01-08', estimada: true })
  })

  it('sin histórico ni vencimiento se ancla en la fecha de entrada', () => {
    const r = rec({ estado: 'Vender', precio_venta: 115 })
    expect(resolveClosedDate(r)).toEqual({ date: '2026-01-05', estimada: true })
  })

  it('trata como cerrada una fila con precio de venta aunque el estado no lo diga', () => {
    const r = rec({ precio_venta: 115 })
    expect(resolveClosedDate(r, closes).date).toBe('2026-01-07')
  })
})
