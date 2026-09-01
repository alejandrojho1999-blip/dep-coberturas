/**
 * Guardado del pulso.
 *
 * Las dos escrituras son `upsert` con `ignoreDuplicates`, no `insert`: el
 * recolector corre cada media hora y vuelve a ver lo mismo casi siempre. La
 * base decide qué es repetido —por la clave natural de la observación y por la
 * URL normalizada del documento— y así el cron puede ser tonto y correr seguido
 * sin inflar las tablas.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarUrl } from '@/lib/alertas/rss'
import type { Documento, FuentePulso, Observacion } from '@/lib/pulso/tipos'

/** Postgres se atraganta con lotes enormes; con esto sobra y va en dos viajes. */
const TAMANO_LOTE = 500

function porLotes<T>(filas: T[]): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) lotes.push(filas.slice(i, i + TAMANO_LOTE))
  return lotes
}

export async function guardarObservaciones(
  admin: SupabaseClient,
  observaciones: Observacion[],
): Promise<number> {
  if (!observaciones.length) return 0

  // Dos observaciones del mismo lote pueden compartir clave (el mismo día de
  // Wikipedia leído por dos vías). Postgres rechaza un upsert que afecte dos
  // veces a la misma fila, así que la colisión se resuelve antes de enviarla.
  const vistas = new Set<string>()
  const filas = observaciones
    .filter((o) => {
      if (!o.clave) return true
      if (vistas.has(o.clave)) return false
      vistas.add(o.clave)
      return true
    })
    .map((o) => ({
      fuente: o.fuente,
      geo: o.geo,
      termino: o.termino,
      valor: o.valor,
      unidad: o.unidad,
      clave: o.clave ?? null,
      metadatos: o.metadatos ?? {},
    }))

  let guardadas = 0
  for (const lote of porLotes(filas)) {
    const { error, count } = await admin
      .from('pulse_observations')
      .upsert(lote, { onConflict: 'clave', ignoreDuplicates: true, count: 'exact' })
    if (error) throw new Error(`pulse_observations: ${error.message}`)
    guardadas += count ?? 0
  }
  return guardadas
}

export async function guardarDocumentos(
  admin: SupabaseClient,
  documentos: Documento[],
): Promise<number> {
  if (!documentos.length) return 0

  const vistos = new Set<string>()
  const filas = documentos
    .map((d) => ({ ...d, urlNorm: normalizarUrl(d.url) }))
    .filter((d) => {
      if (vistos.has(d.urlNorm)) return false
      vistos.add(d.urlNorm)
      return true
    })
    .map((d) => ({
      fuente: d.fuente,
      tema: d.tema,
      geo: d.geo,
      titulo: d.titulo,
      url: d.url,
      url_norm: d.urlNorm,
      publicado_at: d.publicadoAt,
    }))

  let guardados = 0
  for (const lote of porLotes(filas)) {
    const { error, count } = await admin
      .from('pulse_documents')
      .upsert(lote, { onConflict: 'url_norm', ignoreDuplicates: true, count: 'exact' })
    if (error) throw new Error(`pulse_documents: ${error.message}`)
    guardados += count ?? 0
  }
  return guardados
}

export interface FilaObservacion {
  fuente: FuentePulso
  geo: string | null
  termino: string
  valor: number
  unidad: string
  capturadoAt: string
  metadatos: Record<string, unknown>
}

/** Serie cruda de los últimos días, para calcular líneas base y z-scores. */
export async function observacionesDesde(
  admin: SupabaseClient,
  dias: number,
  fuente?: FuentePulso,
): Promise<FilaObservacion[]> {
  const desde = new Date(Date.now() - dias * 24 * 3_600_000).toISOString()
  let consulta = admin
    .from('pulse_observations')
    .select('fuente, geo, termino, valor, unidad, capturado_at, metadatos')
    .gte('capturado_at', desde)
    .order('capturado_at', { ascending: false })
  if (fuente) consulta = consulta.eq('fuente', fuente)

  const { data, error } = await consulta
  if (error) throw new Error(`pulse_observations (lectura): ${error.message}`)

  return (data ?? []).map((r) => ({
    fuente: r.fuente as FuentePulso,
    geo: (r.geo as string | null) ?? null,
    termino: r.termino as string,
    valor: Number(r.valor),
    unidad: r.unidad as string,
    capturadoAt: r.capturado_at as string,
    metadatos: (r.metadatos as Record<string, unknown>) ?? {},
  }))
}

export interface FilaDocumento {
  fuente: FuentePulso
  tema: string | null
  titulo: string
  url: string
  publicadoAt: string | null
  capturadoAt: string
}

/** Textos crudos de los últimos días, de donde salen las palabras clave. */
export async function documentosDesde(admin: SupabaseClient, dias: number): Promise<FilaDocumento[]> {
  const desde = new Date(Date.now() - dias * 24 * 3_600_000).toISOString()
  const { data, error } = await admin
    .from('pulse_documents')
    .select('fuente, tema, titulo, url, publicado_at, capturado_at')
    .gte('capturado_at', desde)
    .order('capturado_at', { ascending: false })

  if (error) throw new Error(`pulse_documents (lectura): ${error.message}`)

  return (data ?? []).map((r) => ({
    fuente: r.fuente as FuentePulso,
    tema: (r.tema as string | null) ?? null,
    titulo: r.titulo as string,
    url: r.url as string,
    publicadoAt: (r.publicado_at as string | null) ?? null,
    capturadoAt: r.capturado_at as string,
  }))
}

/** Última captura por fuente: es lo que la interfaz enseña como «fuentes vivas». */
export async function ultimaCapturaPorFuente(
  admin: SupabaseClient,
): Promise<Record<string, string>> {
  const { data, error } = await admin
    .from('pulse_observations')
    .select('fuente, capturado_at')
    .order('capturado_at', { ascending: false })
    .limit(2000)

  if (error) throw new Error(`pulse_observations (últimas): ${error.message}`)

  const ultima: Record<string, string> = {}
  for (const fila of data ?? []) {
    const fuente = fila.fuente as string
    if (!ultima[fuente]) ultima[fuente] = fila.capturado_at as string
  }
  return ultima
}
