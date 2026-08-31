import { afterEach, describe, expect, it } from 'vitest'
import { calcularNivel, factorAtr, redondearATick } from '@/lib/alertas/niveles'
import { buscarSimbolo, SIMBOLOS } from '@/lib/alertas/simbolos'

const oro = buscarSimbolo('GC=F')!
const nasdaq = buscarSimbolo('NQ=F')!

afterEach(() => {
  delete process.env.ALERTAS_ATR_K
})

describe('redondearATick', () => {
  it('ajusta al tick de 0.25 de los futuros de índice', () => {
    expect(redondearATick(20134.31, 0.25)).toBe(20134.25)
    expect(redondearATick(20134.4, 0.25)).toBe(20134.5)
  })

  it('no arrastra error binario', () => {
    expect(redondearATick(3412.55, 0.1)).toBe(3412.6)
  })

  it('con tick inválido devuelve el valor tal cual', () => {
    expect(redondearATick(10.123, 0)).toBe(10.123)
  })
})

describe('calcularNivel', () => {
  it('el buy stop queda por encima del precio', () => {
    const n = calcularNivel('buy', 3412.5, 30, oro, 0.5)!
    expect(n.nivel).toBe(3427.5)
    expect(n.nivel).toBeGreaterThan(n.precio)
    expect(n.distanciaPct).toBeCloseTo(0.4395, 3)
  })

  it('el sell stop queda por debajo del precio', () => {
    const n = calcularNivel('sell', 20000, 200, nasdaq, 0.5)!
    expect(n.nivel).toBe(19900)
    expect(n.nivel).toBeLessThan(n.precio)
  })

  it('sin ATR no inventa nivel', () => {
    expect(calcularNivel('buy', 3412.5, null, oro)).toBeNull()
    expect(calcularNivel('buy', 3412.5, 0, oro)).toBeNull()
  })

  it('rechaza precios imposibles', () => {
    expect(calcularNivel('buy', 0, 30, oro)).toBeNull()
    expect(calcularNivel('buy', Number.NaN, 30, oro)).toBeNull()
  })

  it('un sell stop no puede caer bajo cero', () => {
    expect(calcularNivel('sell', 10, 100, oro, 0.5)).toBeNull()
  })
})

describe('factorAtr', () => {
  it('usa 0.5 por defecto', () => {
    expect(factorAtr()).toBe(0.5)
  })

  it('respeta ALERTAS_ATR_K si es válido', () => {
    process.env.ALERTAS_ATR_K = '0.8'
    expect(factorAtr()).toBe(0.8)
  })

  it('ignora valores no numéricos o negativos', () => {
    process.env.ALERTAS_ATR_K = 'mucho'
    expect(factorAtr()).toBe(0.5)
    process.env.ALERTAS_ATR_K = '-1'
    expect(factorAtr()).toBe(0.5)
  })
})

describe('catálogo de símbolos', () => {
  it('todos declaran tick y al menos un evento', () => {
    for (const s of SIMBOLOS) {
      expect(s.tick).toBeGreaterThan(0)
      expect(s.eventos.length).toBeGreaterThan(0)
    }
  })
})
