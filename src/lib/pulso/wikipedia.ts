/**
 * Visitas a artículos de Wikipedia.
 *
 * El termómetro más limpio de atención pública que existe gratis: nadie entra
 * en «Artículo 5 del Tratado del Atlántico Norte» por rutina, así que un pico
 * en esa serie es gente buscando entender algo que acaba de pasar. Y a
 * diferencia de las tendencias de búsqueda, la serie es larga y comparable
 * consigo misma, que es lo que hace falta para calcular un z-score.
 *
 * La API publica el cierre del día anterior con unas horas de retraso, así que
 * se piden los últimos días y se guarda cada uno con su clave natural: releer
 * cada media hora no crea filas nuevas.
 */

import { WIKI_ARTICULOS } from '@/lib/pulso/fuentes'
import { pedirJson } from '@/lib/pulso/http'
import { LOTE_VACIO, unirLotes, type LotePulso, type Observacion } from '@/lib/pulso/tipos'

interface RespuestaPageviews {
  items?: Array<{ article?: string; timestamp?: string; views?: number }>
}

/** `20260830` → `2026-08-30`. La API devuelve `2026083000` (con la hora a cero). */
export function diaDesdeTimestamp(timestamp: string): string | null {
  const m = timestamp.match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function comoAAAAMMDD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).replace(/-/g, '')
}

export function mapearPageviews(datos: RespuestaPageviews, articulo: string): Observacion[] {
  return (datos.items ?? []).flatMap((item) => {
    const dia = item.timestamp ? diaDesdeTimestamp(item.timestamp) : null
    if (!dia || typeof item.views !== 'number') return []
    return [{
      fuente: 'wikipedia' as const,
      geo: null,
      termino: articulo.replace(/_/g, ' ').toLowerCase(),
      valor: item.views,
      unidad: 'vistas',
      clave: `wikipedia:${articulo}:${dia}`,
      metadatos: { dia, articulo },
    }]
  })
}

async function leerArticulo(articulo: string, dias: number): Promise<LotePulso> {
  const fin = new Date(Date.now() - 24 * 3_600_000)
  const inicio = new Date(fin.getTime() - dias * 24 * 3_600_000)
  const url =
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/' +
    `${encodeURIComponent(articulo)}/daily/${comoAAAAMMDD(inicio)}/${comoAAAAMMDD(fin)}`

  const { datos, error } = await pedirJson<RespuestaPageviews>(url, `wikipedia ${articulo}`)
  if (!datos) return { ...LOTE_VACIO, errores: [error ?? `wikipedia ${articulo}: sin datos`] }

  return { observaciones: mapearPageviews(datos, articulo), documentos: [], errores: [] }
}

/**
 * `dias` cubre de sobra el retraso de publicación; las repeticiones no cuestan
 * filas porque chocan contra la clave natural.
 */
export async function recolectarWikipedia(dias = 3): Promise<LotePulso> {
  const lotes = await Promise.all(WIKI_ARTICULOS.map((a) => leerArticulo(a.articulo, dias)))
  return unirLotes(lotes)
}
