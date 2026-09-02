import type { FuenteAdjunta } from './types'

/**
 * Reparto del contexto entre los archivos adjuntos.
 *
 * El prompt tiene un presupuesto y los adjuntos no pueden comérselo entero: el
 * contexto de mercado y las instrucciones también tienen que caber. Repartir a
 * partes iguales sería desperdiciar cuota en el archivo de dos páginas mientras
 * se corta el de cuarenta, así que lo que a un archivo corto le sobra vuelve al
 * bote y se reparte entre los que sí lo necesitan.
 */

/** Caracteres totales que los adjuntos pueden ocupar en el prompt. */
export const PRESUPUESTO_TOTAL = 16_000

/** Mínimo por archivo: por debajo, incluirlo no aporta nada. */
export const MINIMO_POR_ARCHIVO = 2_000

export interface AdjuntoConTexto {
  filename: string
  doc_type: string
  texto_extraido: string | null
}

/** Cuánto le toca a cada archivo, redistribuyendo lo que sobra de los cortos. */
export function repartirPresupuesto(
  longitudes: readonly number[],
  presupuesto = PRESUPUESTO_TOTAL,
): number[] {
  const n = longitudes.length
  if (n === 0) return []

  const cuotas = new Array<number>(n).fill(0)
  const pendientes = new Set(longitudes.map((_, i) => i))
  let restante = presupuesto

  // Cada vuelta reparte a partes iguales entre los que aún piden; los que caben
  // enteros se sirven y liberan su sobrante para la vuelta siguiente.
  while (pendientes.size > 0) {
    const cuota = Math.floor(restante / pendientes.size)
    const cabenEnteros = [...pendientes].filter((i) => longitudes[i] <= cuota)
    if (cabenEnteros.length === 0) {
      for (const i of pendientes) cuotas[i] = cuota
      break
    }
    for (const i of cabenEnteros) {
      cuotas[i] = longitudes[i]
      restante -= longitudes[i]
      pendientes.delete(i)
    }
  }

  return cuotas
}

/**
 * Bloque de texto que se le pasa al modelo con el contenido de los adjuntos.
 *
 * Cada archivo va precedido de su nombre exacto para que el modelo pueda
 * citarlo literalmente en la trazabilidad: si no puede nombrar el archivo, la
 * cifra no pasa la comprobación del servidor.
 */
export function construirContextoAdjuntos(
  adjuntos: readonly AdjuntoConTexto[],
  presupuesto = PRESUPUESTO_TOTAL,
): string {
  const conTexto = adjuntos.filter((a) => (a.texto_extraido ?? '').length > 0)
  if (conTexto.length === 0) return ''

  // Con muchos archivos el mínimo no cabe para todos: entran los que quepan y
  // el resto se queda fuera, porque medio archivo no sirve para citar nada.
  const caben = Math.max(1, Math.min(conTexto.length, Math.floor(presupuesto / MINIMO_POR_ARCHIVO)))
  const incluidos = conTexto.slice(0, caben)

  const cuotas = repartirPresupuesto(
    incluidos.map((a) => (a.texto_extraido ?? '').length),
    presupuesto,
  )

  return incluidos
    .map((a, i) => {
      const texto = (a.texto_extraido ?? '').slice(0, cuotas[i])
      const recortado = texto.length < (a.texto_extraido ?? '').length ? '\n[…recortado]' : ''
      return `[FUENTE ${i + 1} — ${a.filename} (${a.doc_type})]\n${texto}${recortado}`
    })
    .join('\n\n---\n\n')
}

/** Resumen de los adjuntos que se imprime en el anexo del documento. */
export function resumirFuentes(adjuntos: readonly AdjuntoConTexto[]): FuenteAdjunta[] {
  return adjuntos.map((a) => ({
    filename: a.filename,
    doc_type: a.doc_type,
    chars: (a.texto_extraido ?? '').length,
  }))
}
