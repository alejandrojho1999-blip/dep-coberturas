import { afterEach, describe, expect, it } from 'vitest'
import {
  cooldownMin,
  decidirEnvio,
  maxMensajesHora,
  severidadMinimaEnvio,
  type EstadoEvento,
} from '@/lib/alertas/dedupe'

const AHORA = new Date('2026-08-31T15:00:00Z')

function estado(minutosAtras: number, maxSeveridad = 3): EstadoEvento {
  return {
    eventoKey: 'dron-polonia',
    ultimaVez: new Date(AHORA.getTime() - minutosAtras * 60_000).toISOString(),
    maxSeveridad,
  }
}

afterEach(() => {
  delete process.env.ALERTAS_COOLDOWN_MIN
  delete process.env.ALERTAS_MAX_MSG_HORA
  delete process.env.ALERTAS_SEVERIDAD_MINIMA
})

describe('decidirEnvio', () => {
  it('un evento nunca visto se envía', () => {
    const d = decidirEnvio({ eventoKey: 'dron-polonia', severidad: 3, estado: null, enviadosUltimaHora: 0, ahora: AHORA })
    expect(d).toEqual({ enviar: true, motivo: 'nuevo' })
  })

  it('el mismo evento dentro del enfriamiento se calla', () => {
    const d = decidirEnvio({ eventoKey: 'dron-polonia', severidad: 3, estado: estado(10), enviadosUltimaHora: 1, ahora: AHORA })
    expect(d).toEqual({ enviar: false, motivo: 'en-enfriamiento' })
  })

  it('pasado el enfriamiento vuelve a enviarse', () => {
    const d = decidirEnvio({ eventoKey: 'dron-polonia', severidad: 3, estado: estado(50), enviadosUltimaHora: 1, ahora: AHORA })
    expect(d.enviar).toBe(true)
  })

  it('una escalada rompe el enfriamiento', () => {
    const d = decidirEnvio({ eventoKey: 'dron-polonia', severidad: 5, estado: estado(2, 3), enviadosUltimaHora: 1, ahora: AHORA })
    expect(d).toEqual({ enviar: true, motivo: 'escalada' })
  })

  it('el tope horario silencia lo demás', () => {
    const d = decidirEnvio({ eventoKey: 'otro-evento', severidad: 3, estado: null, enviadosUltimaHora: 6, ahora: AHORA })
    expect(d).toEqual({ enviar: false, motivo: 'tope-horario' })
  })

  it('una escalada pasa por encima del tope horario', () => {
    const d = decidirEnvio({ eventoKey: 'dron-polonia', severidad: 5, estado: estado(2, 3), enviadosUltimaHora: 20, ahora: AHORA })
    expect(d.enviar).toBe(true)
  })

  it('una última fecha corrupta no bloquea el aviso', () => {
    const d = decidirEnvio({
      eventoKey: 'dron-polonia',
      severidad: 3,
      estado: { eventoKey: 'dron-polonia', ultimaVez: 'ayer', maxSeveridad: 3 },
      enviadosUltimaHora: 0,
      ahora: AHORA,
    })
    expect(d.enviar).toBe(true)
  })
})

describe('suelo de severidad', () => {
  it('un hecho menor no suena aunque sea nuevo', () => {
    const d = decidirEnvio({ eventoKey: 'declaracion-tensa', severidad: 2, estado: null, enviadosUltimaHora: 0, ahora: AHORA })
    expect(d).toEqual({ enviar: false, motivo: 'bajo-umbral' })
  })

  it('el suelo manda incluso sobre una escalada', () => {
    const d = decidirEnvio({
      eventoKey: 'dron-polonia',
      severidad: 2,
      estado: estado(2, 1),
      enviadosUltimaHora: 0,
      ahora: AHORA,
    })
    expect(d.motivo).toBe('bajo-umbral')
  })

  it('el peldaño 3 sí pasa', () => {
    const d = decidirEnvio({ eventoKey: 'incursion-estonia', severidad: 3, estado: null, enviadosUltimaHora: 0, ahora: AHORA })
    expect(d).toEqual({ enviar: true, motivo: 'nuevo' })
  })

  it('el suelo se puede bajar por entorno', () => {
    const d = decidirEnvio({
      eventoKey: 'declaracion-tensa',
      severidad: 1,
      estado: null,
      enviadosUltimaHora: 0,
      ahora: AHORA,
      severidadMinima: 1,
    })
    expect(d.enviar).toBe(true)
  })
})

describe('configuración por entorno', () => {
  it('usa los valores por defecto', () => {
    expect(cooldownMin()).toBe(45)
    expect(maxMensajesHora()).toBe(6)
    expect(severidadMinimaEnvio()).toBe(3)
  })

  it('respeta las variables válidas e ignora las absurdas', () => {
    process.env.ALERTAS_COOLDOWN_MIN = '20'
    process.env.ALERTAS_MAX_MSG_HORA = '0'
    process.env.ALERTAS_SEVERIDAD_MINIMA = '9'
    expect(cooldownMin()).toBe(20)
    expect(maxMensajesHora()).toBe(6)
    expect(severidadMinimaEnvio()).toBe(3)
  })
})
