import { describe, it, expect } from 'vitest'
import {
  volatilidadRealizada, volatilidadImplicita, primaDeVarianza, aplicarSkew,
  tipoSinRiesgo, IV_MINIMA, IV_MAXIMA,
} from './volatilidad'
import { SESIONES_ANUALES } from './config'

describe('volatilidad realizada', () => {
  it('reproduce un caso calculado a mano', () => {
    // Serie que alterna +10 % y −10 % en logaritmo: la desviación típica de los
    // rendimientos es conocida y la anualización es una multiplicación.
    const paso = 0.1
    const cierres = [100]
    for (let i = 1; i <= 21; i++) {
      cierres.push(cierres[i - 1] * Math.exp(i % 2 === 1 ? paso : -paso))
    }
    const vol = volatilidadRealizada(cierres, 20)
    const ultimo = vol.at(-1)!
    expect(ultimo).not.toBeNull()
    // Rendimientos ±0,1 con media ~0 → desviación ~0,1 → anualizada ~0,1·√252.
    expect(ultimo).toBeCloseTo(paso * Math.sqrt(SESIONES_ANUALES), 1)
  })

  it('deja en null las posiciones sin historia suficiente', () => {
    const cierres = Array.from({ length: 30 }, (_, i) => 100 + i)
    const vol = volatilidadRealizada(cierres, 20)
    // Las primeras 20 posiciones no tienen ventana completa detrás.
    for (let i = 0; i < 20; i++) expect(vol[i], `posición ${i}`).toBeNull()
    expect(vol[20]).not.toBeNull()
  })

  it('no mira hacia adelante', () => {
    // La propiedad crítica: alterar el futuro no puede cambiar el pasado. Si
    // esto fallara, todo el backtest estaría contaminado.
    const base = Array.from({ length: 60 }, (_, i) => 100 * Math.exp(Math.sin(i) * 0.02))
    const alterado = [...base]
    alterado[50] = 1000

    const a = volatilidadRealizada(base, 20)
    const b = volatilidadRealizada(alterado, 20)
    for (let i = 0; i < 50; i++) {
      expect(b[i], `posición ${i} contaminada por el futuro`).toBe(a[i])
    }
  })

  it('sobrevive a series cortas y a precios imposibles', () => {
    expect(volatilidadRealizada([], 20)).toEqual([])
    expect(volatilidadRealizada([100], 20)).toEqual([null])
    const conCeros = volatilidadRealizada([100, 0, 100, 0, 100], 2)
    expect(conCeros.every(v => v == null || Number.isFinite(v))).toBe(true)
  })
})

describe('volatilidad implícita', () => {
  it('en modo constante es la realizada por k', () => {
    expect(volatilidadImplicita({ realizada: 0.20, k: 1.15, modo: 'constante' }))
      .toBeCloseTo(0.23, 6)
  })

  it('en modo régimen escala por la prima del día', () => {
    const iv = volatilidadImplicita({ realizada: 0.20, primaDeMercado: 1.30, k: 1.0, modo: 'regimen' })!
    expect(iv).toBeCloseTo(0.26, 6)
  })

  it('sin prima de mercado el modo régimen se degrada al constante', () => {
    // Degradarse es correcto; inventar una prima no lo sería.
    const conNull = volatilidadImplicita({ realizada: 0.20, primaDeMercado: null, k: 1.15, modo: 'regimen' })
    const constante = volatilidadImplicita({ realizada: 0.20, k: 1.15, modo: 'constante' })
    expect(conNull).toBe(constante)
  })

  it('acota la salida entre el suelo y el techo declarados', () => {
    // Sin suelo, una racha lateral produciría primas ridículas que el motor
    // compraría a millares; sin techo pasaría lo simétrico en marzo de 2020.
    expect(volatilidadImplicita({ realizada: 0.001, k: 1, modo: 'constante' })).toBe(IV_MINIMA)
    expect(volatilidadImplicita({ realizada: 50, k: 1, modo: 'constante' })).toBe(IV_MAXIMA)
  })

  it('rechaza realizadas imposibles', () => {
    expect(volatilidadImplicita({ realizada: 0, k: 1.1, modo: 'constante' })).toBeNull()
    expect(volatilidadImplicita({ realizada: -0.2, k: 1.1, modo: 'constante' })).toBeNull()
    expect(volatilidadImplicita({ realizada: NaN, k: 1.1, modo: 'constante' })).toBeNull()
  })
})

describe('prima de varianza', () => {
  it('convierte el VIX de puntos a fracción antes de dividir', () => {
    // El error más fácil aquí sería olvidar el /100, y multiplicaría todas las
    // primas del backtest por cien.
    const p = primaDeVarianza([20], [0.16])
    expect(p[0]).toBeCloseTo(1.25, 6)
  })

  it('deja null donde falta la realizada', () => {
    expect(primaDeVarianza([20, 20], [null, 0.20])[0]).toBeNull()
  })
})

describe('skew', () => {
  it('con pendiente cero deja la superficie plana', () => {
    expect(aplicarSkew(0.30, 100, 80, 0)).toBe(0.30)
  })

  it('sube la IV de los strikes por debajo del dinero', () => {
    // Es el sesgo real del mercado: se paga de más por asegurarse contra caídas.
    expect(aplicarSkew(0.30, 100, 80)).toBeGreaterThan(0.30)
    expect(aplicarSkew(0.30, 100, 120)).toBeLessThan(0.30)
  })

  it('respeta los límites de IV', () => {
    expect(aplicarSkew(0.30, 100, 0.001)).toBeLessThanOrEqual(IV_MAXIMA)
    expect(aplicarSkew(0.30, 100, 1e9)).toBeGreaterThanOrEqual(IV_MINIMA)
  })
})

describe('tipo sin riesgo', () => {
  it('convierte el índice de puntos a fracción', () => {
    expect(tipoSinRiesgo(4.5)).toBeCloseTo(0.045, 6)
  })

  it('pisa a cero los tipos negativos', () => {
    // En 2008 y 2020 la letra llegó a cotizar en negativo; un tipo negativo
    // rompe Black-Scholes sin aportar nada.
    expect(tipoSinRiesgo(-0.3)).toBe(0)
  })

  it('cae a la constante de la aplicación cuando no hay dato', () => {
    expect(tipoSinRiesgo(null)).toBeCloseTo(0.045, 6)
    expect(tipoSinRiesgo(undefined)).toBeCloseTo(0.045, 6)
  })
})
