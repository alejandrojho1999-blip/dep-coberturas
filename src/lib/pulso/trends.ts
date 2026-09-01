/**
 * Búsquedas en tendencia por país (Google Trends).
 *
 * Es la fuente que más cerca está del objetivo: mide lo que la gente quiere
 * saber, que ocurre antes de que un medio lo publique. Cuando una ciudad del
 * flanco este aparece de golpe entre las búsquedas de Polonia, algo ha pasado
 * ahí aunque todavía no haya titular.
 *
 * El feed trae etiquetas propias del espacio de nombres `ht:` que el parser
 * genérico de `rss.ts` ignora, así que aquí se lee a mano: el tráfico
 * aproximado del término y los titulares que Google asocia a él.
 */

import { decodificar } from '@/lib/alertas/rss'
import { TRENDS_GEOS } from '@/lib/pulso/fuentes'
import { pedirTexto } from '@/lib/pulso/http'
import { LOTE_VACIO, unirLotes, type Documento, type LotePulso, type Observacion } from '@/lib/pulso/tipos'

function etiqueta(bloque: string, nombre: string): string | null {
  const m = bloque.match(new RegExp(`<${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</${nombre}>`, 'i'))
  return m ? decodificar(m[1]) : null
}

/**
 * «200+», «2 mil+», «1M+» → número.
 *
 * Google publica el tráfico redondeado y localizado. Interesa el orden de
 * magnitud, no la cifra exacta: un término con «1M+» pesa mil veces más que uno
 * con «1000+» y eso es lo único que el modelo necesita distinguir.
 */
export function traficoAproximado(texto: string | null): number {
  if (!texto) return 0
  const limpio = texto.replace(/\s| /g, '').toLowerCase()
  // El orden de las alternativas importa: si `[km]` va primero se come la «m»
  // de «mil» y veinte mil pasa a ser veinte millones.
  const m = limpio.match(/([\d.,]+)(mill(?:ones)?|mil|[km])?/i)
  if (!m) return 0

  const base = Number(m[1].replace(/[.,]/g, ''))
  if (!Number.isFinite(base)) return 0

  const sufijo = m[2] ?? ''
  if (sufijo === 'k' || sufijo === 'mil') return base * 1000
  if (sufijo === 'm' || sufijo.startsWith('mill')) return base * 1_000_000
  return base
}

function fechaIso(valor: string | null): string | null {
  if (!valor) return null
  const t = Date.parse(valor)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Extrae términos y titulares asociados de un feed de tendencias. */
export function parsearTrends(xml: string, geo: string): LotePulso {
  const bloques = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []
  const observaciones: Observacion[] = []
  const documentos: Documento[] = []

  for (const bloque of bloques) {
    const termino = etiqueta(bloque, 'title')
    if (!termino) continue

    observaciones.push({
      fuente: 'trends',
      geo,
      termino: termino.toLowerCase(),
      valor: traficoAproximado(etiqueta(bloque, 'ht:approx_traffic')),
      unidad: 'busquedas',
      metadatos: { pubDate: fechaIso(etiqueta(bloque, 'pubDate')) },
    })

    // Cada término trae los titulares con los que Google lo explica. Son texto
    // de otros medios, así que valen como documento pero no como observación.
    for (const noticia of bloque.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) ?? []) {
      const titulo = etiqueta(noticia, 'ht:news_item_title')
      const url = etiqueta(noticia, 'ht:news_item_url')
      if (!titulo || !url) continue
      documentos.push({
        fuente: 'trends',
        tema: null,
        geo,
        titulo,
        url,
        publicadoAt: fechaIso(etiqueta(bloque, 'pubDate')),
      })
    }
  }

  return { observaciones, documentos, errores: [] }
}

async function leerGeo(geo: string, etiquetaGeo: string): Promise<LotePulso> {
  const { datos, error } = await pedirTexto(
    `https://trends.google.com/trending/rss?geo=${geo}`,
    `trends ${etiquetaGeo}`,
  )
  if (!datos) return { ...LOTE_VACIO, errores: [error ?? `trends ${etiquetaGeo}: sin datos`] }
  return parsearTrends(datos, geo)
}

export async function recolectarTrends(): Promise<LotePulso> {
  const lotes = await Promise.all(TRENDS_GEOS.map((g) => leerGeo(g.geo, g.etiqueta)))
  return unirLotes(lotes)
}
