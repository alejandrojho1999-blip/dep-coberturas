/**
 * Lectura de titulares por RSS/Atom.
 *
 * No se añade ninguna dependencia de parseo XML: los feeds que se consumen son
 * RSS 2.0 y Atom bien formados y solo hacen falta cuatro campos por entrada.
 * Un parser acotado y con test propio pesa menos que una librería entera y
 * falla de forma predecible.
 *
 * Reuters cerró sus feeds públicos y la OTAN retiró los suyos, así que la
 * cobertura general se toma de Google News (que sí los mantiene) con consultas
 * dirigidas, y se complementa con las salas de prensa que sí publican feed y
 * son fuente primaria: la Reserva Federal y el BLS. Verificado el 2026-08-31.
 */

export interface Titular {
  titulo: string
  url: string
  fuente: string
  publicadoAt: string | null
}

export interface FuenteRss {
  nombre: string
  url: string
  tema: 'guerra' | 'fed_tesoro'
}

function googleNews(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=US&ceid=US:es-419`
}

/**
 * Consultas de escalada.
 *
 * Se buscan hechos, no opiniones: derribos, incursiones, invocaciones del
 * artículo 4/5, despliegues. Una columna de análisis sobre la guerra no mueve
 * el precio del oro; un dron sobre territorio de la OTAN sí.
 */
export const FUENTES_GUERRA: readonly FuenteRss[] = [
  { nombre: 'Google News · OTAN Rusia', url: googleNews('OTAN Rusia escalada OR incursión OR derribo when:1d'), tema: 'guerra' },
  { nombre: 'Google News · Artículo 5',  url: googleNews('"artículo 5" OR "artículo 4" OTAN when:2d'), tema: 'guerra' },
  { nombre: 'Google News · Flanco este', url: googleNews('Polonia OR Lituania OR Estonia OR Letonia OR Rumanía dron OR misil OR espacio aéreo ruso when:1d'), tema: 'guerra' },
  { nombre: 'Google News · Kaliningrado', url: googleNews('Kaliningrado OR Báltico OR Suwalki tensión militar when:2d'), tema: 'guerra' },
  { nombre: 'Google News · nuclear', url: googleNews('Rusia nuclear amenaza OR ejercicio OR alerta when:2d'), tema: 'guerra' },
  // La OTAN retiró sus feeds públicos (todas las rutas conocidas dan 404), así
  // que la cobertura del flanco este se cubre solo con las consultas de arriba.
] as const

/**
 * Consultas del pulso FED vs Tesoro.
 *
 * Warsh en la Reserva Federal quiere subir tasas para llevar la inflación al 2%
 * sin romper el empleo; Bessent en el Tesoro quiere que se mantengan. Lo que
 * mueve el mercado son sus declaraciones y los comunicados oficiales.
 */
export const FUENTES_MACRO: readonly FuenteRss[] = [
  { nombre: 'Fed · comunicados', url: 'https://www.federalreserve.gov/feeds/press_all.xml', tema: 'fed_tesoro' },
  { nombre: 'Fed · política monetaria', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', tema: 'fed_tesoro' },
  { nombre: 'Fed · discursos', url: 'https://www.federalreserve.gov/feeds/speeches.xml', tema: 'fed_tesoro' },
  { nombre: 'BLS · IPC', url: 'https://www.bls.gov/feed/cpi.rss', tema: 'fed_tesoro' },
  { nombre: 'Google News · Warsh', url: googleNews('Warsh Reserva Federal tasas when:2d'), tema: 'fed_tesoro' },
  { nombre: 'Google News · Bessent', url: googleNews('Bessent Tesoro tasas OR Fed when:2d'), tema: 'fed_tesoro' },
  { nombre: 'Google News · FOMC', url: googleNews('FOMC tasas de interés decisión when:2d'), tema: 'fed_tesoro' },
] as const

const ENTIDADES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ',
}

export function decodificar(texto: string): string {
  return texto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function campo(bloque: string, etiqueta: string): string | null {
  const re = new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)</${etiqueta}>`, 'i')
  const m = bloque.match(re)
  return m ? decodificar(m[1]) : null
}

/** Atom guarda el enlace en un atributo, no en el contenido de la etiqueta. */
function enlaceAtom(bloque: string): string | null {
  const m = bloque.match(/<link[^>]*href=["']([^"']+)["']/i)
  return m ? decodificar(m[1]) : null
}

function fechaIso(valor: string | null): string | null {
  if (!valor) return null
  const t = Date.parse(valor)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** Extrae las entradas de un feed RSS 2.0 o Atom. */
export function parsearFeed(xml: string, fuente: string): Titular[] {
  const bloques = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) ?? []

  return bloques
    .map((bloque) => {
      const titulo = campo(bloque, 'title')
      const url = campo(bloque, 'link') || enlaceAtom(bloque)
      const publicadoAt = fechaIso(campo(bloque, 'pubDate') ?? campo(bloque, 'updated') ?? campo(bloque, 'published'))
      if (!titulo || !url) return null
      return { titulo, url, fuente, publicadoAt } satisfies Titular
    })
    .filter((t): t is Titular => t !== null)
}

/**
 * Descarga y parsea un feed. Nunca lanza: un feed caído no puede tumbar el scan.
 */
export async function leerFeed(fuente: FuenteRss, timeoutMs = 8000): Promise<Titular[]> {
  try {
    const res = await fetch(fuente.url, {
      headers: { 'User-Agent': 'dep-coberturas-alertas/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      console.error(`[rss] ${fuente.nombre} devolvió ${res.status}`)
      return []
    }
    return parsearFeed(await res.text(), fuente.nombre)
  } catch (e) {
    console.error(`[rss] ${fuente.nombre} falló: ${(e as Error).message}`)
    return []
  }
}

/**
 * Lee todas las fuentes y devuelve titulares únicos por URL, del más reciente
 * al más antiguo, descartando lo publicado hace más de `maxAntiguedadMin`.
 */
export async function leerFuentes(
  fuentes: readonly FuenteRss[],
  maxAntiguedadMin = 180,
): Promise<Titular[]> {
  const lotes = await Promise.all(fuentes.map((f) => leerFeed(f)))
  return filtrarRecientes(lotes.flat(), maxAntiguedadMin)
}

export function filtrarRecientes(
  titulares: Titular[],
  maxAntiguedadMin: number,
  ahora = Date.now(),
): Titular[] {
  const limite = ahora - maxAntiguedadMin * 60_000
  const vistos = new Set<string>()

  return titulares
    // Sin fecha no se puede juzgar la antigüedad; se deja pasar porque el
    // dedupe posterior evitará repetirlo y perder la primicia es peor.
    .filter((t) => (t.publicadoAt ? Date.parse(t.publicadoAt) >= limite : true))
    .filter((t) => {
      const clave = normalizarUrl(t.url)
      if (vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })
    .sort((a, b) => (Date.parse(b.publicadoAt ?? '') || 0) - (Date.parse(a.publicadoAt ?? '') || 0))
}

/** Quita los parámetros de campaña para que la misma noticia no cuente dos veces. */
export function normalizarUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const p of [...u.searchParams.keys()]) {
      if (p.startsWith('utm_') || p === 'oc' || p === 'ref') u.searchParams.delete(p)
    }
    const ruta = u.pathname.replace(/\/$/, '')
    return `${u.origin}${ruta}${u.search}`
  } catch {
    return url
  }
}
