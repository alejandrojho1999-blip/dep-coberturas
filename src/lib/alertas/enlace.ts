/**
 * Enlaces legibles para los mensajes de WhatsApp.
 *
 * El problema es concreto: los titulares llegan por el RSS de Google News y su
 * enlace es una cadena opaca de varios cientos de caracteres. En el móvil eso
 * ocupa media pantalla, empuja hacia abajo los niveles de la orden —que es lo
 * único que hay que leer con prisa— y encima no dice de qué medio viene.
 *
 * La solución va en dos tiempos, y el segundo puede fallar sin consecuencias:
 *
 *  1. `limpiarUrl` quita la basura de campaña. Es local, síncrono y siempre
 *     funciona. Sobre un enlace normal ya recorta bastante.
 *  2. `acortarUrl` pide un alias a is.gd. Si el servicio tarda, responde mal o
 *     está caído, se devuelve la URL limpia y el mensaje sale igual. Un aviso
 *     de escalada militar no se pierde porque un acortador esté de mantenimiento.
 */

/** Parámetros que solo sirven para medir campañas y no cambian el destino. */
const PARAMETROS_BASURA = [
  'oc', 'ref', 'hl', 'gl', 'ceid', 'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid',
  'sourceid', 'ncid', 'cmpid', 'smid', 'source',
]

/** A partir de aquí un enlace ya estorba en la pantalla del móvil. */
export const LARGO_TOLERABLE = 70

/**
 * Quita los parámetros de campaña y la barra final.
 *
 * Es la misma idea que `normalizarUrl` de `rss.ts`, pero aquella existe para
 * deduplicar y esta para mostrar: si algún día una necesita ser más agresiva
 * que la otra, conviene que puedan divergir sin romper el dedupe.
 */
export function limpiarUrl(url: string): string {
  try {
    const u = new URL(url)
    for (const p of [...u.searchParams.keys()]) {
      if (p.startsWith('utm_') || PARAMETROS_BASURA.includes(p)) u.searchParams.delete(p)
    }
    u.hash = ''
    const ruta = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')
    return `${u.origin}${ruta}${u.search}`
  } catch {
    return url
  }
}

/** El medio, tal y como se nombra en voz alta: `elpais.com`, sin `www.`. */
export function dominioDe(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Devuelve un alias corto, o la URL limpia si no se pudo acortar.
 *
 * Nunca lanza: quien la llama está a mitad de componer una alerta y no puede
 * quedarse sin mensaje por esto.
 */
export async function acortarUrl(url: string, timeoutMs = 4000): Promise<string> {
  const limpia = limpiarUrl(url)
  if (limpia.length <= LARGO_TOLERABLE) return limpia

  try {
    const res = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(limpia)}`,
      { signal: AbortSignal.timeout(timeoutMs) },
    )
    if (!res.ok) return limpia

    const texto = (await res.text()).trim()
    // is.gd responde 200 con un texto de error cuando rechaza la URL, así que
    // no basta con el código: hay que ver que lo devuelto sea un enlace suyo.
    if (!/^https:\/\/is\.gd\/\S+$/.test(texto)) return limpia
    return texto
  } catch {
    return limpia
  }
}

/**
 * La línea del enlace tal y como se lee en el mensaje.
 *
 * El dominio va delante porque responde antes que el enlace a la pregunta de
 * quién lo cuenta, que es lo que decide si merece la pena abrirlo.
 */
export function lineaEnlace(url: string): string {
  const dominio = dominioDe(url)
  return dominio ? `🔗 ${dominio} · ${url}` : `🔗 ${url}`
}
