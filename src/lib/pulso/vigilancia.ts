/**
 * Vigilancia de las fuentes del pulso.
 *
 * `recolectarPulso` ya tolera que una fuente falle: cinco de seis es un día
 * peor, no un día perdido. Pero esa tolerancia tiene un precio, y el 2026-09-08
 * se cobró: YouTube estuvo caído de 02:30 a 06:30 —ocho ciclos seguidos— y lo
 * único que quedó fue un `5/6 fuentes vivas` repetido en el log, que nadie mira
 * a esa hora. El sistema siguió midiendo el mundo con un ojo tapado sin decirlo.
 *
 * Aquí se lleva la cuenta de ciclos consecutivos sin datos por fuente y se avisa
 * una sola vez, al cruzar el umbral. Una sola vez es lo importante: el pulso
 * corre cada media hora, así que avisar en cada ciclo convertiría una caída de
 * madrugada en dieciséis mensajes y en la costumbre de ignorarlos.
 */

import type { FuentePulso } from '@/lib/pulso/tipos'

/** Las seis que `recolectarPulso` intenta en cada ciclo. */
export const FUENTES_PULSO: readonly FuentePulso[] = [
  'trends',
  'wikipedia',
  'hn',
  'mastodon',
  'youtube',
  'news',
]

/**
 * Ciclos seguidos sin datos antes de avisar.
 *
 * El pulso corre cada 30 minutos, así que cuatro son dos horas. Por debajo se
 * avisaría de cada tropiezo pasajero —un 429 de la API de Trends, un feed que
 * tarda— y el aviso dejaría de significar nada. La caída del 2026-09-08 duró
 * ocho ciclos: se habría avisado a la mitad.
 */
export const CICLOS_PARA_AVISAR = 4

/** Ciclos consecutivos sin datos, por fuente. Lo que se guarda entre corridas. */
export type EstadoVigilancia = Partial<Record<FuentePulso, number>>

export interface CambiosVigilancia {
  /** Fuentes que cruzan el umbral justo en este ciclo. Solo aquí se avisa. */
  caidas: FuentePulso[]
  /** Fuentes que estaban dadas por caídas y vuelven a traer datos. */
  recuperadas: FuentePulso[]
}

export interface EvaluacionVigilancia {
  estado: EstadoVigilancia
  cambios: CambiosVigilancia
}

/**
 * Actualiza la cuenta y dice qué ha cambiado de estado en este ciclo.
 *
 * Función pura: no lee ni escribe nada. El estado entra y sale como dato, que es
 * lo que la hace comprobable sin tocar el disco.
 *
 * El aviso sale **solo** en el ciclo en que la cuenta llega al umbral, no en los
 * siguientes. Si la fuente sigue caída no se repite; si vuelve, se avisa de la
 * recuperación y la cuenta se pone a cero.
 */
export function evaluarFuentes(
  previo: EstadoVigilancia,
  vivas: readonly FuentePulso[],
  umbral: number = CICLOS_PARA_AVISAR,
): EvaluacionVigilancia {
  const estado: EstadoVigilancia = {}
  const caidas: FuentePulso[] = []
  const recuperadas: FuentePulso[] = []

  for (const fuente of FUENTES_PULSO) {
    const antes = previo[fuente] ?? 0

    if (vivas.includes(fuente)) {
      // Solo se anuncia la vuelta de lo que se había dado por caído; una fuente
      // que falló dos ciclos y volvió no llegó a preocupar a nadie.
      if (antes >= umbral) recuperadas.push(fuente)
      estado[fuente] = 0
      continue
    }

    const ahora = antes + 1
    estado[fuente] = ahora
    if (ahora === umbral) caidas.push(fuente)
  }

  return { estado, cambios: { caidas, recuperadas } }
}

/**
 * El mensaje que se manda al teléfono, o `null` si no hay nada que contar.
 *
 * Se dice cuánto lleva caída en horas y no en ciclos: «2 h sin datos» se
 * entiende a las tres de la mañana, «4 ciclos» hay que traducirlo.
 */
export function mensajeVigilancia(
  cambios: CambiosVigilancia,
  umbral: number = CICLOS_PARA_AVISAR,
  minutosPorCiclo = 30,
): string | null {
  const partes: string[] = []
  const horas = (umbral * minutosPorCiclo) / 60

  if (cambios.caidas.length) {
    const cuanto = Number.isInteger(horas) ? `${horas} h` : `${Math.round(horas * 60)} min`
    partes.push(
      `⚠️ Pulso: ${cambios.caidas.join(', ')} sin datos desde hace ${cuanto}. ` +
      'La probabilidad se está calculando con cobertura incompleta.',
    )
  }

  if (cambios.recuperadas.length) {
    partes.push(`✅ Pulso: ${cambios.recuperadas.join(', ')} vuelve a traer datos.`)
  }

  return partes.length ? partes.join('\n') : null
}
