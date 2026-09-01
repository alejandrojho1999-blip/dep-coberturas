import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acortarUrl,
  dominioDe,
  LARGO_TOLERABLE,
  limpiarUrl,
  lineaEnlace,
} from '@/lib/alertas/enlace'

/** Un enlace de Google News real: opaco y larguísimo, que es el caso que duele. */
const LARGA = 'https://news.google.com/rss/articles/'
  + 'CBMiigFBVV95cUxNMkhqRTFhbFJvY2xkMlpXOTJZMlpQY0hCNlkyNXZhWFZ6' .repeat(2)
  + '?oc=5&hl=es&gl=EC&ceid=EC%3Aes'

afterEach(() => vi.unstubAllGlobals())

describe('limpiarUrl', () => {
  it('quita los parámetros de campaña y deja el resto intacto', () => {
    const limpia = limpiarUrl('https://elpais.com/economia/nota?utm_source=x&id=7&fbclid=abc')
    expect(limpia).toBe('https://elpais.com/economia/nota?id=7')
  })

  it('quita la barra final y el ancla', () => {
    expect(limpiarUrl('https://reuters.com/mundo/#seccion')).toBe('https://reuters.com/mundo')
  })

  it('no rompe con una URL inválida: la devuelve tal cual', () => {
    expect(limpiarUrl('esto no es una url')).toBe('esto no es una url')
  })
})

describe('dominioDe', () => {
  it('quita el www', () => {
    expect(dominioDe('https://www.reuters.com/a/b')).toBe('reuters.com')
  })

  it('devuelve null si no se puede leer', () => {
    expect(dominioDe('rota')).toBeNull()
  })
})

describe('lineaEnlace', () => {
  it('pone el medio delante del enlace', () => {
    expect(lineaEnlace('https://is.gd/abc123')).toBe('🔗 is.gd · https://is.gd/abc123')
  })

  it('sin dominio legible, deja solo el enlace', () => {
    expect(lineaEnlace('rota')).toBe('🔗 rota')
  })
})

describe('acortarUrl', () => {
  it('no llama al acortador si el enlace ya es corto', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const corta = 'https://reuters.com/a/b'
    expect(corta.length).toBeLessThanOrEqual(LARGO_TOLERABLE)
    await expect(acortarUrl(corta)).resolves.toBe(corta)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('devuelve el alias cuando is.gd responde bien', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('https://is.gd/aB3xY9\n', { status: 200 })))
    await expect(acortarUrl(LARGA)).resolves.toBe('https://is.gd/aB3xY9')
  })

  it('manda la URL ya limpia al acortador, no la original', async () => {
    const fetchSpy = vi.fn(async (_url: string) => new Response('https://is.gd/aB3xY9', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await acortarUrl(LARGA)
    const pedida = decodeURIComponent(fetchSpy.mock.calls[0][0].split('url=')[1])
    expect(pedida).not.toContain('oc=5')
    expect(pedida).not.toContain('ceid=')
  })

  it('cae a la URL limpia si is.gd responde un error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 502 })))
    await expect(acortarUrl(LARGA)).resolves.toBe(limpiarUrl(LARGA))
  })

  it('cae a la URL limpia si is.gd responde 200 con un texto que no es un enlace suyo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Error: invalid URL', { status: 200 })))
    await expect(acortarUrl(LARGA)).resolves.toBe(limpiarUrl(LARGA))
  })

  it('cae a la URL limpia si la red falla, sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    await expect(acortarUrl(LARGA)).resolves.toBe(limpiarUrl(LARGA))
  })
})
