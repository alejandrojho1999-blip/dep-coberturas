import { describe, expect, it } from 'vitest'
import { atr, trueRange, type Vela } from '@/lib/alertas/atr'

function vela(high: number, low: number, close: number, i = 0): Vela {
  return { date: `2026-01-${String(i + 1).padStart(2, '0')}`, high, low, close }
}

describe('trueRange', () => {
  it('sin cierre anterior usa el rango de la propia vela', () => {
    expect(trueRange(vela(105, 100, 103), null)).toBe(5)
  })

  it('un hueco al alza pesa más que el rango intradía', () => {
    // Cierre anterior 90, vela 105/100: |105-90| = 15 supera al rango de 5.
    expect(trueRange(vela(105, 100, 103), 90)).toBe(15)
  })

  it('un hueco a la baja también cuenta', () => {
    expect(trueRange(vela(105, 100, 103), 120)).toBe(20)
  })
})

describe('atr', () => {
  it('devuelve null sin historia suficiente', () => {
    const velas = Array.from({ length: 10 }, (_, i) => vela(10, 9, 9.5, i))
    expect(atr(velas, 14)).toBeNull()
  })

  it('con rango constante el ATR es ese rango', () => {
    // 20 velas de rango 2 y sin huecos: cualquier suavizado devuelve 2.
    const velas = Array.from({ length: 20 }, (_, i) => vela(12, 10, 11, i))
    expect(atr(velas, 14)).toBeCloseTo(2, 10)
  })

  it('aplica el suavizado de Wilder tras la media inicial', () => {
    // 15 velas de rango 2 (14 TR) → ATR inicial 2. Una vela final de rango 16
    // deja (2*13 + 16)/14 = 3.
    const velas: Vela[] = Array.from({ length: 15 }, (_, i) => vela(12, 10, 11, i))
    velas.push(vela(27, 11, 20, 15))
    expect(atr(velas, 14)).toBeCloseTo(3, 10)
  })

  it('rechaza periodos inválidos', () => {
    expect(() => atr([], 0)).toThrow()
  })
})
