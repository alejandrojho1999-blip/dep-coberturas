/**
 * Detección de recomendaciones con el precio de entrada fabricado.
 *
 * Hasta el commit 9e9e3c5, el Agente Peter sobrescribía el precio real de
 * mercado con `precio_objetivo / 1.15` antes de guardarlo como precio de
 * entrada. El resultado era un número que nunca cotizó, así que el rendimiento
 * de esas filas no corresponde a ninguna operación posible.
 *
 * Esas filas se reconocen por dos señales que se dan a la vez:
 *
 *  1. `precio_entrada × 1.15 == precio_objetivo` — la huella aritmética del
 *     cálculo invertido.
 *  2. `ai_report.objetivo_fuente` ausente — el código actual siempre anota de
 *     dónde salió el objetivo (`consenso`, `ia` o `fallback`), así que una fila
 *     sin ese campo es anterior a la corrección.
 *
 * Hacen falta las dos: el fallback actual también produce un objetivo
 * exactamente un 15 % por encima de la entrada cuando no hay consenso ni cifra
 * válida de la IA, pero en ese caso la entrada sí es el precio real y la fila
 * lleva `objetivo_fuente: 'fallback'`.
 */

export interface RecommendationEntryCheck {
  category: string
  precio_entrada: number | null
  precio_objetivo: number | null
  ai_report?: Record<string, unknown> | null
}

/** Ratio que aplicaba el fallback antiguo al construir el objetivo. */
const LEGACY_RATIO = 1.15

/** Holgura por el redondeo a dos decimales de ambos precios. */
const TOLERANCE = 0.02

export function hasFabricatedEntryPrice(rec: RecommendationEntryCheck): boolean {
  // Solo el Agente Peter llegó a guardar el valor invertido.
  if (rec.category !== 'PETER_LYNCH') return false

  const entrada = rec.precio_entrada
  const objetivo = rec.precio_objetivo
  if (entrada == null || objetivo == null || entrada <= 0) return false

  // Las filas generadas tras la corrección siempre declaran el origen.
  if ((rec.ai_report ?? {}).objetivo_fuente != null) return false

  return Math.abs(entrada * LEGACY_RATIO - objetivo) < TOLERANCE
}

/** Texto del aviso que se muestra sobre la fila afectada. */
export const FABRICATED_ENTRY_WARNING =
  'Precio de entrada no fiable: se calculó como objetivo ÷ 1.15, un valor que nunca cotizó. ' +
  'Elimina esta recomendación y vuelve a ejecutar el agente para registrarla con el precio real de mercado.'
