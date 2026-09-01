/**
 * Acceso a red del pulso.
 *
 * Mismo contrato defensivo que `lib/alertas/rss.ts`: tiempo de espera duro y
 * ninguna excepción hacia arriba. Aquí se consultan una decena de servicios
 * gratuitos sin acuerdo de servicio; que uno devuelva 500 es lo normal, no la
 * excepción, y no puede costar la recolección del resto.
 */

import { AGENTE_USUARIO, TIMEOUT_MS } from '@/lib/pulso/fuentes'

export interface Respuesta<T> {
  datos: T | null
  error: string | null
}

async function pedir(url: string, cabeceras: Record<string, string>): Promise<Response | string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': AGENTE_USUARIO, ...cabeceras },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return `${res.status}`
    return res
  } catch (e) {
    return (e as Error).message
  }
}

export async function pedirTexto(url: string, etiqueta: string): Promise<Respuesta<string>> {
  const res = await pedir(url, {})
  if (typeof res === 'string') return { datos: null, error: `${etiqueta}: ${res}` }
  try {
    return { datos: await res.text(), error: null }
  } catch (e) {
    return { datos: null, error: `${etiqueta}: ${(e as Error).message}` }
  }
}

export async function pedirJson<T>(url: string, etiqueta: string): Promise<Respuesta<T>> {
  const res = await pedir(url, { Accept: 'application/json' })
  if (typeof res === 'string') return { datos: null, error: `${etiqueta}: ${res}` }
  try {
    return { datos: (await res.json()) as T, error: null }
  } catch (e) {
    return { datos: null, error: `${etiqueta}: respuesta no es JSON (${(e as Error).message})` }
  }
}
