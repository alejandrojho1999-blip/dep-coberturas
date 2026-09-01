/**
 * Volumen de noticias por bloque temático, en dos buscadores.
 *
 * Esto no compite con `lib/alertas/rss.ts`: aquel lee titulares para decidir si
 * mandar un mensaje, y este cuenta cuántas noticias hay sobre un tema para
 * medir si la cobertura está subiendo. La misma noticia interesa aquí por
 * existir, no por lo que dice.
 *
 * Se consultan Google News y Bing News porque cada uno indexa una cola
 * diferente de medios pequeños; el solape lo resuelve la deduplicación por URL
 * normalizada, la misma regla que usa el motor de alertas.
 */

import { normalizarUrl, parsearFeed } from '@/lib/alertas/rss'
import { CONSULTAS_NOTICIAS } from '@/lib/pulso/fuentes'
import { pedirTexto } from '@/lib/pulso/http'
import { unirLotes, type Documento, type LotePulso, type TemaPulso } from '@/lib/pulso/tipos'

function googleNews(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
}

function bingNews(query: string): string {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`
}

/** Quita las repeticiones entre los dos buscadores dentro de una misma consulta. */
export function deduplicar(documentos: Documento[]): Documento[] {
  const vistos = new Set<string>()
  return documentos.filter((d) => {
    const clave = normalizarUrl(d.url)
    if (vistos.has(clave)) return false
    vistos.add(clave)
    return true
  })
}

async function leerConsulta(
  clave: string,
  query: string,
  tema: TemaPulso,
  horas: number,
): Promise<LotePulso> {
  const buscadores: Array<[string, string]> = [
    ['google', googleNews(`${query} when:1d`)],
    ['bing', bingNews(query)],
  ]

  const errores: string[] = []
  const crudos: Documento[] = []

  for (const [buscador, url] of buscadores) {
    const { datos, error } = await pedirTexto(url, `news ${buscador} ${clave}`)
    if (!datos) {
      errores.push(error ?? `news ${buscador} ${clave}: sin datos`)
      continue
    }
    const limite = Date.now() - horas * 3_600_000
    for (const t of parsearFeed(datos, `${buscador}:${clave}`)) {
      if (t.publicadoAt && Date.parse(t.publicadoAt) < limite) continue
      crudos.push({ fuente: 'news', tema, geo: null, titulo: t.titulo, url: t.url, publicadoAt: t.publicadoAt })
    }
  }

  const documentos = deduplicar(crudos)

  return {
    observaciones: [{
      fuente: 'news',
      geo: null,
      termino: clave,
      valor: documentos.length,
      unidad: 'noticias',
      metadatos: { horas, tema, query },
    }],
    documentos,
    errores,
  }
}

export async function recolectarNoticias(horas = 24): Promise<LotePulso> {
  const lotes = await Promise.all(
    CONSULTAS_NOTICIAS.map((c) => leerConsulta(c.clave, c.query, c.tema, horas)),
  )
  return unirLotes(lotes)
}
