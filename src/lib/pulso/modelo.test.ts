import { describe, expect, it } from 'vitest'
import {
  auc,
  brier,
  contribuciones,
  entrenarLogistica,
  entrenarYEvaluar,
  mereceActivarse,
  MINIMO_DIAS,
  predecir,
  sigmoide,
  type Metricas,
} from '@/lib/pulso/modelo'

/** Generador determinista: los tests no pueden depender de Math.random. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const FEATURES = ['a', 'b']

/** Dataset donde la etiqueta depende de verdad de la primera feature. */
function separable(n: number, ruido = 0): { X: number[][]; y: number[] } {
  const r = rng(7)
  const X: number[][] = []
  const y: number[] = []
  for (let i = 0; i < n; i++) {
    const positivo = i % 3 === 0
    X.push([
      (positivo ? 2 : -2) + (r() - 0.5) * ruido,
      (r() - 0.5) * 4,
    ])
    y.push(positivo ? 1 : 0)
  }
  return { X, y }
}

/** Dataset donde la etiqueta no tiene nada que ver con las features. */
function puroRuido(n: number): { X: number[][]; y: number[] } {
  const r = rng(13)
  const X: number[][] = []
  const y: number[] = []
  for (let i = 0; i < n; i++) {
    X.push([r() * 4 - 2, r() * 4 - 2])
    y.push(r() > 0.5 ? 1 : 0)
  }
  return { X, y }
}

describe('sigmoide', () => {
  it('mapea a probabilidades', () => {
    expect(sigmoide(0)).toBe(0.5)
    expect(sigmoide(10)).toBeGreaterThan(0.99)
    expect(sigmoide(-10)).toBeLessThan(0.01)
  })

  it('se pega a 0 y a 1 en vez de desbordar', () => {
    expect(sigmoide(10_000)).toBe(1)
    // El acotado a ±40 deja un residuo minúsculo en vez de cero exacto. Es lo
    // que se busca: sin él, `Math.exp` desborda y la probabilidad sale NaN.
    expect(sigmoide(-10_000)).toBeCloseTo(0, 10)
    expect(Number.isNaN(sigmoide(-10_000))).toBe(false)
    expect(Number.isNaN(sigmoide(10_000))).toBe(false)
  })
})

describe('auc', () => {
  it('vale 1 cuando el orden es perfecto y 0 cuando es el inverso', () => {
    expect(auc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9])).toBe(1)
    expect(auc([1, 1, 0, 0], [0.1, 0.2, 0.8, 0.9])).toBe(0)
  })

  it('vale 0.5 cuando todas las probabilidades son iguales', () => {
    expect(auc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5])).toBe(0.5)
  })

  it('sin una de las dos clases no hay nada que discriminar', () => {
    expect(auc([1, 1, 1], [0.2, 0.7, 0.9])).toBe(0.5)
    expect(auc([], [])).toBe(0.5)
  })
})

describe('brier', () => {
  it('premia la probabilidad calibrada', () => {
    expect(brier([1, 0], [1, 0])).toBe(0)
    expect(brier([1, 0], [0, 1])).toBe(1)
    expect(brier([1, 0], [0.5, 0.5])).toBe(0.25)
  })
})

describe('entrenarLogistica', () => {
  it('aprende una separación real', () => {
    const { X, y } = separable(120)
    const modelo = entrenarLogistica(X, y, FEATURES)

    expect(predecir(modelo, [2, 0])).toBeGreaterThan(0.7)
    expect(predecir(modelo, [-2, 0])).toBeLessThan(0.3)
  })

  it('da más peso a la feature que informa que a la que no', () => {
    const { X, y } = separable(120)
    const modelo = entrenarLogistica(X, y, FEATURES)
    expect(Math.abs(modelo.pesos[0])).toBeGreaterThan(Math.abs(modelo.pesos[1]))
  })

  it('devuelve probabilidades válidas también con una feature constante', () => {
    const X = Array.from({ length: 60 }, (_, i) => [i % 2, 5])
    const y = X.map((f) => (f[0] === 1 ? 1 : 0))
    const modelo = entrenarLogistica(X, y, FEATURES)
    const p = predecir(modelo, [1, 5])
    expect(Number.isFinite(p)).toBe(true)
    expect(p).toBeGreaterThan(0.5)
  })

  it('rechaza entradas incoherentes en vez de entrenar con basura', () => {
    expect(() => entrenarLogistica([], [], FEATURES)).toThrow()
    expect(() => entrenarLogistica([[1, 2]], [1, 0], FEATURES)).toThrow()
  })
})

describe('contribuciones', () => {
  it('reparte el empuje por feature, con su nombre', () => {
    const { X, y } = separable(120)
    const modelo = entrenarLogistica(X, y, FEATURES)
    const partes = contribuciones(modelo, [2, 0])

    expect(Object.keys(partes)).toEqual(FEATURES)
    // La feature que separa tiene que empujar hacia arriba en un caso positivo.
    expect(partes.a).toBeGreaterThan(0)
  })
})

describe('entrenarYEvaluar', () => {
  it('reconoce una señal real fuera de muestra', () => {
    const { X, y } = separable(200, 1)
    const { metricas } = entrenarYEvaluar(X, y, FEATURES)

    expect(metricas.auc).toBeGreaterThan(0.9)
    expect(metricas.nPrueba).toBeGreaterThan(0)
    expect(metricas.folds).toBeGreaterThan(0)
  })

  it('no se engaña con ruido: el AUC se queda cerca de la moneda al aire', () => {
    const { X, y } = puroRuido(200)
    const { metricas } = entrenarYEvaluar(X, y, FEATURES)

    expect(metricas.auc).toBeGreaterThan(0.3)
    expect(metricas.auc).toBeLessThan(0.7)
  })

  it('se niega a entrenar por debajo del mínimo de días', () => {
    const { X, y } = separable(MINIMO_DIAS - 1)
    expect(() => entrenarYEvaluar(X, y, FEATURES)).toThrow(/hacen falta/)
  })

  it('informa de la tasa base, que es contra lo que hay que juzgar el modelo', () => {
    const { X, y } = separable(120)
    const { metricas } = entrenarYEvaluar(X, y, FEATURES)
    expect(metricas.tasaBase).toBeCloseTo(1 / 3, 1)
  })
})

describe('mereceActivarse', () => {
  const buenas: Metricas = { auc: 0.72, brier: 0.15, tasaBase: 0.2, nEntrenamiento: 120, nPrueba: 40, folds: 4 }

  it('un modelo sin capacidad de discriminar no se activa aunque no haya otro', () => {
    expect(mereceActivarse({ ...buenas, auc: 0.52 }, null)).toBe(false)
  })

  it('no se activa con una muestra fuera de muestra ridícula', () => {
    expect(mereceActivarse({ ...buenas, nPrueba: 5 }, null)).toBe(false)
  })

  it('el primero bueno entra; después hay que mejorar al vigente', () => {
    expect(mereceActivarse(buenas, null)).toBe(true)
    expect(mereceActivarse(buenas, { ...buenas, auc: 0.8 })).toBe(false)
    expect(mereceActivarse({ ...buenas, auc: 0.85 }, { ...buenas, auc: 0.8 })).toBe(true)
  })
})
