/**
 * Cliente de la revisión de niveles de salida.
 *
 * El trabajo ocurre entero en `/api/agentes/review-exits`: leer posiciones,
 * cotizar contratos y escribir los cierres. Aquí solo queda la llamada y el
 * volcado de su log, para que el agente lo pinte en su consola.
 *
 * Estaba en el navegador y encadenaba una petición por paso. Moverlo al
 * servidor es lo que permitirá que un cron haga la misma revisión sin que nadie
 * tenga la pantalla abierta.
 */

export interface ExitReviewSummary {
  /** Posiciones vivas revisadas contra una prima real. */
  revisadas: number
  /** Posiciones cerradas por haber tocado el objetivo. */
  porObjetivo: number
  /** Posiciones cerradas por haber tocado el stop. */
  porStop: number
  /** Posiciones que Yahoo no cotizaba y se dejan vivas. */
  sinCotizar: number
}

const VACIO: ExitReviewSummary = { revisadas: 0, porObjetivo: 0, porStop: 0, sinCotizar: 0 }

interface ReviewResponse extends ExitReviewSummary {
  log?: string[]
}

/**
 * Pide al servidor la revisión de niveles de una categoría de opciones y
 * vuelca su log. Ante cualquier fallo devuelve el resumen vacío: no cerrar
 * nada es siempre preferible a cerrar sin datos.
 */
export async function reviewExitLevels(
  category: 'OPTIONS_GAMMA' | 'OPTIONS_THETA',
  signal: AbortSignal,
  addLog: (msg: string) => void
): Promise<ExitReviewSummary> {
  try {
    const res = await fetch('/api/agentes/review-exits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
      signal,
    })
    if (!res.ok) {
      addLog(`⚠ Revisión de niveles no disponible (HTTP ${res.status}) — no se cierra nada`)
      return { ...VACIO }
    }
    const data = await res.json() as ReviewResponse
    for (const line of data.log ?? []) addLog(line)
    return {
      revisadas: data.revisadas ?? 0,
      porObjetivo: data.porObjetivo ?? 0,
      porStop: data.porStop ?? 0,
      sinCotizar: data.sinCotizar ?? 0,
    }
  } catch (e) {
    if (signal.aborted) return { ...VACIO }
    addLog(`⚠ Error en la revisión de niveles — ${(e as Error).message}`)
    return { ...VACIO }
  }
}
