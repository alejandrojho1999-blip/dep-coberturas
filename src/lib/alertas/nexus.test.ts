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

import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enviarNexus, nexusConfigurado, tokenPuente } from '@/lib/alertas/nexus'

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
  // Sin esto la prueba leería el fichero real del puente y mandaría el token de
  // producción en sus aserciones. Se apunta a una ruta inexistente para que el
  // respaldo por variable de entorno sea el que mande.
  process.env.NEXUS_WEBHOOK_ENV_FILE = '/inexistente/webhook.env'
  vi.mocked(estadoCanal).mockResolvedValue({ estado: 'vivo', detalle: 'linea de estado simulada' })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXUS_WEBHOOK_URL
  delete process.env.NEXUS_WEBHOOK_TOKEN
  delete process.env.NEXUS_WEBHOOK_ENV_FILE
})

describe('nexusConfigurado', () => {
  it('exige la URL y el token', () => {
    expect(nexusConfigurado()).toBe(true)

    delete process.env.NEXUS_WEBHOOK_TOKEN
    expect(nexusConfigurado()).toBe(false)
  })
})

describe('tokenPuente', () => {
  // El origen único: el token sale del fichero que carga el propio puente, para
  // que no pueda divergir del que este valida. Tener dos copias fue lo que dejó
  // que se rotara una sola y todo respondiera 401 durante horas.
  const fichero = join(tmpdir(), `webhook-test-${process.pid}.env`)

  afterEach(() => {
    try { unlinkSync(fichero) } catch { /* la prueba pudo no crearlo */ }
  })

  it('el fichero del puente gana a la variable de entorno', () => {
    writeFileSync(fichero, 'WA_ACCOUNT=nexus\nWEBHOOK_TOKEN=el-del-puente\n')
    process.env.NEXUS_WEBHOOK_ENV_FILE = fichero

    expect(tokenPuente()).toBe('el-del-puente')
  })

  it('sin fichero legible cae a la variable', () => {
    process.env.NEXUS_WEBHOOK_ENV_FILE = join(tmpdir(), 'no-existe-jamas.env')

    expect(tokenPuente()).toBe('token-de-prueba')
  })

  it('quita comillas y espacios como haría el shell', () => {
    writeFileSync(fichero, 'WEBHOOK_TOKEN = "con-comillas"  \n')
    process.env.NEXUS_WEBHOOK_ENV_FILE = fichero

    expect(tokenPuente()).toBe('con-comillas')
  })

  it('un fichero sin la clave, o con ella vacía, cae a la variable', () => {
    writeFileSync(fichero, 'WA_ACCOUNT=nexus\nWEBHOOK_TOKEN=\n')
    process.env.NEXUS_WEBHOOK_ENV_FILE = fichero

    expect(tokenPuente()).toBe('token-de-prueba')
  })

  it('sin fichero y sin variable no inventa un token', () => {
    process.env.NEXUS_WEBHOOK_ENV_FILE = join(tmpdir(), 'no-existe-jamas.env')
    delete process.env.NEXUS_WEBHOOK_TOKEN

    expect(tokenPuente()).toBeNull()
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
    // El error nombra los dos sitios de donde puede salir el token, para que no
    // haya que abrir el código a averiguar dónde se buscó.
    expect(r.error).toMatch(/sin puente/)
    expect(r.error).toMatch(/webhook\.env/)
    expect(r.error).toMatch(/NEXUS_WEBHOOK_TOKEN/)
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
