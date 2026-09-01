/**
 * Tipos del pulso público.
 *
 * Dos formas de dato conviven a propósito. Una **observación** es un número con
 * unidad: cuánta gente buscó un término, cuántas visitas tuvo un artículo. Un
 * **documento** es una frase: un titular, el título de un vídeo. Lo primero
 * alimenta las series temporales del modelo; lo segundo, la extracción de
 * palabras clave. Mezclarlos en una sola tabla obligaría a que cada texto
 * fingiera un valor numérico que no tiene.
 */

export type FuentePulso = 'trends' | 'wikipedia' | 'hn' | 'mastodon' | 'youtube' | 'news'

/** Bloque temático al que pertenece un documento. */
export type TemaPulso = 'guerra' | 'otan' | 'europa' | 'mundo' | 'macro'

export interface Observacion {
  fuente: FuentePulso
  /** Código ISO del país cuando la medición es local; null si es global. */
  geo: string | null
  termino: string
  valor: number
  unidad: string
  /**
   * Clave natural de la medición cuando la serie es diaria, para que releerla
   * cada media hora no duplique la fila. Las series intradía la dejan sin
   * definir.
   */
  clave?: string
  metadatos?: Record<string, unknown>
}

export interface Documento {
  fuente: FuentePulso
  tema: TemaPulso | null
  geo: string | null
  titulo: string
  url: string
  publicadoAt: string | null
}

/**
 * Lo que devuelve cada recolector.
 *
 * Los errores viajan como datos y no como excepciones: una fuente caída tiene
 * que reducir la cobertura del día, no tumbar la recolección entera.
 */
export interface LotePulso {
  observaciones: Observacion[]
  documentos: Documento[]
  errores: string[]
}

export const LOTE_VACIO: LotePulso = { observaciones: [], documentos: [], errores: [] }

export function unirLotes(lotes: LotePulso[]): LotePulso {
  return {
    observaciones: lotes.flatMap((l) => l.observaciones),
    documentos: lotes.flatMap((l) => l.documentos),
    errores: lotes.flatMap((l) => l.errores),
  }
}
