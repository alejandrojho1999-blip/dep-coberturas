import { describe, expect, it } from 'vitest'
import {
  diasDelMes,
  PASO_TASA,
  repartirProbabilidad,
  simboloZq,
  tasaPostReunion,
} from '@/lib/alertas/fedwatch'

describe('simboloZq', () => {
  it('usa el código de mes del CME', () => {
    expect(simboloZq(2026, 9)).toBe('ZQU26.CBT')
    expect(simboloZq(2026, 10)).toBe('ZQV26.CBT')
    expect(simboloZq(2026, 12)).toBe('ZQZ26.CBT')
    expect(simboloZq(2027, 1)).toBe('ZQF27.CBT')
  })
})

describe('diasDelMes', () => {
  it('cuenta bien febrero bisiesto y los meses de 31', () => {
    expect(diasDelMes(2026, 2)).toBe(28)
    expect(diasDelMes(2028, 2)).toBe(29)
    expect(diasDelMes(2026, 9)).toBe(30)
    expect(diasDelMes(2026, 12)).toBe(31)
  })
})

describe('tasaPostReunion', () => {
  it('sin cambio esperado devuelve la tasa vigente', () => {
    // Media implícita 3.80 = tasa actual: el mercado no descuenta movimiento.
    const r = tasaPostReunion({ precio: 96.2, tasaActual: 3.8, diasMes: 30, diaEfectivo: 17 })
    expect(r).toBeCloseTo(3.8, 10)
  })

  it('despeja la tasa posterior cuando la media implícita sube', () => {
    // 16 días a 3.80 y 14 a r1 con media 3.90 → r1 = (3.9*30 - 16*3.8)/14
    const r = tasaPostReunion({ precio: 96.1, tasaActual: 3.8, diasMes: 30, diaEfectivo: 17 })!
    expect(r).toBeCloseTo((3.9 * 30 - 16 * 3.8) / 14, 10)
    expect(r).toBeGreaterThan(3.8)
  })

  it('devuelve null si la reunión no deja días posteriores en el mes', () => {
    expect(tasaPostReunion({ precio: 96.2, tasaActual: 3.8, diasMes: 30, diaEfectivo: 31 })).toBeNull()
  })
})

describe('repartirProbabilidad', () => {
  it('media subida descontada es 50% de probabilidad', () => {
    const p = repartirProbabilidad(3.8, 3.8 + PASO_TASA / 2)
    expect(p).toEqual({ probSubida: 50, probMantener: 50, probBajada: 0 })
  })

  it('un movimiento completo satura en 100%', () => {
    expect(repartirProbabilidad(3.8, 4.3).probSubida).toBe(100)
  })

  it('una tasa implícita menor se lee como bajada', () => {
    const p = repartirProbabilidad(3.8, 3.7)
    expect(p.probBajada).toBe(40)
    expect(p.probSubida).toBe(0)
    expect(p.probMantener).toBe(60)
  })

  it('sin diferencia todo es mantener', () => {
    expect(repartirProbabilidad(3.8, 3.8)).toEqual({ probSubida: 0, probMantener: 100, probBajada: 0 })
  })
})
