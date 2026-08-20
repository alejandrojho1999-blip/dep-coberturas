import { describe, it, expect } from 'vitest'
import { hasFabricatedEntryPrice } from './legacy-entry-price'

describe('hasFabricatedEntryPrice()', () => {
  it('detecta el caso APA reportado en producción', () => {
    // Objetivo $48.50 → la entrada guardada fue 48.50 / 1.15 = 42.17,
    // con el mercado cotizando a 44.40.
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH',
      precio_entrada: 42.17,
      precio_objetivo: 48.50,
      ai_report: { conviction: 8 },
    })).toBe(true)
  })

  it('no marca una fila cuyo objetivo viene del consenso', () => {
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH',
      precio_entrada: 44.40,
      precio_objetivo: 52.00,
      ai_report: { objetivo_fuente: 'consenso' },
    })).toBe(false)
  })

  it('no marca una fila nueva aunque el objetivo sea exactamente +15%', () => {
    // El fallback actual también genera entrada × 1.15, pero la entrada es el
    // precio real y la fila declara su origen.
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH',
      precio_entrada: 100,
      precio_objetivo: 115,
      ai_report: { objetivo_fuente: 'fallback' },
    })).toBe(false)
  })

  it('ignora las recomendaciones de otros agentes', () => {
    expect(hasFabricatedEntryPrice({
      category: 'SMALL_CAPS',
      precio_entrada: 42.17,
      precio_objetivo: 48.50,
      ai_report: {},
    })).toBe(false)
    expect(hasFabricatedEntryPrice({
      category: 'OPTIONS_GAMMA',
      precio_entrada: 42.17,
      precio_objetivo: 48.50,
      ai_report: {},
    })).toBe(false)
  })

  it('no marca una fila cuyo objetivo no guarda la relación 1.15', () => {
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH',
      precio_entrada: 44.40,
      precio_objetivo: 48.50,
      ai_report: {},
    })).toBe(false)
  })

  it('tolera el redondeo a dos decimales de ambos precios', () => {
    // 37.83 × 1.15 = 43.5045, que se guardó redondeado como 43.50.
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH',
      precio_entrada: 37.83,
      precio_objetivo: 43.50,
      ai_report: {},
    })).toBe(true)
  })

  it('no marca filas sin precio de entrada o sin objetivo', () => {
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH', precio_entrada: null, precio_objetivo: 48.50, ai_report: {},
    })).toBe(false)
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH', precio_entrada: 42.17, precio_objetivo: null, ai_report: {},
    })).toBe(false)
  })

  it('soporta ai_report nulo o ausente', () => {
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH', precio_entrada: 42.17, precio_objetivo: 48.50, ai_report: null,
    })).toBe(true)
    expect(hasFabricatedEntryPrice({
      category: 'PETER_LYNCH', precio_entrada: 42.17, precio_objetivo: 48.50,
    })).toBe(true)
  })
})
