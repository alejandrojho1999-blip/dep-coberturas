import { describe, it, expect } from 'vitest'
import { nivelesSalida, evaluarSalida } from './exit-levels'

describe('nivelesSalida', () => {
  it('Gamma (long): objetivo 2,5× y stop 0,5× de la prima pagada', () => {
    expect(nivelesSalida('long', 4)).toEqual({ objetivo: 10, stop: 2 })
  })

  it('Theta (short): objetivo 0,5× y stop 2× de la prima cobrada', () => {
    expect(nivelesSalida('short', 4)).toEqual({ objetivo: 2, stop: 8 })
  })

  it('redondea a 4 decimales, igual que la prima de entrada', () => {
    expect(nivelesSalida('long', 1.3333)).toEqual({ objetivo: 3.3332, stop: 0.6666 })
    expect(nivelesSalida('short', 0.07)).toEqual({ objetivo: 0.035, stop: 0.14 })
  })

  it('devuelve null con prima cero, negativa o no finita', () => {
    expect(nivelesSalida('long', 0)).toBeNull()
    expect(nivelesSalida('short', -2)).toBeNull()
    expect(nivelesSalida('long', NaN)).toBeNull()
    expect(nivelesSalida('short', Infinity)).toBeNull()
  })
})

describe('evaluarSalida — long (Gamma)', () => {
  it('cierra por objetivo cuando la prima sube al nivel', () => {
    const r = evaluarSalida('long', 4, 10)
    expect(r?.accion).toBe('objetivo')
    expect(r?.pnlPct).toBeCloseTo(150)
  })

  it('cierra por stop cuando la prima baja al nivel', () => {
    const r = evaluarSalida('long', 4, 2)
    expect(r?.accion).toBe('stop')
    expect(r?.pnlPct).toBeCloseTo(-50)
  })

  it('mantiene entre los dos niveles', () => {
    expect(evaluarSalida('long', 4, 5)?.accion).toBe('mantener')
    expect(evaluarSalida('long', 4, 2.01)?.accion).toBe('mantener')
    expect(evaluarSalida('long', 4, 9.99)?.accion).toBe('mantener')
  })

  it('el borde exacto cuenta como tocado', () => {
    expect(evaluarSalida('long', 4, 10)?.accion).toBe('objetivo')
    expect(evaluarSalida('long', 4, 2)?.accion).toBe('stop')
  })
})

describe('evaluarSalida — short (Theta)', () => {
  it('cierra por objetivo cuando la prima BAJA: recomprar más barato es ganar', () => {
    const r = evaluarSalida('short', 4, 2)
    expect(r?.accion).toBe('objetivo')
    expect(r?.pnlPct).toBeCloseTo(50)
  })

  it('el pnl del objetivo de Theta es positivo: recompra al 50 % de lo cobrado', () => {
    expect(evaluarSalida('short', 3.2, 1.6)?.pnlPct).toBeCloseTo(50)
  })

  it('cierra por stop cuando la prima SUBE al doble', () => {
    const r = evaluarSalida('short', 4, 8)
    expect(r?.accion).toBe('stop')
    expect(r?.pnlPct).toBeCloseTo(-100)
  })

  it('mantiene entre los dos niveles', () => {
    expect(evaluarSalida('short', 4, 4)?.accion).toBe('mantener')
    expect(evaluarSalida('short', 4, 2.01)?.accion).toBe('mantener')
    expect(evaluarSalida('short', 4, 7.99)?.accion).toBe('mantener')
  })

  it('la comparación es la inversa de long: la misma prima da acciones opuestas', () => {
    expect(evaluarSalida('long', 4, 2)?.accion).toBe('stop')
    expect(evaluarSalida('short', 4, 2)?.accion).toBe('objetivo')
  })
})

describe('evaluarSalida — datos inutilizables', () => {
  it('devuelve null si la entrada no sirve', () => {
    expect(evaluarSalida('long', 0, 5)).toBeNull()
    expect(evaluarSalida('short', NaN, 5)).toBeNull()
  })

  it('devuelve null si la prima viva no es un número utilizable', () => {
    expect(evaluarSalida('long', 4, NaN)).toBeNull()
    expect(evaluarSalida('short', 4, Infinity)).toBeNull()
    expect(evaluarSalida('long', 4, -1)).toBeNull()
  })

  it('una prima viva de 0 es válida: un contrato sin valor toca el stop del long', () => {
    expect(evaluarSalida('long', 4, 0)?.accion).toBe('stop')
    expect(evaluarSalida('short', 4, 0)?.accion).toBe('objetivo')
  })
})
