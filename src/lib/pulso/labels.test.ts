import { describe, expect, it } from 'vitest'
import type { Vela } from '@/lib/alertas/atr'
import { etiquetasGeopoliticas, etiquetasMercado, VENTANA_DIAS } from '@/lib/pulso/labels'
import { construirVectores, comoFila, FEATURES } from '@/lib/pulso/features'
import type { FilaKeyword, FilaObservacion } from '@/lib/pulso/persistencia'

function vela(date: string, close: number): Vela {
  return { date, high: close * 1.01, low: close * 0.99, close }
}

/** Diez días laborables consecutivos, para no pelearme con fines de semana. */
const DIAS = Array.from({ length: 12 }, (_, i) => `2026-08-${String(i + 3).padStart(2, '0')}`)

describe('etiquetasMercado', () => {
  it('marca el día previo a una caída del SPY', () => {
    const spy = DIAS.map((d, i) => vela(d, i === 6 ? 90 : 100))
    const vix = DIAS.map((d) => vela(d, 15))

    const etiquetas = etiquetasMercado(spy, vix)
    // El día 1 tiene el desplome dentro de su ventana de cinco sesiones.
    expect(etiquetas.find((e) => e.dia === DIAS[1])?.etiqueta).toBe(1)
    // El día 0 lo tiene fuera: la sexta sesión ya no cuenta.
    expect(etiquetas.find((e) => e.dia === DIAS[0])?.etiqueta).toBe(0)
  })

  it('marca también por salto del VIX aunque el SPY aguante', () => {
    const spy = DIAS.map((d) => vela(d, 100))
    const vix = DIAS.map((d, i) => vela(d, i === 4 ? 30 : 15))

    const etiquetas = etiquetasMercado(spy, vix)
    expect(etiquetas.find((e) => e.dia === DIAS[1])?.etiqueta).toBe(1)
  })

  it('un mercado plano no genera ninguna alarma', () => {
    const spy = DIAS.map((d) => vela(d, 100))
    const vix = DIAS.map((d) => vela(d, 15))
    expect(etiquetasMercado(spy, vix).every((e) => e.etiqueta === 0)).toBe(true)
  })

  it('no etiqueta días cuya ventana todavía no ha cerrado', () => {
    const spy = DIAS.map((d) => vela(d, 100))
    const vix = DIAS.map((d) => vela(d, 15))
    const etiquetas = etiquetasMercado(spy, vix)

    expect(etiquetas).toHaveLength(DIAS.length - VENTANA_DIAS)
    // Los últimos cinco días no pueden estar: su futuro aún no ha ocurrido.
    for (const d of DIAS.slice(-VENTANA_DIAS)) {
      expect(etiquetas.find((e) => e.dia === d)).toBeUndefined()
    }
  })

  it('deja constancia de los umbrales con los que se etiquetó', () => {
    const spy = DIAS.map((d) => vela(d, 100))
    const vix = DIAS.map((d) => vela(d, 15))
    const [primera] = etiquetasMercado(spy, vix)
    expect(primera.detalle.umbrales).toMatchObject({ ventanaDias: VENTANA_DIAS })
  })
})

describe('etiquetasGeopoliticas', () => {
  function kw(dia: string, termino: string, relevancia: number): FilaKeyword {
    return {
      dia, termino, fuentes: ['news'], menciones: 5, zScore: 3,
      relevancia, tema: 'otan', resumen: 'x', ejemploUrl: null,
    }
  }

  it('marca los días cuya ventana contiene un término muy relevante', () => {
    const etiquetas = etiquetasGeopoliticas(DIAS, [kw(DIAS[6], 'suwalki', 5)])
    expect(etiquetas.find((e) => e.dia === DIAS[1])?.etiqueta).toBe(1)
    expect(etiquetas.find((e) => e.dia === DIAS[0])?.etiqueta).toBe(0)
  })

  it('un término de relevancia baja no dispara nada', () => {
    const etiquetas = etiquetasGeopoliticas(DIAS, [kw(DIAS[3], 'ryan garcia', 2)])
    expect(etiquetas.every((e) => e.etiqueta === 0)).toBe(true)
  })

  it('declara que la etiqueta viene del juicio del modelo, no de un hecho medido', () => {
    const [primera] = etiquetasGeopoliticas(DIAS, [])
    expect(String(primera.detalle.fuente)).toContain('modelo de lenguaje')
  })
})

describe('construirVectores', () => {
  function obs(
    fuente: FilaObservacion['fuente'],
    termino: string,
    valor: number,
    dia: string,
    geo: string | null = null,
  ): FilaObservacion {
    return {
      fuente, geo, termino, valor, unidad: 'u',
      capturadoAt: `${dia}T12:00:00.000Z`,
      metadatos: {},
    }
  }

  it('devuelve un vector por día con todas las features presentes', () => {
    const observaciones = DIAS.flatMap((d) => [
      obs('trends', 'x', 100, d, 'PL'),
      obs('wikipedia', 'nato', 500, d),
      obs('news', 'otan-rusia', 10, d),
    ])

    const vectores = construirVectores(observaciones)
    expect(vectores).toHaveLength(DIAS.length)
    expect(Object.keys(vectores[0].vector).sort()).toEqual([...FEATURES].sort())
  })

  it('el primer día sale a cero porque no tiene pasado contra el que compararse', () => {
    const observaciones = DIAS.map((d) => obs('wikipedia', 'nato', 500, d))
    const [primero] = construirVectores(observaciones)
    expect(primero.vector.wiki_guerra).toBe(0)
  })

  it('un pico se refleja como z-score alto en su feature y no en las demás', () => {
    const observaciones = DIAS.map((d, i) => obs('wikipedia', 'nato', i === 11 ? 50_000 : 500, d))
    const vectores = construirVectores(observaciones)
    const ultimo = vectores.at(-1)!

    expect(ultimo.vector.wiki_guerra).toBeGreaterThan(2)
    expect(ultimo.vector.wiki_macro).toBe(0)
  })

  it('cuenta cuántas fuentes aportaron cada día', () => {
    const observaciones = [
      obs('trends', 'x', 1, DIAS[0], 'PL'),
      obs('news', 'macro', 1, DIAS[0]),
      obs('trends', 'x', 1, DIAS[1], 'PL'),
    ]
    const vectores = construirVectores(observaciones)
    expect(vectores.find((v) => v.dia === DIAS[0])?.nFuentes).toBe(2)
    expect(vectores.find((v) => v.dia === DIAS[1])?.nFuentes).toBe(1)
  })

  it('respeta el día declarado por la fuente en vez del de la captura', () => {
    const observacion: FilaObservacion = {
      fuente: 'wikipedia', geo: null, termino: 'nato', valor: 100, unidad: 'vistas',
      capturadoAt: '2026-09-01T12:00:00.000Z',
      metadatos: { dia: '2026-08-30' },
    }
    expect(construirVectores([observacion])[0].dia).toBe('2026-08-30')
  })

  it('comoFila respeta el orden que espera el modelo y rellena lo ausente', () => {
    expect(comoFila({ trends_otan: 3 })).toHaveLength(FEATURES.length)
    expect(comoFila({ trends_otan: 3 })[FEATURES.indexOf('trends_otan')]).toBe(3)
    expect(comoFila({})).toEqual(FEATURES.map(() => 0))
  })
})
