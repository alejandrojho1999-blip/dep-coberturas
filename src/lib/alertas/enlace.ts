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
 *  2. `acortarUrl` pide un alias a un acortador público. Si el servicio tarda,
 *     responde mal o está caído, se prueba el siguiente y, si tampoco, se
 *     devuelve la URL limpia y el mensaje sale igual. Un aviso de escalada
 *     militar no se pierde porque un acortador esté de mantenimiento.
 *
 * Se prueba más de uno porque ya pasó: el 2026-09-02 is.gd llevaba días
 * respondiendo `200` con el cuerpo «Error, database insert failed», así que
 * todos los avisos salían con la URL de Google News entera. Un único proveedor
 * es un único punto de fallo silencioso.
 */

/** Parámetros que solo sirven para medir campañas y no cambian el destino. */
const PARAMETROS_BASURA = [
  'oc', 'ref', 'hl', 'gl', 'ceid', 'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid',
  'sourceid', 'ncid', 'cmpid', 'smid', 'source',
]

/** A partir de aquí un enlace ya estorba en la pantalla del móvil. */
export const LARGO_TOLERABLE = 70

/**
 * Los acortadores, en el orden en que se prueban.
 *
 * `valido` no es un adorno: los dos responden `200` cuando rechazan la URL, con
 * el error en el cuerpo. Sin comprobar la forma de lo devuelto se enviaría por
 * WhatsApp un texto de error donde debería ir el enlace.
 */
export const ACORTADORES: ReadonlyArray<{
  nombre: string
  endpoint: (url: string) => string
  valido: RegExp
}> = [
  {
    nombre: 'tinyurl',
    endpoint: (url) => `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
    valido: /^https:\/\/tinyurl\.com\/\S+$/,
  },
  {
    nombre: 'is.gd',
    endpoint: (url) => `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`,
    valido: /^https:\/\/is\.gd\/\S+$/,
  },
]

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

/**
 * Devuelve un alias corto, o la URL limpia si ningún acortador respondió.
 *
 * Nunca lanza: quien la llama está a mitad de componer una alerta y no puede
 * quedarse sin mensaje por esto. El `timeoutMs` es por proveedor, así que en el
 * peor caso el coste es el número de proveedores por ese tiempo.
 */
export async function acortarUrl(url: string, timeoutMs = 4000): Promise<string> {
  const limpia = limpiarUrl(url)
  if (limpia.length <= LARGO_TOLERABLE) return limpia

  for (const acortador of ACORTADORES) {
    try {
      const res = await fetch(acortador.endpoint(limpia), {
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) continue

      const texto = (await res.text()).trim()
      if (acortador.valido.test(texto)) return texto
    } catch {
      // Proveedor caído o lento: se intenta el siguiente.
    }
  }

  return limpia
}

/**
 * La línea del enlace tal y como se lee en el mensaje.
 *
 * Solo el enlace. Antes iba precedido del dominio, pero con el alias del
 * acortador ese dominio ya no era el del medio sino el del propio acortador
 * —`news.google.com`, `tinyurl.com`—, así que no informaba de quién lo cuenta y
 * sí añadía un segundo enlace clicable que llevaba a la portada. Quién lo
 * cuenta ya está en la línea de la fuente, justo encima.
 */
export function lineaEnlace(url: string): string {
  return `🔗 ${url}`
}
