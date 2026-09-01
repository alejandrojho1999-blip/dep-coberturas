/**
 * Contrato entre `/api/alertas/pulso` y la pantalla.
 *
 * Vive aparte de `tipos.ts` porque aquel describe lo que se recolecta y este lo
 * que se enseña. El cliente no debe importar nada del recolector ni del modelo:
 * si mañana cambia cómo se mide, la pantalla no tiene por qué enterarse.
 */

import type { TipoModelo } from '@/lib/pulso/ciclos'

export interface PrediccionUi {
  dia: string
  modelo: TipoModelo
  probabilidad: number
  contribuciones: Record<string, number>
}

export interface KeywordUi {
  dia: string
  termino: string
  fuentes: string[]
  menciones: number
  zScore: number
  relevancia: number | null
  tema: string | null
  resumen: string | null
  ejemploUrl: string | null
}

export interface FuenteUi {
  fuente: string
  ultimaAt: string
}

/**
 * Estado de un modelo.
 *
 * `activo: false` no es un error: es el estado normal mientras se acumulan
 * días. Por eso viajan también `diasConVector` y `faltanDias`, para que la
 * pantalla pueda decir cuánto queda en vez de limitarse a callar.
 */
export interface EstadoModelo {
  tipo: TipoModelo
  activo: boolean
  auc: number | null
  brier: number | null
  tasaBase: number | null
  entrenadoAt: string | null
  diasConVector: number
  faltanDias: number
}

export interface RespuestaPulso {
  predicciones: PrediccionUi[]
  keywords: KeywordUi[]
  fuentes: FuenteUi[]
  modelos: EstadoModelo[]
}

/** Etiquetas de las fuentes, para no enseñar el identificador crudo. */
export const ETIQUETA_FUENTE: Record<string, string> = {
  trends: 'Búsquedas en Google',
  wikipedia: 'Consultas en Wikipedia',
  hn: 'Foros técnicos',
  mastodon: 'Redes sociales',
  youtube: 'Cadenas de noticias',
  news: 'Prensa',
}

/** Etiquetas de las features, para explicar qué empuja la probabilidad. */
export const ETIQUETA_FEATURE: Record<string, string> = {
  trends_otan: 'búsquedas en el flanco OTAN',
  trends_global: 'búsquedas globales',
  wiki_guerra: 'consultas sobre guerra y OTAN',
  wiki_macro: 'consultas sobre Fed e inflación',
  noticias_guerra: 'prensa de guerra',
  noticias_macro: 'prensa macro',
  foros: 'foros técnicos',
  redes: 'redes sociales',
  video: 'cadenas de noticias',
}

export const ETIQUETA_MODELO: Record<TipoModelo, string> = {
  mercado: 'Shock de mercado',
  geopolitico: 'Escalada geopolítica',
}
