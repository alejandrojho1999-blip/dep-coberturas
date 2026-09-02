import { describe, expect, it } from 'vitest'
import {
  aplicarCurva,
  forzarMonotonia,
  huboMovimiento,
  peldanoDesdeProbabilidad,
  UMBRAL_MATERIAL,
  type PuntoCurva,
} from '@/lib/alertas/calibracion'

describe('huboMovimiento', () => {
  it('basta con que un solo activo pase su umbral', () => {
    // El VIX se dispara y el oro ni se entera: sigue siendo un evento que movió.
    expect(huboMovimiento([
      { ticker: 'GC=F', extremo: 0.004 },
      { ticker: '^VIX', extremo: 0.35 },
    ])).toBe(true)
  })

  it('es falso cuando ninguno llega a su umbral', () => {
    expect(huboMovimiento([
      { ticker: 'GC=F', extremo: 0.01 },
      { ticker: 'ES=F', extremo: -0.02 },
    ])).toBe(false)
  })

  it('cuenta el movimiento a la baja igual que el alza', () => {
    expect(huboMovimiento([{ ticker: 'ES=F', extremo: -0.04 }])).toBe(true)
  })

  it('el umbral es inclusivo: justo en el borde cuenta', () => {
    expect(huboMovimiento([{ ticker: 'GC=F', extremo: UMBRAL_MATERIAL['GC=F'] }])).toBe(true)
  })

  it('un extremo nulo es "no se sabe", nunca un movimiento', () => {
    // BTC-USD antes de 2014 no cotizaba: no puede contar ni a favor ni en contra.
    expect(huboMovimiento([{ ticker: 'BTC-USD', extremo: null }])).toBe(false)
  })

  it('ignora los tickers sin umbral definido en vez de darlos por movidos', () => {
    expect(huboMovimiento([{ ticker: 'DESCONOCIDO', extremo: 9 }])).toBe(false)
  })

  it('sin mediciones, no hubo movimiento', () => {
    expect(huboMovimiento([])).toBe(false)
  })
})

describe('peldanoDesdeProbabilidad', () => {
  it('reparte el 1-5 sobre la probabilidad observada', () => {
    expect(peldanoDesdeProbabilidad(0.95)).toBe(5)
    expect(peldanoDesdeProbabilidad(0.65)).toBe(4)
    expect(peldanoDesdeProbabilidad(0.45)).toBe(3)
    expect(peldanoDesdeProbabilidad(0.25)).toBe(2)
    expect(peldanoDesdeProbabilidad(0.05)).toBe(1)
  })

  it('los cortes son inclusivos por abajo', () => {
    expect(peldanoDesdeProbabilidad(0.80)).toBe(5)
    expect(peldanoDesdeProbabilidad(0.7999)).toBe(4)
    expect(peldanoDesdeProbabilidad(0.20)).toBe(2)
    expect(peldanoDesdeProbabilidad(0.1999)).toBe(1)
  })

  it('los extremos no se salen del 1-5', () => {
    expect(peldanoDesdeProbabilidad(0)).toBe(1)
    expect(peldanoDesdeProbabilidad(1)).toBe(5)
  })
})

describe('forzarMonotonia', () => {
  it('levanta el punto que rompe el orden hasta el máximo previo', () => {
    // El peldaño 4 salió más flojo que el 3: con dos eventos, eso es ruido.
    const curva = forzarMonotonia([
      { llm: 3, final: 3 },
      { llm: 4, final: 1 },
      { llm: 5, final: 5 },
    ])
    expect(curva.map((p) => p.final)).toEqual([3, 3, 5])
  })

  it('deja intacta una curva que ya sube', () => {
    const curva = forzarMonotonia([
      { llm: 1, final: 1 },
      { llm: 3, final: 3 },
      { llm: 5, final: 4 },
    ])
    expect(curva.map((p) => p.final)).toEqual([1, 3, 4])
  })

  it('ordena por peldaño del LLM aunque lleguen desordenados', () => {
    const curva = forzarMonotonia([
      { llm: 5, final: 5 },
      { llm: 1, final: 2 },
    ])
    expect(curva.map((p) => p.llm)).toEqual([1, 5])
  })

  it('no muta la entrada', () => {
    const original = [{ llm: 4, final: 1 }, { llm: 3, final: 3 }]
    forzarMonotonia(original)
    expect(original[0].final).toBe(1)
  })

  it('con la lista vacía devuelve la lista vacía', () => {
    expect(forzarMonotonia([])).toEqual([])
  })
})

describe('aplicarCurva', () => {
  const curva: PuntoCurva[] = [
    { tema: 'guerra', severidadLlm: 5, severidadFinal: 3 },
    { tema: 'guerra', severidadLlm: 4, severidadFinal: 2 },
    { tema: 'fed_tesoro', severidadLlm: 4, severidadFinal: 4 },
  ]

  it('baja el peldaño cuando la curva lo dice', () => {
    expect(aplicarCurva(5, 'guerra', curva)).toBe(3)
  })

  it('no cruza temas: cada uno tiene su curva', () => {
    expect(aplicarCurva(4, 'guerra', curva)).toBe(2)
    expect(aplicarCurva(4, 'fed_tesoro', curva)).toBe(4)
  })

  it('sin punto de curva devuelve el original sin tocarlo', () => {
    // Inventar una corrección donde no hay dato sería peor que no corregir.
    expect(aplicarCurva(2, 'guerra', curva)).toBe(2)
    expect(aplicarCurva(5, 'debasement', curva)).toBe(5)
  })

  it('con la curva vacía no corrige nada', () => {
    expect(aplicarCurva(5, 'guerra', [])).toBe(5)
  })
})
