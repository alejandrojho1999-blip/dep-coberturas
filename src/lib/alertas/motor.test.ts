import { afterEach, describe, expect, it, vi } from 'vitest'
import { horaEnEcuador, SALTO_PROB_RELEVANTE, tocaDigest } from '@/lib/alertas/motor'

afterEach(() => vi.useRealTimers())

describe('horaEnEcuador', () => {
  it('convierte UTC a la hora local de Guayaquil', () => {
    // Ecuador está en UTC-5 todo el año.
    expect(horaEnEcuador(new Date('2026-08-31T13:00:00Z'))).toBe(8)
    expect(horaEnEcuador(new Date('2026-08-31T03:00:00Z'))).toBe(22)
    expect(horaEnEcuador(new Date('2026-08-31T05:00:00Z'))).toBe(0)
  })
})

describe('tocaDigest', () => {
  const ochoAm = new Date('2026-08-31T13:00:00Z')
  const mediodia = new Date('2026-08-31T17:00:00Z')

  it('envía en la franja programada', () => {
    expect(tocaDigest({ ahora: ochoAm, ultimoTomadoAt: null, probSubidaActual: 40, probSubidaPrevia: 40 }))
      .toEqual({ enviar: true, motivo: 'digest-programado' })
  })

  it('no repite dentro de la misma franja', () => {
    const d = tocaDigest({
      ahora: ochoAm,
      ultimoTomadoAt: '2026-08-31T13:30:00Z',
      probSubidaActual: 40,
      probSubidaPrevia: 40,
    })
    expect(d).toEqual({ enviar: false, motivo: 'ya-enviado-esta-franja' })
  })

  it('calla fuera de las franjas si nada se mueve', () => {
    expect(tocaDigest({ ahora: mediodia, ultimoTomadoAt: null, probSubidaActual: 40, probSubidaPrevia: 38 }).enviar)
      .toBe(false)
  })

  it('un salto grande de probabilidad rompe el horario', () => {
    const d = tocaDigest({
      ahora: mediodia,
      ultimoTomadoAt: '2026-08-31T16:00:00Z',
      probSubidaActual: 40 + SALTO_PROB_RELEVANTE,
      probSubidaPrevia: 40,
    })
    expect(d).toEqual({ enviar: true, motivo: 'salto-probabilidad' })
  })

  it('una caída grande también avisa', () => {
    expect(tocaDigest({ ahora: mediodia, ultimoTomadoAt: null, probSubidaActual: 10, probSubidaPrevia: 45 }).enviar)
      .toBe(true)
  })

  it('sin foto previa no compara saltos', () => {
    expect(tocaDigest({ ahora: mediodia, ultimoTomadoAt: null, probSubidaActual: 90, probSubidaPrevia: null }).enviar)
      .toBe(false)
  })
})
