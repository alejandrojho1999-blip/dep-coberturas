import { describe, expect, it } from 'vitest'
import { diaDesdeTimestamp, mapearPageviews } from '@/lib/pulso/wikipedia'
import { mapearEtiquetas, usosDelDia } from '@/lib/pulso/mastodon'
import { mapearHits, urlDeHistoria } from '@/lib/pulso/hn'
import { deduplicar } from '@/lib/pulso/news'
import { unirLotes } from '@/lib/pulso/tipos'
import { YOUTUBE_CANALES } from '@/lib/pulso/fuentes'

describe('wikipedia', () => {
  it('convierte el sello de la API en un día', () => {
    expect(diaDesdeTimestamp('2026083000')).toBe('2026-08-30')
    expect(diaDesdeTimestamp('roto')).toBeNull()
  })

  it('da a cada día una clave natural, para que releerlo no duplique la fila', () => {
    const obs = mapearPageviews(
      { items: [{ timestamp: '2026083000', views: 4210 }, { timestamp: '2026083100', views: 9100 }] },
      'NATO',
    )
    expect(obs).toHaveLength(2)
    expect(obs[0]).toMatchObject({ fuente: 'wikipedia', termino: 'nato', valor: 4210, clave: 'wikipedia:NATO:2026-08-30' })
    expect(obs[1].clave).toBe('wikipedia:NATO:2026-08-31')
  })

  it('descarta los días sin visitas en vez de contarlos como cero', () => {
    expect(mapearPageviews({ items: [{ timestamp: '2026083000' }] }, 'NATO')).toEqual([])
    expect(mapearPageviews({}, 'NATO')).toEqual([])
  })
})

describe('mastodon', () => {
  const etiqueta = {
    name: 'Ukraine',
    url: 'https://mastodon.social/tags/ukraine',
    history: [{ day: '1788220800', uses: '209', accounts: '59' }, { day: '1788134400', uses: '3', accounts: '2' }],
  }

  it('lee los contadores, que llegan como texto', () => {
    expect(usosDelDia(etiqueta)).toMatchObject({ usos: 209, cuentas: 59 })
  })

  it('una etiqueta sin historia vale cero y no rompe', () => {
    expect(usosDelDia({ name: 'x' })).toEqual({ usos: 0, cuentas: 0, dia: null })
  })

  it('normaliza el nombre y le pone clave diaria', () => {
    const [obs] = mapearEtiquetas([etiqueta], 'https://mastodon.social')
    expect(obs.termino).toBe('ukraine')
    expect(obs.valor).toBe(209)
    expect(obs.clave).toMatch(/^mastodon:ukraine:\d{4}-\d{2}-\d{2}$/)
  })
})

describe('hacker news', () => {
  it('usa el enlace de la historia, o el hilo cuando no hay enlace', () => {
    expect(urlDeHistoria({ url: 'https://ejemplo.test/a', objectID: '1' })).toBe('https://ejemplo.test/a')
    expect(urlDeHistoria({ url: null, objectID: '42' })).toBe('https://news.ycombinator.com/item?id=42')
    expect(urlDeHistoria({})).toBeNull()
  })

  it('descarta los resultados sin título', () => {
    const docs = mapearHits({ hits: [{ title: 'Cable cortado', objectID: '7' }, { title: null, url: 'x' }] }, 'europa')
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({ fuente: 'hn', tema: 'europa', titulo: 'Cable cortado' })
  })
})

describe('noticias', () => {
  it('cuenta una vez la misma noticia servida por los dos buscadores', () => {
    const base = { fuente: 'news' as const, tema: 'otan' as const, geo: null, titulo: 't', publicadoAt: null }
    const docs = deduplicar([
      { ...base, url: 'https://medio.test/nota?utm_source=google' },
      { ...base, url: 'https://medio.test/nota' },
      { ...base, url: 'https://medio.test/otra' },
    ])
    expect(docs).toHaveLength(2)
  })
})

describe('catálogo', () => {
  it('los canales de YouTube llevan identificador, no alias: el RSS no acepta @nombre', () => {
    for (const canal of YOUTUBE_CANALES) {
      expect(canal.canalId).toMatch(/^UC[A-Za-z0-9_-]{22}$/)
    }
  })
})

describe('unirLotes', () => {
  it('junta observaciones, documentos y errores de todas las fuentes', () => {
    const unido = unirLotes([
      { observaciones: [{ fuente: 'hn', geo: null, termino: 'a', valor: 1, unidad: 'u' }], documentos: [], errores: ['x'] },
      { observaciones: [], documentos: [], errores: ['y'] },
    ])
    expect(unido.observaciones).toHaveLength(1)
    expect(unido.errores).toEqual(['x', 'y'])
  })
})
