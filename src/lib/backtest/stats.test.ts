import { describe, it, expect } from 'vitest'
import {
  crearRng, metricasCurva, neweyWestSE, contrastarMedia, cdfNormal, cdfNormalInv,
  compararConBenchmark, bootstrapBloques, deflatedSharpe, percentil, PERIODOS_POR_ANIO,
} from '@/lib/backtest/stats'
import { desviacion } from '@/lib/portafolios/metrics'

describe('crearRng', () => {
  it('la misma semilla produce la misma secuencia', () => {
    const a = crearRng(42), b = crearRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('semillas distintas divergen', () => {
    expect(crearRng(1)()).not.toBe(crearRng(2)())
  })

  it('genera valores en [0, 1)', () => {
    const r = crearRng(9)
    for (let i = 0; i < 200; i++) {
      const x = r()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('cdfNormal', () => {
  it('vale 0,5 en el centro', () => {
    expect(cdfNormal(0)).toBeCloseTo(0.5, 6)
  })

  it('reproduce los cuantiles conocidos', () => {
    expect(cdfNormal(1.96)).toBeCloseTo(0.975, 4)
    expect(cdfNormal(-1.645)).toBeCloseTo(0.05, 4)
  })
})

describe('cdfNormalInv', () => {
  it('es la inversa de cdfNormal', () => {
    for (const p of [0.01, 0.1, 0.5, 0.9, 0.99]) {
      expect(cdfNormal(cdfNormalInv(p))).toBeCloseTo(p, 4)
    }
  })
})

describe('neweyWestSE', () => {
  const rng = crearRng(3)
  const ruido = Array.from({ length: 200 }, () => rng() - 0.5)

  it('sin autocorrelación se parece al error estándar clásico', () => {
    const clasico = desviacion(ruido)! / Math.sqrt(ruido.length)
    expect(neweyWestSE(ruido, 3)!).toBeCloseTo(clasico, 2)
  })

  it('con autocorrelación positiva es mayor que el clásico', () => {
    const persistente: number[] = [ruido[0]]
    for (let i = 1; i < ruido.length; i++) persistente.push(0.8 * persistente[i - 1] + ruido[i])
    const clasico = desviacion(persistente)! / Math.sqrt(persistente.length)
    expect(neweyWestSE(persistente, 6)!).toBeGreaterThan(clasico)
  })

  it('devuelve null con menos de tres observaciones', () => {
    expect(neweyWestSE([1, 2])).toBeNull()
  })
})

describe('contrastarMedia', () => {
  it('una serie centrada en cero no es significativa', () => {
    const rng = crearRng(11)
    const xs = Array.from({ length: 100 }, () => rng() - 0.5)
    expect(Math.abs(contrastarMedia(xs).tStat!)).toBeLessThan(2)
  })

  it('un desplazamiento grande sí lo es', () => {
    const rng = crearRng(11)
    const xs = Array.from({ length: 100 }, () => rng() - 0.5 + 1)
    expect(contrastarMedia(xs).tStat!).toBeGreaterThan(3)
    expect(contrastarMedia(xs).pValor!).toBeLessThan(0.01)
  })
})

describe('metricasCurva', () => {
  const rets = Array.from({ length: 24 }, () => 0.01)
  const curva = [{ fecha: '2024-01-31', valor: 1 }]
  rets.forEach((r, i) => curva.push({ fecha: `m${i}`, valor: curva[i].valor * (1 + r) }))

  it('el retorno total compone los periodos', () => {
    expect(metricasCurva(curva, rets, 0).retornoTotal).toBeCloseTo(1.01 ** 24 - 1, 6)
  })

  it('una serie sin caídas tiene drawdown cero', () => {
    expect(metricasCurva(curva, rets, 0).maxDrawdown).toBe(0)
  })

  it('anualiza el CAGR con la frecuencia mensual', () => {
    expect(metricasCurva(curva, rets, 0).cagr).toBeCloseTo(1.01 ** 12 - 1, 6)
  })

  it('sin volatilidad no inventa un Sharpe', () => {
    expect(metricasCurva(curva, rets, 0).sharpe).toBeNull()
  })
})

describe('compararConBenchmark', () => {
  it('una cartera idéntica al benchmark no tiene alfa ni tracking error', () => {
    const b = [0.01, -0.02, 0.03, 0.005, -0.01]
    const r = compararConBenchmark(b, b)
    expect(r.retornoActivoMedio).toBeCloseTo(0, 12)
    expect(r.trackingError).toBeCloseTo(0, 12)
    expect(r.beta).toBeCloseTo(1, 6)
  })

  it('un exceso constante da information ratio positivo', () => {
    const b = [0.01, -0.02, 0.03, 0.005, -0.01]
    const p = b.map(x => x + 0.005)
    expect(compararConBenchmark(p, b).retornoActivoMedio).toBeCloseTo(0.005, 9)
  })
})

describe('bootstrapBloques', () => {
  it('una media claramente positiva sale significativa', () => {
    const xs = Array.from({ length: 60 }, (_, i) => 0.02 + (i % 2 ? 0.001 : -0.001))
    expect(bootstrapBloques(xs, crearRng(5), 500).pValor).toBeLessThan(0.05)
  })

  it('ruido centrado no lo es', () => {
    const rng = crearRng(5)
    const xs = Array.from({ length: 60 }, () => rng() - 0.5)
    expect(bootstrapBloques(xs, crearRng(6), 500).pValor).toBeGreaterThan(0.1)
  })
})

describe('deflatedSharpe', () => {
  const rng = crearRng(17)
  const rets = Array.from({ length: 120 }, () => (rng() - 0.4) * 0.05)

  it('probar más configuraciones reduce la probabilidad', () => {
    const pocas = deflatedSharpe(rets, 1.5, 2)!
    const muchas = deflatedSharpe(rets, 1.5, 500)!
    expect(muchas.probabilidad).toBeLessThan(pocas.probabilidad)
    expect(muchas.sharpeEsperadoPorAzar).toBeGreaterThan(pocas.sharpeEsperadoPorAzar)
  })

  it('un Sharpe mayor eleva la probabilidad', () => {
    const bajo = deflatedSharpe(rets, 0.2, 10)!
    const alto = deflatedSharpe(rets, 2.0, 10)!
    expect(alto.probabilidad).toBeGreaterThan(bajo.probabilidad)
  })

  it('devuelve null sin observaciones suficientes', () => {
    expect(deflatedSharpe([0.01, 0.02], 1, 10, PERIODOS_POR_ANIO)).toBeNull()
  })
})

describe('percentil', () => {
  it('sitúa el valor dentro de la muestra', () => {
    expect(percentil([1, 2, 3, 4], 3.5)).toBe(75)
    expect(percentil([1, 2, 3, 4], 0)).toBe(0)
  })
})
