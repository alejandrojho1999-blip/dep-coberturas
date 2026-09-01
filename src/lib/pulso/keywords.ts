/**
 * De un día de ruido a un puñado de términos con señal.
 *
 * El recolector trae unos quinientos titulares por pasada, la mayoría
 * irrelevantes: fútbol, famosos, ofertas. Contar menciones no basta —«trump» o
 * «ucrania» salen todos los días y no dicen nada por salir hoy también—. Lo que
 * importa es la **desviación respecto a la costumbre**: un término que aparece
 * quince veces cuando su media de las últimas cuatro semanas era una.
 *
 * De ahí que la unidad sea el z-score y no el recuento. Un topónimo del que
 * nadie hablaba y hoy aparece en tres fuentes distintas es exactamente la
 * señal que se busca, aunque su recuento absoluto sea pequeño.
 */

import { media, desviacion } from '@/lib/portafolios/metrics'
import type { FilaDocumento } from '@/lib/pulso/persistencia'
import type { FuentePulso } from '@/lib/pulso/tipos'

/**
 * Palabras que aparecen en todo y no distinguen nada.
 *
 * Están las gramaticales de español e inglés y, además, el vocabulario de
 * relleno del periodismo («says», «según», «tras»), que si no se filtra copa
 * la lista de emergentes cada día.
 */
const VACIAS = new Set([
  // español
  'a', 'al', 'ante', 'como', 'con', 'contra', 'de', 'del', 'desde', 'donde', 'dos', 'el', 'ella',
  'ellos', 'en', 'entre', 'era', 'es', 'esta', 'este', 'esto', 'fue', 'ha', 'han', 'hasta', 'hay',
  'la', 'las', 'le', 'lo', 'los', 'mas', 'me', 'mi', 'muy', 'no', 'nos', 'o', 'para', 'pero', 'por',
  'porque', 'que', 'se', 'segun', 'ser', 'si', 'sin', 'sobre', 'son', 'su', 'sus', 'tras', 'un',
  'una', 'uno', 'y', 'ya',
  // inglés
  'a', 'about', 'after', 'all', 'als', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by',
  'can', 'could', 'did', 'do', 'for', 'from', 'get', 'had', 'has', 'have', 'he', 'her', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'like', 'may', 'more', 'most', 'new',
  'not', 'now', 'of', 'off', 'on', 'one', 'or', 'our', 'out', 'over', 'said', 'says', 'she',
  'should', 'so', 'some', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'to', 'up', 'was', 'we', 'were', 'what', 'when', 'which', 'who', 'why', 'will', 'with',
  'would', 'you', 'your',
])

/**
 * Sin tildes, sin signos y en minúsculas.
 *
 * «Kaliningrado», «kaliningrado» y «KALININGRADO,» tienen que ser el mismo
 * término o la serie se parte en tres y ninguna alcanza el umbral.
 */
export function normalizarTermino(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palabras útiles de un título, ya normalizadas. */
export function palabras(titulo: string): string[] {
  return normalizarTermino(titulo)
    .split(' ')
    .filter((p) => p.length >= 3 && !VACIAS.has(p) && !/^\d+$/.test(p))
}

export interface Conteo {
  termino: string
  menciones: number
  fuentes: FuentePulso[]
  ejemploUrl: string | null
  /**
   * Un titular donde aparece el término.
   *
   * Va con el término porque sin él no se puede juzgar: «espacio aereo» a secas
   * puede ser un cierre por drones o una huelga de controladores.
   */
  ejemploTitulo: string | null
}

/**
 * Cuenta términos de una y dos palabras.
 *
 * Los bigramas están porque los nombres propios que interesan casi siempre lo
 * son: «espacio aereo», «flanco este», «cable submarino». Un unigrama solo
 * («aereo») no se puede juzgar.
 */
export function extraerNgramas(documentos: FilaDocumento[]): Conteo[] {
  const acumulado = new Map<
    string,
    { menciones: number; fuentes: Set<FuentePulso>; url: string | null; titulo: string | null }
  >()

  const anotar = (termino: string, doc: FilaDocumento) => {
    const previo = acumulado.get(termino)
    if (previo) {
      previo.menciones += 1
      previo.fuentes.add(doc.fuente)
      return
    }
    acumulado.set(termino, { menciones: 1, fuentes: new Set([doc.fuente]), url: doc.url, titulo: doc.titulo })
  }

  for (const doc of documentos) {
    const ps = palabras(doc.titulo)
    // Dentro de un mismo titular un término cuenta una vez: repetirlo en el
    // título no es más atención, es redacción.
    const vistos = new Set<string>()
    for (let i = 0; i < ps.length; i++) {
      for (const termino of [ps[i], i + 1 < ps.length ? `${ps[i]} ${ps[i + 1]}` : null]) {
        if (!termino || vistos.has(termino)) continue
        vistos.add(termino)
        anotar(termino, doc)
      }
    }
  }

  return [...acumulado.entries()]
    .map(([termino, v]) => ({
      termino,
      menciones: v.menciones,
      fuentes: [...v.fuentes],
      ejemploUrl: v.url,
      ejemploTitulo: v.titulo,
    }))
    .sort((a, b) => b.menciones - a.menciones)
}

/**
 * Cuánto se sale un valor de su propia costumbre.
 *
 * Con menos de dos días de historia no hay desviación que calcular y se
 * devuelve 0: sin línea base, todo parece emergente y nada lo es. Cuando la
 * serie es plana (desviación cero) y hoy hay algo, se devuelve un valor alto
 * fijo, porque dividir entre cero daría infinito y un término que pasa de no
 * existir a existir sí es la señal que se busca.
 */
export function zScore(historia: number[], hoy: number): number {
  if (historia.length < 2) return 0
  const sd = desviacion(historia)
  if (sd === null) return 0
  const m = media(historia)
  if (sd === 0) return hoy > m ? 6 : 0
  return (hoy - m) / sd
}

export interface Emergente extends Conteo {
  zScore: number
  dia: string
}

export interface OpcionesEmergentes {
  /** Cuántas veces tiene que aparecer hoy para tomarlo en serio. */
  minMenciones?: number
  /** Cuánto tiene que salirse de su costumbre. */
  minZ?: number
  /** Cuántos devolver como mucho: detrás de ellos va una llamada al LLM. */
  maximo?: number
}

function diaDe(doc: FilaDocumento): string {
  return (doc.publicadoAt ?? doc.capturadoAt).slice(0, 10)
}

/**
 * Términos que hoy se salen de su línea base.
 *
 * `documentos` tiene que traer la ventana entera (hoy más las semanas
 * anteriores): la línea base se calcula con los mismos datos, contando cada día
 * por separado.
 */
export function detectarEmergentes(
  documentos: FilaDocumento[],
  dia: string,
  { minMenciones = 3, minZ = 2, maximo = 12 }: OpcionesEmergentes = {},
): Emergente[] {
  const deHoy = documentos.filter((d) => diaDe(d) === dia)
  if (!deHoy.length) return []

  // La historia se cuenta día a día para que la línea base sea una serie y no
  // un promedio aplastado del periodo entero.
  const porDia = new Map<string, FilaDocumento[]>()
  for (const doc of documentos) {
    const d = diaDe(doc)
    if (d >= dia) continue
    porDia.set(d, [...(porDia.get(d) ?? []), doc])
  }

  const historia = new Map<string, number[]>()
  for (const docsDelDia of porDia.values()) {
    for (const c of extraerNgramas(docsDelDia)) {
      historia.set(c.termino, [...(historia.get(c.termino) ?? []), c.menciones])
    }
  }
  // Un término que hoy aparece y antes no, tiene ceros detrás, no vacío.
  const diasBase = porDia.size

  return extraerNgramas(deHoy)
    .filter((c) => c.menciones >= minMenciones)
    .map((c) => {
      const vistos = historia.get(c.termino) ?? []
      const serie = [...vistos, ...Array(Math.max(0, diasBase - vistos.length)).fill(0)]
      return { ...c, zScore: zScore(serie, c.menciones), dia }
    })
    .filter((e) => e.zScore >= minZ)
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, maximo)
}
