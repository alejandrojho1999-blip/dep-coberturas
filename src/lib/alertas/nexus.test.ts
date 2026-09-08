/**
 * El contrato de respuesta del puente.
 *
 * Lo que se fija aquí es la distinción que costó cuatro días de alertas
 * perdidas: **aceptado no es entregado**. El puente antiguo respondía `202`
 * antes de intentar el envío, así que un mensaje emitido con la sesión de
 * WhatsApp caída se registraba como bueno y se perdía sin dejar rastro. El
 * puente nuevo responde después de saberlo y distingue tres desenlaces; estas
 * pruebas impiden que el lado de la aplicación vuelva a confundirlos.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enviarNexus, nexusConfigurado } from '@/lib/alertas/nexus'

vi.mock('@/lib/alertas/canal', () => ({
  estadoCanal: vi.fn(async () => ({ estado: 'vivo', detalle: 'linea de estado simulada' })),
}))

const { estadoCanal } = await import('@/lib/alertas/canal')

const URL_PUENTE = 'http://127.0.0.1:9091/webhook/liberty-trading'

/** Respuesta del puente con el cuerpo y el código que se quieran probar. */
function responde(status: number, cuerpo: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
    text: async () => JSON.stringify(cuerpo),
  })) as unknown as typeof fetch
}

beforeEach(() => {
  process.env.NEXUS_WEBHOOK_URL = URL_PUENTE
  process.env.NEXUS_WEBHOOK_TOKEN = 'token-de-prueba'
  vi.mocked(estadoCanal).mockResolvedValue({ estado: 'vivo', detalle: 'linea de estado simulada' })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXUS_WEBHOOK_URL
  delete process.env.NEXUS_WEBHOOK_TOKEN
})

describe('nexusConfigurado', () => {
  it('exige la URL y el token', () => {
    expect(nexusConfigurado()).toBe(true)

    delete process.env.NEXUS_WEBHOOK_TOKEN
    expect(nexusConfigurado()).toBe(false)
  })
})

describe('enviarNexus', () => {
  it('sin configuración no llama al puente y lo dice', async () => {
    delete process.env.NEXUS_WEBHOOK_URL
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const r = await enviarNexus('hola')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(r.aceptado).toBe(false)
    expect(r.entregado).toBe(false)
    expect(r.error).toMatch(/no configurados/)
  })

  it('200 con delivered:true es una entrega de verdad, con su id', async () => {
    vi.stubGlobal('fetch', responde(200, {
      ok: true, delivered: true, messageId: '3EB0ABC', attempts: 1,
    }))

    const r = await enviarNexus('hola')

    expect(r.entregado).toBe(true)
    expect(r.aceptado).toBe(true)
    expect(r.encolado).toBe(false)
    expect(r.messageId).toBe('3EB0ABC')
    expect(r.error).toBeNull()
  })

  it('202 con queued:true no es una entrega: se acepta, pero no ha llegado', async () => {
    vi.stubGlobal('fetch', responde(202, {
      ok: true,
      delivered: false,
      queued: true,
      attempts: 2,
      nextAttemptAt: '2026-09-08T04:00:00.000Z',
      error: 'sesión caída',
    }))

    const r = await enviarNexus('hola')

    // Aceptado porque no se pierde —el puente reintenta— pero entregado no.
    expect(r.aceptado).toBe(true)
    expect(r.entregado).toBe(false)
    expect(r.encolado).toBe(true)
    expect(r.error).toMatch(/no entregado todavía/)
    expect(r.error).toMatch(/2 intento/)
    expect(r.error).toMatch(/2026-09-08T04:00:00.000Z/)
  })

  it('un 2xx sin queued ni delivered es un mensaje perdido, y se nombra así', async () => {
    vi.stubGlobal('fetch', responde(200, {
      ok: false, delivered: false, queued: false, error: 'no se pudo persistir',
    }))

    const r = await enviarNexus('hola')

    expect(r.aceptado).toBe(false)
    expect(r.entregado).toBe(false)
    expect(r.encolado).toBe(false)
    expect(r.error).toMatch(/no entregado y no encolado/)
  })

  it('un puente viejo, sin delivered, se sigue interpretando por el canal', async () => {
    // La respuesta antigua: 202 pelado, sin decir qué pasó después.
    vi.stubGlobal('fetch', responde(202, { ok: true, queued: true }))

    const vivo = await enviarNexus('hola')
    expect(vivo.aceptado).toBe(true)
    expect(vivo.entregado).toBe(true)
    expect(vivo.error).toBeNull()

    vi.mocked(estadoCanal).mockResolvedValue({ estado: 'caido', detalle: 'not linked, stopped' })
    const caido = await enviarNexus('hola')
    expect(caido.aceptado).toBe(true)
    expect(caido.entregado).toBe(false)
    expect(caido.error).toMatch(/no entregado/)
  })

  it('un error del puente se propaga con su código', async () => {
    vi.stubGlobal('fetch', responde(401, { error: 'Unauthorized' }))

    const r = await enviarNexus('hola')

    expect(r.aceptado).toBe(false)
    expect(r.entregado).toBe(false)
    expect(r.error).toMatch(/puente devolvió 401/)
    expect(r.error).toMatch(/Unauthorized/)
  })

  it('una excepción de red no se escapa: nunca lanza', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))

    const r = await enviarNexus('hola')

    expect(r.aceptado).toBe(false)
    expect(r.entregado).toBe(false)
    expect(r.error).toBe('ECONNREFUSED')
  })

  it('manda el evento y el texto en el cuerpo que el puente sabe leer', async () => {
    const fetchSpy = responde(200, { ok: true, delivered: true, messageId: 'x' })
    vi.stubGlobal('fetch', fetchSpy)

    await enviarNexus('el texto', 'guerra')

    const [url, init] = vi.mocked(fetchSpy).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(URL_PUENTE)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-de-prueba' })
    const cuerpo = JSON.parse(String(init.body))
    expect(cuerpo.event).toBe('guerra')
    expect(cuerpo.data.message).toBe('el texto')
    expect(cuerpo.source).toBe('dep-coberturas')
  })
})
