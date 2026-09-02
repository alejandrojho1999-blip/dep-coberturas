import { describe, expect, it } from 'vitest'
import {
  apareceEn,
  normalizarCifra,
  validarTrazabilidad,
  valoracionRespaldada,
} from './trazabilidad'
import type { TrazaDato } from './types'

const adjuntos = [
  { filename: 'guidance.xlsx', texto_extraido: '[Q3]\nIngresos,1.234,50\nMargen neto,18,4%' },
  { filename: 'memoria.pdf', texto_extraido: 'El EBITDA alcanzó los $2,850.00 millones.' },
]

const traza = (over: Partial<TrazaDato>): TrazaDato => ({
  dato: 'Ingresos Q3',
  valor: '1234.5',
  archivo: 'guidance.xlsx',
  ubicacion: 'hoja Q3',
  ...over,
})

describe('normalizarCifra', () => {
  it('trata el formato europeo y el americano como el mismo número', () => {
    expect(normalizarCifra('1.234,50')).toBe(normalizarCifra('1,234.50'))
    expect(normalizarCifra('$1,234.50')).toBe('1234.5')
  })

  it('ignora símbolos y ceros decimales que no cambian el valor', () => {
    expect(normalizarCifra(' 18,40 % ')).toBe('18.4')
    expect(normalizarCifra('2850')).toBe('2850')
  })
})

describe('apareceEn', () => {
  it('encuentra la cifra aunque el archivo la escriba con otro formato', () => {
    expect(apareceEn('1234.5', adjuntos[0].texto_extraido)).toBe(true)
    expect(apareceEn('2850', adjuntos[1].texto_extraido)).toBe(true)
  })

  it('no da por buena una cifra que solo aparece como trozo de otra', () => {
    // «12» vive dentro de «1.234,50», pero nadie escribió 12 en ese archivo.
    expect(apareceEn('12', adjuntos[0].texto_extraido)).toBe(false)
  })

  it('rechaza lo que no está', () => {
    expect(apareceEn('9999', adjuntos[0].texto_extraido)).toBe(false)
    expect(apareceEn('', adjuntos[0].texto_extraido)).toBe(false)
  })
})

describe('validarTrazabilidad', () => {
  it('acepta la cifra que sí está en el archivo citado', () => {
    const r = validarTrazabilidad([traza({})], adjuntos)
    expect(r.verificados).toHaveLength(1)
    expect(r.verificados[0].verificado).toBe(true)
    expect(r.descartados).toBe(0)
  })

  it('descarta un archivo que nadie subió', () => {
    const r = validarTrazabilidad([traza({ archivo: 'inventado.xlsx' })], adjuntos)
    expect(r.verificados).toHaveLength(0)
    expect(r.descartados).toBe(1)
  })

  it('descarta la cifra que no aparece en el archivo que dice citar', () => {
    const r = validarTrazabilidad([traza({ valor: '7777' })], adjuntos)
    expect(r.verificados).toHaveLength(0)
    expect(r.descartados).toBe(1)
  })

  it('descarta la cifra que está, pero en otro archivo', () => {
    const r = validarTrazabilidad([traza({ valor: '2850' })], adjuntos)
    expect(r.descartados).toBe(1)
  })

  it('sin trazabilidad no revienta', () => {
    expect(validarTrazabilidad(undefined, adjuntos)).toEqual({ verificados: [], descartados: 0 })
    expect(validarTrazabilidad([], adjuntos)).toEqual({ verificados: [], descartados: 0 })
  })
})

describe('valoracionRespaldada', () => {
  const valoracion = {
    metodo: 'DCF',
    supuestos: ['WACC 9 %'],
    valor_por_accion: 210,
    upside_pct: 14,
  }

  it('deja pasar la valoración cuando hay al menos una cifra verificada', () => {
    expect(valoracionRespaldada(valoracion, [traza({ verificado: true })])).toEqual(valoracion)
  })

  it('la retira cuando nada la sostiene', () => {
    expect(valoracionRespaldada(valoracion, [])).toBeUndefined()
  })

  it('una valoración sin cifra es cualitativa y no necesita respaldo', () => {
    const cualitativa = { ...valoracion, valor_por_accion: null }
    expect(valoracionRespaldada(cualitativa, [])).toEqual(cualitativa)
  })
})
