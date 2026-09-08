import { describe, expect, it } from 'vitest'
import {
  CICLOS_PARA_AVISAR,
  FUENTES_PULSO,
  evaluarFuentes,
  mensajeVigilancia,
  type EstadoVigilancia,
} from '@/lib/pulso/vigilancia'
import type { FuentePulso } from '@/lib/pulso/tipos'

/** Todas menos las que se pasen: el caso normal es que casi todas estén vivas. */
function vivasSalvo(...caidas: FuentePulso[]): FuentePulso[] {
  return FUENTES_PULSO.filter((f) => !caidas.includes(f))
}

describe('evaluarFuentes', () => {
  it('deja la cuenta a cero cuando las seis traen datos', () => {
    const { estado, cambios } = evaluarFuentes({}, [...FUENTES_PULSO])

    expect(Object.values(estado)).toEqual([0, 0, 0, 0, 0, 0])
    expect(cambios).toEqual({ caidas: [], recuperadas: [] })
  })

  it('cuenta los ciclos seguidos sin avisar por debajo del umbral', () => {
    let estado: EstadoVigilancia = {}
    for (let ciclo = 1; ciclo < CICLOS_PARA_AVISAR; ciclo++) {
      const paso = evaluarFuentes(estado, vivasSalvo('youtube'))
      estado = paso.estado
      expect(paso.cambios.caidas).toEqual([])
    }
    expect(estado.youtube).toBe(CICLOS_PARA_AVISAR - 1)
  })

  it('avisa al cruzar el umbral y no vuelve a avisar mientras siga caída', () => {
    let estado: EstadoVigilancia = {}
    const avisos: FuentePulso[][] = []

    // La caída del 2026-09-08 duró ocho ciclos: solo el cuarto debe avisar.
    for (let ciclo = 1; ciclo <= 8; ciclo++) {
      const paso = evaluarFuentes(estado, vivasSalvo('youtube'))
      estado = paso.estado
      if (paso.cambios.caidas.length) avisos.push(paso.cambios.caidas)
    }

    expect(avisos).toEqual([['youtube']])
    expect(estado.youtube).toBe(8)
  })

  it('anuncia la vuelta solo de lo que se había dado por caído', () => {
    const previo: EstadoVigilancia = { youtube: CICLOS_PARA_AVISAR + 2, hn: 2 }
    const { estado, cambios } = evaluarFuentes(previo, [...FUENTES_PULSO])

    expect(cambios.recuperadas).toEqual(['youtube'])
    expect(estado.youtube).toBe(0)
    expect(estado.hn).toBe(0)
  })

  it('vigila varias fuentes a la vez sin mezclarlas', () => {
    let estado: EstadoVigilancia = {}
    for (let ciclo = 1; ciclo <= CICLOS_PARA_AVISAR; ciclo++) {
      estado = evaluarFuentes(estado, vivasSalvo('youtube', 'mastodon')).estado
    }
    expect(estado.youtube).toBe(CICLOS_PARA_AVISAR)
    expect(estado.mastodon).toBe(CICLOS_PARA_AVISAR)
    expect(estado.trends).toBe(0)
  })

  it('respeta un umbral distinto del de por defecto', () => {
    const { cambios } = evaluarFuentes({ youtube: 1 }, vivasSalvo('youtube'), 2)
    expect(cambios.caidas).toEqual(['youtube'])
  })
})

describe('mensajeVigilancia', () => {
  it('no dice nada cuando no hay cambios', () => {
    expect(mensajeVigilancia({ caidas: [], recuperadas: [] })).toBeNull()
  })

  it('traduce los ciclos a horas', () => {
    const texto = mensajeVigilancia({ caidas: ['youtube'], recuperadas: [] })
    expect(texto).toContain('youtube')
    expect(texto).toContain('2 h')
  })

  it('junta caída y recuperación en un solo mensaje', () => {
    const texto = mensajeVigilancia({ caidas: ['hn'], recuperadas: ['youtube'] })
    expect(texto).toContain('hn')
    expect(texto).toContain('youtube')
    expect(texto?.split('\n')).toHaveLength(2)
  })
})
