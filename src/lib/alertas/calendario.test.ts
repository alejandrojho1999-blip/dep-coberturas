import { describe, expect, it } from 'vitest'
import {
  enVentanaPublicacion,
  EVENTOS,
  eventoEnCurso,
  formatearFalta,
  FUENTE_EVENTO,
  hitoAlcanzado,
  instanteUtc,
  proximoEvento,
} from '@/lib/alertas/calendario'

describe('instanteUtc', () => {
  it('un FOMC de verano son las 18:00 UTC (14:00 EDT)', () => {
    const e = EVENTOS.find((x) => x.fechaET === '2026-09-16')!
    expect(instanteUtc(e).toISOString()).toBe('2026-09-16T18:00:00.000Z')
  })

  it('un FOMC de invierno son las 19:00 UTC (14:00 EST)', () => {
    const e = EVENTOS.find((x) => x.fechaET === '2026-12-09')!
    expect(instanteUtc(e).toISOString()).toBe('2026-12-09T19:00:00.000Z')
  })

  it('el IPC sale a las 8:30 ET', () => {
    const e = EVENTOS.find((x) => x.fechaET === '2026-09-11')!
    expect(instanteUtc(e).toISOString()).toBe('2026-09-11T12:30:00.000Z')
  })
})

describe('proximoEvento', () => {
  const ahora = new Date('2026-09-01T00:00:00Z')

  it('devuelve el siguiente de cualquier tipo', () => {
    expect(proximoEvento('todos', ahora)?.fechaET).toBe('2026-09-11')
  })

  it('filtra por tipo', () => {
    expect(proximoEvento('fomc', ahora)?.fechaET).toBe('2026-09-16')
  })

  it('ignora los ya pasados', () => {
    expect(proximoEvento('cpi', new Date('2026-09-11T13:00:00Z'))?.fechaET).toBe('2026-10-14')
  })

  it('devuelve null cuando se agota el calendario', () => {
    expect(proximoEvento('todos', new Date('2030-01-01T00:00:00Z'))).toBeNull()
  })
})

describe('formatearFalta', () => {
  it('usa días y horas para los plazos largos', () => {
    expect(formatearFalta(1500)).toBe('1 d 1 h')
  })

  it('usa horas y minutos por debajo del día', () => {
    expect(formatearFalta(75)).toBe('1 h 15 min')
  })

  it('usa solo minutos en la última hora', () => {
    expect(formatearFalta(14.6)).toBe('15 min')
  })

  it('nunca devuelve negativos', () => {
    expect(formatearFalta(-10)).toBe('0 min')
  })
})

describe('hitoAlcanzado', () => {
  it('detecta el aviso de 24 horas', () => {
    expect(hitoAlcanzado(1438)).toBe(1440)
  })

  it('detecta el de una hora y el de quince minutos', () => {
    expect(hitoAlcanzado(58)).toBe(60)
    expect(hitoAlcanzado(13)).toBe(15)
  })

  it('no dispara fuera de la ventana del cron', () => {
    expect(hitoAlcanzado(1400)).toBeNull()
    expect(hitoAlcanzado(200)).toBeNull()
    expect(hitoAlcanzado(2)).toBeNull()
  })
})

describe('ventana de publicación', () => {
  const fomc = EVENTOS.find((x) => x.fechaET === '2026-09-16')!

  it('está en ventana justo después de la hora', () => {
    expect(enVentanaPublicacion(fomc, new Date('2026-09-16T18:05:00Z'))).toBe(true)
  })

  it('no lo está antes de la hora', () => {
    expect(enVentanaPublicacion(fomc, new Date('2026-09-16T17:59:00Z'))).toBe(false)
  })

  it('no lo está pasada la ventana', () => {
    expect(enVentanaPublicacion(fomc, new Date('2026-09-16T19:00:00Z'))).toBe(false)
  })

  it('eventoEnCurso encuentra el evento vivo', () => {
    expect(eventoEnCurso(new Date('2026-09-16T18:10:00Z'))?.tipo).toBe('fomc')
    expect(eventoEnCurso(new Date('2026-09-16T23:00:00Z'))).toBeNull()
  })
})

describe('FUENTE_EVENTO', () => {
  it('cubre todos los tipos de evento del calendario', () => {
    for (const evento of EVENTOS) {
      expect(FUENTE_EVENTO[evento.tipo]).toBeDefined()
    }
  })

  it('apunta al organismo que publica cada dato', () => {
    expect(FUENTE_EVENTO.fomc.url).toContain('federalreserve.gov')
    expect(FUENTE_EVENTO.cpi.url).toContain('bls.gov')
  })

  it('todas las fuentes son https absolutas', () => {
    for (const { url, fuente } of Object.values(FUENTE_EVENTO)) {
      expect(url.startsWith('https://')).toBe(true)
      expect(fuente.length).toBeGreaterThan(0)
    }
  })
})
