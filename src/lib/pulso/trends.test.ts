import { describe, expect, it } from 'vitest'
import { parsearTrends, traficoAproximado } from '@/lib/pulso/trends'

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel>
  <item>
    <title>kaliningrado</title>
    <ht:approx_traffic>2000+</ht:approx_traffic>
    <pubDate>Tue, 1 Sep 2026 11:20:00 -0700</pubDate>
    <ht:news_item>
      <ht:news_item_title>Polonia cierra su espacio a&#233;reo</ht:news_item_title>
      <ht:news_item_url>https://ejemplo.test/polonia</ht:news_item_url>
    </ht:news_item>
    <ht:news_item>
      <ht:news_item_title>Reacci&#243;n de la OTAN</ht:news_item_title>
      <ht:news_item_url>https://ejemplo.test/otan</ht:news_item_url>
    </ht:news_item>
  </item>
  <item>
    <title>Ryan Garcia</title>
    <ht:approx_traffic>200+</ht:approx_traffic>
    <pubDate>Tue, 1 Sep 2026 10:00:00 -0700</pubDate>
  </item>
</channel></rss>`

describe('traficoAproximado', () => {
  it('lee las cifras redondeadas que publica Google', () => {
    expect(traficoAproximado('200+')).toBe(200)
    expect(traficoAproximado('2000+')).toBe(2000)
    expect(traficoAproximado('20 mil+')).toBe(20_000)
    expect(traficoAproximado('1M+')).toBe(1_000_000)
  })

  it('devuelve cero cuando el término no trae tráfico', () => {
    expect(traficoAproximado(null)).toBe(0)
    expect(traficoAproximado('')).toBe(0)
    expect(traficoAproximado('sin datos')).toBe(0)
  })

  it('no confunde el separador de miles con un decimal', () => {
    expect(traficoAproximado('1.000+')).toBe(1000)
    expect(traficoAproximado('1,000+')).toBe(1000)
  })
})

describe('parsearTrends', () => {
  const lote = parsearTrends(FEED, 'PL')

  it('saca una observación por término, con su geo', () => {
    expect(lote.observaciones).toHaveLength(2)
    expect(lote.observaciones[0]).toMatchObject({
      fuente: 'trends',
      geo: 'PL',
      termino: 'kaliningrado',
      valor: 2000,
      unidad: 'busquedas',
    })
  })

  it('normaliza el término a minúsculas para que la serie sea comparable', () => {
    expect(lote.observaciones[1].termino).toBe('ryan garcia')
  })

  it('saca los titulares asociados como documentos, con las entidades resueltas', () => {
    expect(lote.documentos).toHaveLength(2)
    expect(lote.documentos[0].titulo).toBe('Polonia cierra su espacio aéreo')
    expect(lote.documentos[0].url).toBe('https://ejemplo.test/polonia')
    expect(lote.documentos[0].fuente).toBe('trends')
  })

  it('no inventa nada con un feed vacío', () => {
    expect(parsearTrends('<rss><channel/></rss>', 'US')).toEqual({
      observaciones: [], documentos: [], errores: [],
    })
  })
})
