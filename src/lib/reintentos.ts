/**
 * Reintentos con espera creciente para los fallos que se arreglan solos.
 *
 * El 2026-09-08 seis ciclos de alertas murieron por caídas de un segundo:
 * `alert_signals (urls): Gateway Timeout`, `alert_seen_urls (urls): Gateway
 * Timeout` y `FRED API error for series EFFR: 502 Bad Gateway`. Ninguna era un
 * problema del sistema —Supabase y FRED devolvieron 5xx y al minuto siguiente
 * respondían bien—, pero cada una se llevó por delante el ciclo entero y con él
 * la vigilancia de esa ventana.
 *
 * La regla es la misma que gobierna el resto del módulo de alertas: degradar
 * antes que callar. Un reintento cuesta segundos; un ciclo perdido cuesta la
 * alerta.
 *
 * Solo se reintenta lo pasajero. Un permiso mal puesto, una tabla que no existe
 * o una clave caducada fallan igual las tres veces, y repetirlos solo retrasa el
 * error que hay que ver.
 */

/**
 * Señales de un fallo pasajero, buscadas en el texto del error.
 *
 * Se mira el mensaje y no un código porque las tres fuentes que fallan hablan
 * idiomas distintos: PostgREST devuelve un objeto con `message`, `fetch` lanza
 * `TypeError: fetch failed` con la causa dentro, y FRED llega como texto de
 * estado HTTP ya formateado por quien lo envuelve.
 */
const SENALES_PASAJERAS = [
  'gateway timeout',
  'bad gateway',
  'service unavailable',
  'too many requests',
  'timeout',
  'timed out',
  'fetch failed',
  'socket hang up',
  'network',
  'econnreset',
  'econnrefused',
  'etimedout',
  'eai_again',
  'enotfound',
  '502',
  '503',
  '504',
  '429',
]

/** Texto legible de cualquier cosa que se pueda lanzar o devolver como error. */
function texto(error: unknown): string {
  if (error === null || error === undefined) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    // `fetch` esconde el motivo real en `cause`: el mensaje de arriba es
    // siempre el mismo «fetch failed» y no distingue un DNS caído de un 500.
    const causa = (error as Error & { cause?: unknown }).cause
    return `${error.message} ${causa ? texto(causa) : ''}`
  }
  if (typeof error === 'object') {
    const e = error as { message?: unknown; code?: unknown; status?: unknown }
    return [e.message, e.code, e.status].filter((v) => v !== undefined && v !== null).join(' ')
  }
  return String(error)
}

/** ¿Merece la pena volver a intentarlo? */
export function esFalloPasajero(error: unknown): boolean {
  const t = texto(error).toLowerCase()
  if (!t) return false
  return SENALES_PASAJERAS.some((senal) => t.includes(senal))
}

export interface OpcionesReintento {
  /** Intentos totales, no reintentos extra. 3 significa 1 + 2. */
  intentos?: number
  /** Espera antes del primer reintento; se duplica en cada vuelta. */
  esperaBaseMs?: number
  /** Qué se considera pasajero. Se inyecta en las pruebas. */
  esPasajero?: (error: unknown) => boolean
  /** Cómo esperar. Se inyecta en las pruebas para no dormir de verdad. */
  dormir?: (ms: number) => Promise<void>
  /** Aviso de cada reintento, para dejar rastro en el log del cron. */
  alReintentar?: (intento: number, error: unknown, esperaMs: number) => void
}

const dormirDeVerdad = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Ejecuta `operacion`, repitiéndola mientras falle por algo pasajero.
 *
 * La espera crece al doble en cada vuelta (500 ms, 1 s, 2 s…) para no insistir
 * sobre un servicio que ya está ahogado. No se añade jitter a propósito: estos
 * crons corren de uno en uno, no hay manada que dispersar, y un retardo
 * determinista se puede probar sin trucos.
 *
 * Si se agotan los intentos sube el último error, tal cual, sin envolverlo: el
 * mensaje que ya se escribía en el log sigue siendo el mismo.
 */
export async function conReintentos<T>(
  operacion: () => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const {
    intentos = 3,
    esperaBaseMs = 500,
    esPasajero = esFalloPasajero,
    dormir = dormirDeVerdad,
    alReintentar,
  } = opciones

  let ultimo: unknown
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await operacion()
    } catch (error) {
      ultimo = error
      const quedanIntentos = intento < intentos
      if (!quedanIntentos || !esPasajero(error)) throw error

      const espera = esperaBaseMs * 2 ** (intento - 1)
      alReintentar?.(intento, error, espera)
      await dormir(espera)
    }
  }

  // Inalcanzable: el bucle o devuelve o lanza. Está por si alguien cambia
  // `intentos` a 0 desde una configuración.
  throw ultimo ?? new Error('conReintentos: sin intentos')
}
