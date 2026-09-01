import { describe, expect, it } from 'vitest'
import { detectarEmergentes, extraerNgramas, normalizarTermino, palabras, zScore } from '@/lib/pulso/keywords'
import { normalizarJuicio } from '@/lib/pulso/juez'
import type { FilaDocumento } from '@/lib/pulso/persistencia'

function doc(titulo: string, dia: string, fuente: FilaDocumento['fuente'] = 'news'): FilaDocumento {
  return {
    fuente,
    tema: null,
    titulo,
    url: `https://ejemplo.test/${encodeURIComponent(titulo)}-${dia}`,
    publicadoAt: `${dia}T10:00:00.000Z`,
    capturadoAt: `${dia}T10:05:00.000Z`,
  }
}

describe('normalizarTermino', () => {
  it('unifica tildes, mayúsculas y signos para que la serie no se parta', () => {
    expect(normalizarTermino('Kaliningrado,')).toBe('kaliningrado')
    expect(normalizarTermino('KALININGRADO')).toBe('kaliningrado')
    expect(normalizarTermino('aéreo')).toBe('aereo')
    expect(normalizarTermino('  doble   espacio ')).toBe('doble espacio')
  })
})

describe('palabras', () => {
  it('descarta vacías, cifras sueltas y palabras de menos de tres letras', () => {
    expect(palabras('La OTAN dice que hay 12 drones sobre Polonia')).toEqual(
      ['otan', 'dice', 'drones', 'polonia'],
    )
  })
})

describe('extraerNgramas', () => {
  it('cuenta unigramas y bigramas', () => {
    const conteos = extraerNgramas([doc('Espacio aereo cerrado', '2026-09-01')])
    const terminos = conteos.map((c) => c.termino)
    expect(terminos).toContain('espacio')
    expect(terminos).toContain('espacio aereo')
  })

  it('un término repetido dentro del mismo titular cuenta una vez', () => {
    const conteos = extraerNgramas([doc('Polonia Polonia Polonia', '2026-09-01')])
    expect(conteos.find((c) => c.termino === 'polonia')?.menciones).toBe(1)
  })

  it('registra en cuántas fuentes distintas aparece', () => {
    const conteos = extraerNgramas([
      doc('Drones sobre Polonia', '2026-09-01', 'news'),
      doc('Drones sobre Polonia hoy', '2026-09-01', 'hn'),
      doc('Mas drones en Polonia', '2026-09-01', 'trends'),
    ])
    const polonia = conteos.find((c) => c.termino === 'polonia')
    expect(polonia?.menciones).toBe(3)
    expect(polonia?.fuentes.sort()).toEqual(['hn', 'news', 'trends'])
  })
})

describe('zScore', () => {
  it('mide desviaciones típicas sobre la línea base', () => {
    expect(zScore([2, 2, 2, 2], 2)).toBe(0)
    expect(zScore([1, 2, 3, 4], 2.5)).toBe(0)
    expect(zScore([0, 0, 0, 0, 1, 1, 1, 1], 3)).toBeGreaterThan(2)
  })

  it('sin historia suficiente no declara nada emergente', () => {
    expect(zScore([], 50)).toBe(0)
    expect(zScore([1], 50)).toBe(0)
  })

  it('un término que pasa de no existir a existir sí es señal', () => {
    expect(zScore([0, 0, 0, 0], 5)).toBe(6)
    expect(zScore([0, 0, 0, 0], 0)).toBe(0)
  })
})

describe('detectarEmergentes', () => {
  // Cuatro días de rutina futbolística y un quinto día en que aparece algo nuevo.
  const historia = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31'].flatMap((dia) => [
    doc('Resultados de la liga de futbol', dia),
    doc('Mercado de fichajes de futbol', dia),
    doc('Cronica del partido de futbol', dia),
  ])

  const hoy = [
    doc('Drones rusos sobre Polonia', '2026-09-01'),
    doc('Polonia cierra su espacio aereo por drones', '2026-09-01', 'hn'),
    doc('La OTAN se reune por los drones en Polonia', '2026-09-01', 'trends'),
    doc('Resultados de la liga de futbol', '2026-09-01'),
  ]

  it('saca lo que se sale de la costumbre y deja fuera la rutina', () => {
    const emergentes = detectarEmergentes([...historia, ...hoy], '2026-09-01')
    const terminos = emergentes.map((e) => e.termino)
    expect(terminos).toContain('polonia')
    expect(terminos).toContain('drones')
    expect(terminos).not.toContain('futbol')
  })

  it('ordena por desviación y respeta el tope', () => {
    const emergentes = detectarEmergentes([...historia, ...hoy], '2026-09-01', { maximo: 2 })
    expect(emergentes).toHaveLength(2)
    expect(emergentes[0].zScore).toBeGreaterThanOrEqual(emergentes[1].zScore)
  })

  it('exige un mínimo de menciones para no perseguir apariciones sueltas', () => {
    const emergentes = detectarEmergentes([...historia, ...hoy], '2026-09-01', { minMenciones: 4 })
    expect(emergentes).toEqual([])
  })

  it('sin documentos de hoy no inventa nada', () => {
    expect(detectarEmergentes(historia, '2026-09-01')).toEqual([])
  })
})

describe('normalizarJuicio', () => {
  it('acota la relevancia al rango declarado', () => {
    expect(normalizarJuicio({ relevancia: 9, tema: 'guerra', resumen: 'x' }).relevancia).toBe(5)
    expect(normalizarJuicio({ relevancia: 0, tema: 'guerra', resumen: 'x' }).relevancia).toBe(1)
  })

  it('un tema inventado por el modelo se descarta en vez de guardarse', () => {
    expect(normalizarJuicio({ relevancia: 4, tema: 'deportes', resumen: 'x' }).tema).toBeNull()
    expect(normalizarJuicio({ relevancia: 4, tema: 'otan', resumen: 'x' }).tema).toBe('otan')
  })

  it('una respuesta ilegible degrada a irrelevante, no a alarma', () => {
    expect(normalizarJuicio(null)).toEqual({ relevancia: 1, tema: null, resumen: 'respuesta ilegible' })
    expect(normalizarJuicio({}).relevancia).toBe(1)
  })
})
