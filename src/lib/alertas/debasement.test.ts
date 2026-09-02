import { describe, expect, it } from 'vitest'
import { metricaDesde, variacion12m } from '@/lib/alertas/debasement'

describe('variacion12m', () => {
  it('calcula la variación contra la observación de hace un año', () => {
    const r = variacion12m([
      { date: '2025-08-01', value: 100 },
      { date: '2026-02-01', value: 105 },
      { date: '2026-08-01', value: 110 },
    ])
    expect(r.ultimo?.value).toBe(110)
    expect(r.var12mPct).toBeCloseTo(10, 6)
  })

  it('sin historia de un año devuelve null', () => {
    const r = variacion12m([{ date: '2026-07-01', value: 100 }, { date: '2026-08-01', value: 110 }])
    expect(r.var12mPct).toBeNull()
  })

  it('sin observaciones devuelve nulos', () => {
    expect(variacion12m([])).toEqual({ ultimo: null, var12mPct: null })
  })

  it('una base cero no produce infinitos', () => {
    const r = variacion12m([{ date: '2025-01-01', value: 0 }, { date: '2026-08-01', value: 5 }])
    expect(r.var12mPct).toBeNull()
  })
})

describe('metricaDesde', () => {
  const doceMeses = [
    { date: '2025-08-01', value: 100 },
    { date: '2026-08-01', value: 103 },
  ]

  it('una serie de nivel publica el nivel y conserva la variación debajo', () => {
    const m = metricaDesde(
      { id: 'DFII10', clave: 'tasa_real', etiqueta: 'Tasa real 10 años (TIPS)', unidad: '%', lectura: 'nivel' },
      [{ date: '2025-08-01', value: 2 }, { date: '2026-08-01', value: 1.9 }],
    )
    expect(m?.valor).toBeCloseTo(1.9, 6)
    expect(m?.var12mPct).toBeCloseTo(-5, 6)
  })

  it('una serie de variación publica el porcentaje como valor', () => {
    const m = metricaDesde(
      { id: 'CPIAUCSL', clave: 'ipc', etiqueta: 'Inflación IPC (interanual)', unidad: '%', lectura: 'var12m' },
      doceMeses,
    )
    expect(m?.valor).toBeCloseTo(3, 6)
    expect(m?.unidad).toBe('%')
    // Ya es la variación: repetirla debajo diría dos veces lo mismo.
    expect(m?.var12mPct).toBeNull()
  })

  it('sin un año de historia, una serie de variación no se publica', () => {
    const m = metricaDesde(
      { id: 'CPILFESL', clave: 'ipc_core', etiqueta: 'IPC subyacente (interanual)', unidad: '%', lectura: 'var12m' },
      [{ date: '2026-07-01', value: 100 }, { date: '2026-08-01', value: 101 }],
    )
    expect(m).toBeNull()
  })

  it('sin observaciones no se publica nada, sea cual sea la lectura', () => {
    for (const lectura of ['nivel', 'var12m'] as const) {
      expect(metricaDesde({ id: 'X', clave: 'x', etiqueta: 'X', unidad: '%', lectura }, [])).toBeNull()
    }
  })
})
