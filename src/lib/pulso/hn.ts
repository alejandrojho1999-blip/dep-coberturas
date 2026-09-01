/**
 * Hacker News, vía el índice de Algolia.
 *
 * Es el foro que mejor se deja consultar sin cuenta —Reddit devuelve 403— y el
 * que antes recoge un incidente técnico, energético o de infraestructura: un
 * cable submarino cortado aparece aquí horas antes que en la prensa general.
 *
 * Las frases van entrecomilladas con `advancedSyntax`: sin eso Algolia da por
 * buena una coincidencia parcial y «nato» se cuenta dentro de «Antonio».
 */

import { HN_CONSULTAS } from '@/lib/pulso/fuentes'
import { pedirJson } from '@/lib/pulso/http'
import { LOTE_VACIO, unirLotes, type Documento, type LotePulso, type TemaPulso } from '@/lib/pulso/tipos'

interface RespuestaAlgolia {
  nbHits?: number
  hits?: Array<{ title?: string | null; url?: string | null; objectID?: string; created_at?: string; points?: number }>
}

export function urlDeHistoria(hit: { url?: string | null; objectID?: string }): string | null {
  if (hit.url) return hit.url
  return hit.objectID ? `https://news.ycombinator.com/item?id=${hit.objectID}` : null
}

export function mapearHits(datos: RespuestaAlgolia, tema: TemaPulso): Documento[] {
  return (datos.hits ?? []).flatMap((hit) => {
    const url = urlDeHistoria(hit)
    if (!hit.title || !url) return []
    return [{
      fuente: 'hn' as const,
      tema,
      geo: null,
      titulo: hit.title,
      url,
      publicadoAt: hit.created_at ?? null,
    }]
  })
}

async function leerConsulta(clave: string, frase: string, tema: TemaPulso, horas: number): Promise<LotePulso> {
  const desde = Math.floor((Date.now() - horas * 3_600_000) / 1000)
  const url =
    'https://hn.algolia.com/api/v1/search_by_date?tags=story&advancedSyntax=true&typoTolerance=false' +
    `&query=${encodeURIComponent(`"${frase}"`)}` +
    `&numericFilters=${encodeURIComponent(`created_at_i>${desde}`)}&hitsPerPage=20`

  const { datos, error } = await pedirJson<RespuestaAlgolia>(url, `hn ${clave}`)
  if (!datos) return { ...LOTE_VACIO, errores: [error ?? `hn ${clave}: sin datos`] }

  const documentos = mapearHits(datos, tema)
  return {
    // El número de historias del periodo es la medición; los títulos son el texto.
    observaciones: [{
      fuente: 'hn',
      geo: null,
      termino: clave,
      valor: documentos.length,
      unidad: 'historias',
      metadatos: { horas, totalIndice: datos.nbHits ?? null },
    }],
    documentos,
    errores: [],
  }
}

export async function recolectarHn(horas = 24): Promise<LotePulso> {
  const lotes = await Promise.all(HN_CONSULTAS.map((c) => leerConsulta(c.clave, c.frase, c.tema, horas)))
  return unirLotes(lotes)
}
