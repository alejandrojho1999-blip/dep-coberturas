import { describe, expect, it } from 'vitest'
import {
  decodificar,
  filtrarRecientes,
  normalizarUrl,
  parsearFeed,
  type Titular,
} from '@/lib/alertas/rss'

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Feed de prueba</title>
  <item>
    <title><![CDATA[Polonia derriba un dron ruso &amp; convoca al embajador]]></title>
    <link>https://ejemplo.com/nota-1?utm_source=google&amp;id=7</link>
    <pubDate>Mon, 31 Aug 2026 14:32:00 GMT</pubDate>
  </item>
  <item>
    <title>Segundo titular</title>
    <link>https://ejemplo.com/nota-2</link>
    <pubDate>fecha ilegible</pubDate>
  </item>
</channel></rss>`

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>La OTAN convoca el artículo 4</title>
    <link rel="alternate" href="https://nato.int/nota"/>
    <updated>2026-08-31T12:00:00Z</updated>
  </entry>
</feed>`

describe('decodificar', () => {
  it('resuelve CDATA, entidades y etiquetas incrustadas', () => {
    expect(decodificar('<![CDATA[Oro &amp; <b>plata</b>]]>')).toBe('Oro & plata')
    expect(decodificar('caf&#233;')).toBe('café')
  })
})

describe('parsearFeed', () => {
  it('extrae los items de un RSS 2.0', () => {
    const t = parsearFeed(RSS, 'Prueba')
    expect(t).toHaveLength(2)
    expect(t[0].titulo).toBe('Polonia derriba un dron ruso & convoca al embajador')
    expect(t[0].url).toBe('https://ejemplo.com/nota-1?utm_source=google&id=7')
    expect(t[0].publicadoAt).toBe('2026-08-31T14:32:00.000Z')
    expect(t[0].fuente).toBe('Prueba')
  })

  it('una fecha ilegible no descarta el titular', () => {
    expect(parsearFeed(RSS, 'Prueba')[1].publicadoAt).toBeNull()
  })

  it('extrae el enlace del atributo href en Atom', () => {
    const t = parsearFeed(ATOM, 'NATO')
    expect(t).toHaveLength(1)
    expect(t[0].url).toBe('https://nato.int/nota')
    expect(t[0].publicadoAt).toBe('2026-08-31T12:00:00.000Z')
  })

  it('devuelve lista vacía con XML basura', () => {
    expect(parsearFeed('no soy xml', 'X')).toEqual([])
  })
})

describe('normalizarUrl', () => {
  it('quita los parámetros de campaña y la barra final', () => {
    expect(normalizarUrl('https://a.com/x/?utm_source=g&id=1')).toBe('https://a.com/x?id=1')
  })

  it('deja intacta una URL no parseable', () => {
    expect(normalizarUrl('no-es-url')).toBe('no-es-url')
  })
})

describe('filtrarRecientes', () => {
  const ahora = Date.parse('2026-08-31T15:00:00Z')
  const base = (url: string, min: number | null): Titular => ({
    titulo: `t-${url}`,
    url,
    fuente: 'x',
    publicadoAt: min == null ? null : new Date(ahora - min * 60_000).toISOString(),
  })

  it('descarta lo más viejo que la ventana', () => {
    const r = filtrarRecientes([base('https://a.com/1', 10), base('https://a.com/2', 500)], 180, ahora)
    expect(r.map((t) => t.url)).toEqual(['https://a.com/1'])
  })

  it('conserva los titulares sin fecha', () => {
    const r = filtrarRecientes([base('https://a.com/3', null)], 180, ahora)
    expect(r).toHaveLength(1)
  })

  it('deduplica por URL normalizada', () => {
    const r = filtrarRecientes(
      [base('https://a.com/1?utm_source=g', 5), base('https://a.com/1', 4)],
      180,
      ahora,
    )
    expect(r).toHaveLength(1)
  })

  it('ordena del más reciente al más antiguo', () => {
    const r = filtrarRecientes([base('https://a.com/viejo', 100), base('https://a.com/nuevo', 2)], 180, ahora)
    expect(r[0].url).toBe('https://a.com/nuevo')
  })
})
