import { describe, expect, it } from 'vitest'
import { variacion12m } from '@/lib/alertas/debasement'

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
