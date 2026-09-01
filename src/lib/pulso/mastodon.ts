/**
 * Etiquetas en tendencia de Mastodon.
 *
 * Es la única red social grande cuya API de tendencias sigue siendo pública: X
 * pide credenciales de aplicación (401) y Reddit bloquea al cliente anónimo
 * (403). Mide de qué se habla, no qué se busca, que es una señal distinta y
 * complementaria a la de Google Trends.
 *
 * Cada etiqueta viene con su historia de siete días, así que la propia
 * respuesta trae la línea base contra la que comparar el día de hoy.
 */

import { MASTODON_INSTANCIAS } from '@/lib/pulso/fuentes'
import { pedirJson } from '@/lib/pulso/http'
import { LOTE_VACIO, unirLotes, type LotePulso, type Observacion } from '@/lib/pulso/tipos'

interface EtiquetaMastodon {
  name?: string
  url?: string
  history?: Array<{ day?: string; uses?: string; accounts?: string }>
}

/** Los contadores llegan como cadenas; una etiqueta sin historia vale cero. */
export function usosDelDia(etiqueta: EtiquetaMastodon): { usos: number; cuentas: number; dia: string | null } {
  const hoy = etiqueta.history?.[0]
  if (!hoy) return { usos: 0, cuentas: 0, dia: null }
  const segundos = Number(hoy.day)
  return {
    usos: Number(hoy.uses) || 0,
    cuentas: Number(hoy.accounts) || 0,
    dia: Number.isFinite(segundos) ? new Date(segundos * 1000).toISOString().slice(0, 10) : null,
  }
}

export function mapearEtiquetas(datos: EtiquetaMastodon[], instancia: string): Observacion[] {
  return datos.flatMap((etiqueta) => {
    if (!etiqueta.name) return []
    const { usos, cuentas, dia } = usosDelDia(etiqueta)
    return [{
      fuente: 'mastodon' as const,
      geo: null,
      termino: etiqueta.name.toLowerCase(),
      valor: usos,
      unidad: 'usos',
      clave: dia ? `mastodon:${etiqueta.name.toLowerCase()}:${dia}` : undefined,
      metadatos: { cuentas, dia, instancia, url: etiqueta.url ?? null },
    }]
  })
}

async function leerInstancia(instancia: string): Promise<LotePulso> {
  const { datos, error } = await pedirJson<EtiquetaMastodon[]>(
    `${instancia}/api/v1/trends/tags?limit=20`,
    `mastodon ${instancia}`,
  )
  if (!Array.isArray(datos)) return { ...LOTE_VACIO, errores: [error ?? `mastodon ${instancia}: sin datos`] }

  return { observaciones: mapearEtiquetas(datos, instancia), documentos: [], errores: [] }
}

export async function recolectarMastodon(): Promise<LotePulso> {
  const lotes = await Promise.all(MASTODON_INSTANCIAS.map(leerInstancia))
  return unirLotes(lotes)
}
