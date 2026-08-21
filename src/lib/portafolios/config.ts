import { CATEGORIA_GAMMA, CATEGORIA_PETER, CATEGORIA_SMALL, CATEGORIA_THETA } from '@/lib/agentes/types'

/**
 * Reglas de los dos portafolios algorítmicos.
 *
 * Son supuestos de cartera, no datos: el portafolio no existe en ninguna tabla,
 * se deriva aplicando estas reglas a las recomendaciones de los agentes. Por eso
 * viven en un único sitio — cambiar el capital o el ticket aquí recalcula todo.
 */

/** Capital asignado al portafolio algorítmico de acciones. */
export const CAPITAL_ACCIONES = 100_000

/** Capital asignado al portafolio algorítmico de opciones. */
export const CAPITAL_OPCIONES = 100_000

/**
 * Importe que se invierte en cada recomendación de acciones.
 *
 * El sizing es fijo a propósito: `cantidad_acciones` de la tabla es lo que el
 * operador teclea a mano en Recomendaciones para su cartera personal, y no
 * tiene nada que ver con la asignación del portafolio algorítmico.
 */
export const TICKET_ACCIONES = 1_000

/** Contratos por señal de opciones. Un contrato equivale a 100 acciones. */
export const CONTRATOS_POR_SENAL = 1

/** Índice contra el que se mide el rendimiento de ambos portafolios. */
export const BENCHMARK = 'SPY'

/** Tasa libre de riesgo anual usada en Sharpe y Sortino. */
export const RISK_FREE = 0.045

/** Sesiones bursátiles al año, para anualizar volatilidad y retornos. */
export const SESIONES_ANUALES = 252

export const STOCK_CATEGORIES: readonly string[] = [CATEGORIA_PETER, CATEGORIA_SMALL]
export const OPTION_CATEGORIES: readonly string[] = [CATEGORIA_GAMMA, CATEGORIA_THETA]
