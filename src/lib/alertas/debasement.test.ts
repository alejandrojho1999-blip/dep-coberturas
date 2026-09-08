import { describe, expect, it } from 'vitest'
import { DIAS_DE_HISTORIA, metricaDesde, variacion12m } from '@/lib/alertas/debasement'

/**
 * Serie mensual como la publica FRED: un dato el día 1 de cada mes, con
 * `mesesDeRetraso` de demora respecto a hoy, recortada a la ventana que se pide.
 */
function serieMensual(hoy: Date, diasDeVentana: number, mesesDeRetraso: number) {
  const desde = new Date(hoy.getTime() - diasDeVentana * 86_400_000)
  const ultimo = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - mesesDeRetraso, 1)

  const obs: Array<{ date: string; value: number }> = []
  for (let i = 30; i >= 0; i--) {
    const d = new Date(ultimo)
    d.setUTCMonth(d.getUTCMonth() - i)
    if (d >= desde) obs.push({ date: d.toISOString().slice(0, 10), value: 100 + (30 - i) })
  }
  return obs
}

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

  // El IPC sale con unos dos meses de retraso, así que su objetivo interanual
  // queda casi catorce meses atrás. Con los 400 días que se pedían antes, la
  // observación con la que comparar caía fuera de la ventana y las dos series de
  // IPC desaparecían del panel con «sin observaciones suficientes».
  it('la ventana que se pide cubre una serie mensual publicada con retraso', () => {
    const hoy = new Date('2026-09-09T00:00:00Z')

    const corta = variacion12m(serieMensual(hoy, 400, 2))
    expect(corta.var12mPct).toBeNull()

    const actual = variacion12m(serieMensual(hoy, DIAS_DE_HISTORIA, 2))
    expect(actual.var12mPct).not.toBeNull()
  })

  it('aguanta un retraso de publicación de tres meses', () => {
    const hoy = new Date('2026-09-09T00:00:00Z')
    expect(variacion12m(serieMensual(hoy, DIAS_DE_HISTORIA, 3)).var12mPct).not.toBeNull()
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
