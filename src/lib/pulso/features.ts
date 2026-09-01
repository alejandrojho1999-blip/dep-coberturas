/**
 * El vector diario que ve el modelo.
 *
 * Cada feature es un z-score, no un recuento. Da igual que Wikipedia mida
 * visitas y las noticias midan artículos: lo que entra al modelo es «cuánto se
 * salió esto de su propia costumbre», y así todas las señales hablan el mismo
 * idioma y una fuente con números grandes no pesa más que otra por serlo.
 *
 * `nFuentes` viaja con el vector porque un día en que se cayeron tres fuentes
 * produce un vector más pobre, y eso tiene que poder verse en pantalla en vez
 * de disimularse.
 */

import { zScore } from '@/lib/pulso/keywords'
import type { FilaObservacion } from '@/lib/pulso/persistencia'
import type { FuentePulso } from '@/lib/pulso/tipos'

/** Nombres de las features, en el orden en que entran al modelo. */
export const FEATURES = [
  'trends_otan',
  'trends_global',
  'wiki_guerra',
  'wiki_macro',
  'noticias_guerra',
  'noticias_macro',
  'foros',
  'redes',
  'video',
] as const

export type NombreFeature = (typeof FEATURES)[number]

/**
 * Geos del flanco: lo que se busca en Polonia, Ucrania o los bálticos pesa
 * distinto que lo que se busca en el mundo entero.
 */
const GEOS_OTAN = new Set(['PL', 'UA', 'DE', 'TR'])

/** Artículos de Wikipedia por bloque, en la forma normalizada que se guarda. */
const WIKI_GUERRA = new Set([
  'nato', 'article 5 of the north atlantic treaty', 'enlargement of nato',
  'russian invasion of ukraine', 'kaliningrad oblast', 'suwalki gap',
  'baltic states', 'world war iii', 'nuclear warfare',
])
const WIKI_MACRO = new Set(['federal reserve', 'inflation', 'gold as an investment'])

/** Claves de consulta de noticias por bloque. */
const NOTICIAS_GUERRA = new Set(['otan-rusia', 'flanco-este', 'ucrania', 'vecinos', 'oriente-medio', 'asia'])
const NOTICIAS_MACRO = new Set(['macro', 'energia'])

export interface VectorDiario {
  dia: string
  vector: Record<NombreFeature, number>
  nFuentes: number
}

function dia(obs: FilaObservacion): string {
  const declarado = obs.metadatos?.dia
  // Wikipedia y Mastodon declaran a qué día pertenece el dato; el resto se
  // fecha por el momento de la captura.
  return typeof declarado === 'string' ? declarado : obs.capturadoAt.slice(0, 10)
}

/**
 * Suma diaria de un subconjunto de observaciones.
 *
 * Se suma y no se promedia porque el número de términos que devuelve una fuente
 * ya es señal: un día en que Google Trends saca cinco términos sobre el flanco
 * este es distinto de otro en que saca uno, aunque el tráfico de cada uno sea
 * parecido.
 */
function serieDiaria(
  observaciones: FilaObservacion[],
  filtro: (obs: FilaObservacion) => boolean,
): Map<string, number> {
  const porDia = new Map<string, number>()
  for (const obs of observaciones) {
    if (!filtro(obs)) continue
    const d = dia(obs)
    porDia.set(d, (porDia.get(d) ?? 0) + obs.valor)
  }
  return porDia
}

/** Z-score de cada día contra los días anteriores de su propia serie. */
function zPorDia(serie: Map<string, number>, dias: string[]): Map<string, number> {
  const z = new Map<string, number>()
  for (let i = 0; i < dias.length; i++) {
    const historia = dias.slice(0, i).map((d) => serie.get(d) ?? 0)
    z.set(dias[i], zScore(historia, serie.get(dias[i]) ?? 0))
  }
  return z
}

const DEFINICIONES: Record<NombreFeature, (obs: FilaObservacion) => boolean> = {
  trends_otan: (o) => o.fuente === 'trends' && o.geo !== null && GEOS_OTAN.has(o.geo),
  trends_global: (o) => o.fuente === 'trends' && (o.geo === null || !GEOS_OTAN.has(o.geo)),
  wiki_guerra: (o) => o.fuente === 'wikipedia' && WIKI_GUERRA.has(o.termino),
  wiki_macro: (o) => o.fuente === 'wikipedia' && WIKI_MACRO.has(o.termino),
  noticias_guerra: (o) => o.fuente === 'news' && NOTICIAS_GUERRA.has(o.termino),
  noticias_macro: (o) => o.fuente === 'news' && NOTICIAS_MACRO.has(o.termino),
  foros: (o) => o.fuente === 'hn',
  redes: (o) => o.fuente === 'mastodon',
  video: (o) => o.fuente === 'youtube',
}

/**
 * Convierte el histórico crudo en un vector por día.
 *
 * El primer día de la serie sale con ceros: no tiene pasado contra el que
 * compararse. Es correcto y no un fallo —`zScore` devuelve 0 sin línea base—,
 * y con el paso de las semanas deja de importar.
 */
export function construirVectores(observaciones: FilaObservacion[]): VectorDiario[] {
  const dias = [...new Set(observaciones.map(dia))].sort()
  if (!dias.length) return []

  const zetas = Object.fromEntries(
    FEATURES.map((f) => [f, zPorDia(serieDiaria(observaciones, DEFINICIONES[f]), dias)]),
  ) as Record<NombreFeature, Map<string, number>>

  const fuentesPorDia = new Map<string, Set<FuentePulso>>()
  for (const obs of observaciones) {
    const d = dia(obs)
    fuentesPorDia.set(d, (fuentesPorDia.get(d) ?? new Set()).add(obs.fuente))
  }

  return dias.map((d) => ({
    dia: d,
    vector: Object.fromEntries(
      FEATURES.map((f) => [f, Number((zetas[f].get(d) ?? 0).toFixed(4))]),
    ) as Record<NombreFeature, number>,
    nFuentes: fuentesPorDia.get(d)?.size ?? 0,
  }))
}

/** El vector en el orden que espera el modelo. Sin esto, los pesos no significan nada. */
export function comoFila(vector: Record<string, number>): number[] {
  return FEATURES.map((f) => vector[f] ?? 0)
}
