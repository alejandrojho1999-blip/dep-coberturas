/**
 * Titulares de vídeo de las cadenas de noticias.
 *
 * YouTube publica un feed Atom por canal sin pedir clave. El valor no está en
 * el vídeo sino en su título: cómo titula DW o Al Jazeera un mismo hecho dice
 * qué encuadre le están dando, y el ritmo de publicación de una cadena sube
 * cuando algo está ocurriendo.
 *
 * El feed exige el identificador del canal; el alias `@DWNews` no funciona en
 * esta URL. Los identificadores están resueltos en `fuentes.ts`.
 */

import { parsearFeed } from '@/lib/alertas/rss'
import { YOUTUBE_CANALES } from '@/lib/pulso/fuentes'
import { pedirTexto } from '@/lib/pulso/http'
import { LOTE_VACIO, unirLotes, type LotePulso, type TemaPulso } from '@/lib/pulso/tipos'

async function leerCanal(
  nombre: string,
  canalId: string,
  tema: TemaPulso,
  horas: number,
): Promise<LotePulso> {
  const { datos, error } = await pedirTexto(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`,
    `youtube ${nombre}`,
  )
  if (!datos) return { ...LOTE_VACIO, errores: [error ?? `youtube ${nombre}: sin datos`] }

  const limite = Date.now() - horas * 3_600_000
  const recientes = parsearFeed(datos, nombre).filter(
    (t) => !t.publicadoAt || Date.parse(t.publicadoAt) >= limite,
  )

  return {
    observaciones: [{
      fuente: 'youtube',
      geo: null,
      termino: nombre.toLowerCase(),
      valor: recientes.length,
      unidad: 'videos',
      metadatos: { horas, canalId },
    }],
    documentos: recientes.map((t) => ({
      fuente: 'youtube' as const,
      tema,
      geo: null,
      titulo: t.titulo,
      url: t.url,
      publicadoAt: t.publicadoAt,
    })),
    errores: [],
  }
}

export async function recolectarYoutube(horas = 24): Promise<LotePulso> {
  const lotes = await Promise.all(
    YOUTUBE_CANALES.map((c) => leerCanal(c.nombre, c.canalId, c.tema, horas)),
  )
  return unirLotes(lotes)
}
