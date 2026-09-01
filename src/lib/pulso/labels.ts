/**
 * Qué pasó de verdad después de cada día.
 *
 * Sin esto no hay modelo: una probabilidad solo se puede aprender contra un
 * desenlace conocido. Las dos etiquetas se calculan mirando hacia delante desde
 * el día que se etiqueta, y por eso un día no se puede etiquetar hasta que su
 * ventana ha terminado. Es la regla que impide el error clásico de entrenar con
 * información que el día en cuestión no tenía.
 *
 * Las dos son deliberadamente distintas en naturaleza y hay que decirlo en voz
 * alta: la de mercado sale de los cierres y es verificable por cualquiera; la
 * geopolítica sale del juicio del modelo de lenguaje y hereda su criterio. La
 * segunda vale para ordenar días, no para presumir de haber predicho la
 * historia.
 */

import type { Vela } from '@/lib/alertas/atr'
import type { FilaKeyword } from '@/lib/pulso/persistencia'

/**
 * Sesiones hacia delante que mira cada etiqueta.
 *
 * Esta ventana impone un techo al AUC que conviene conocer antes de juzgar el
 * modelo. Un solo susto marca con un 1 los cinco días anteriores, pero la
 * subida de atención pública ocurre en uno o dos de ellos: los otros tres o
 * cuatro son positivos que, mirando sus features, parecen días tranquilos.
 * Medido sobre un escenario sintético con la señal plantada a propósito, solo
 * el 20% de los días positivos eran distinguibles, y el AUC fuera de muestra se
 * estancó en 0.59 por más historia que se le diera.
 *
 * Es decir: un AUC de 0.6 aquí no es un modelo mediocre, es cerca de lo máximo
 * que permite etiquetar por ventana. Bajar la ventana afinaría la etiqueta pero
 * dejaría casi sin positivos con los que entrenar.
 */
export const VENTANA_DIAS = 5

/** Un salto del VIX de esta magnitud es un susto de verdad, no ruido diario. */
export const SALTO_VIX = 0.15

/** Una caída del SPY de este tamaño en una semana ya duele en la cartera. */
export const CAIDA_SPY = -0.02

/** Relevancia mínima del juez para dar un día por geopolíticamente movido. */
export const RELEVANCIA_MINIMA = 4

export interface Etiqueta {
  dia: string
  etiqueta: 0 | 1
  detalle: Record<string, unknown>
}

/**
 * Riesgo de shock de mercado: ¿en las cinco sesiones siguientes el VIX saltó un
 * 15% o el SPY cayó un 2%?
 *
 * Se toma el peor caso de la ventana y no el valor final: lo que importa es si
 * hubo susto en algún momento, no si el índice se recuperó antes del viernes.
 */
export function etiquetasMercado(spy: Vela[], vix: Vela[]): Etiqueta[] {
  const vixPorDia = new Map(vix.map((v) => [v.date, v.close]))
  const etiquetas: Etiqueta[] = []

  for (let i = 0; i < spy.length - VENTANA_DIAS; i++) {
    const dia = spy[i].date
    const cierreSpy = spy[i].close
    const cierreVix = vixPorDia.get(dia)

    const ventana = spy.slice(i + 1, i + 1 + VENTANA_DIAS)
    const caidaSpy = Math.min(...ventana.map((v) => v.close / cierreSpy - 1))

    const vixVentana = ventana
      .map((v) => vixPorDia.get(v.date))
      .filter((c): c is number => typeof c === 'number')
    const saltoVix = cierreVix && vixVentana.length
      ? Math.max(...vixVentana.map((c) => c / cierreVix - 1))
      : null

    const disparo = caidaSpy <= CAIDA_SPY || (saltoVix !== null && saltoVix >= SALTO_VIX)

    etiquetas.push({
      dia,
      etiqueta: disparo ? 1 : 0,
      detalle: {
        caidaSpy: Number(caidaSpy.toFixed(4)),
        saltoVix: saltoVix === null ? null : Number(saltoVix.toFixed(4)),
        // Sin esto, dentro de un año nadie sabrá contra qué umbral se etiquetó.
        umbrales: { caidaSpy: CAIDA_SPY, saltoVix: SALTO_VIX, ventanaDias: VENTANA_DIAS },
      },
    })
  }

  return etiquetas
}

/**
 * Riesgo geopolítico: ¿en los cinco días siguientes apareció alguna palabra
 * clave que el juez puntuara 4 o 5?
 *
 * Se reutiliza el juicio que ya se hizo al detectar los emergentes en vez de
 * pedir uno nuevo. No es solo ahorro: preguntar dos veces por lo mismo daría
 * dos respuestas distintas y la etiqueta dejaría de ser reproducible.
 *
 * `dias` tiene que ser la lista de días con datos, en orden, para que la
 * ventana cuente días observados y no huecos del calendario.
 */
export function etiquetasGeopoliticas(dias: string[], keywords: FilaKeyword[]): Etiqueta[] {
  const relevantesPorDia = new Map<string, FilaKeyword[]>()
  for (const k of keywords) {
    if ((k.relevancia ?? 0) < RELEVANCIA_MINIMA) continue
    relevantesPorDia.set(k.dia, [...(relevantesPorDia.get(k.dia) ?? []), k])
  }

  const ordenados = [...dias].sort()
  const etiquetas: Etiqueta[] = []

  for (let i = 0; i < ordenados.length - VENTANA_DIAS; i++) {
    const ventana = ordenados.slice(i + 1, i + 1 + VENTANA_DIAS)
    const disparadores = ventana.flatMap((d) => relevantesPorDia.get(d) ?? [])

    etiquetas.push({
      dia: ordenados[i],
      etiqueta: disparadores.length ? 1 : 0,
      detalle: {
        terminos: disparadores.slice(0, 5).map((k) => ({
          dia: k.dia, termino: k.termino, relevancia: k.relevancia, tema: k.tema,
        })),
        criterio: `relevancia >= ${RELEVANCIA_MINIMA} en los ${VENTANA_DIAS} días siguientes`,
        // Se deja constancia de que esta etiqueta es una opinión del modelo.
        fuente: 'juicio del modelo de lenguaje sobre términos emergentes',
      },
    })
  }

  return etiquetas
}
