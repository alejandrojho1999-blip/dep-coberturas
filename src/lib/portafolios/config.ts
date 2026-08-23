import { CATEGORIA_GAMMA, CATEGORIA_PETER, CATEGORIA_SMALL, CATEGORIA_THETA } from '@/lib/agentes/types'

/**
 * Reglas de los portafolios algorítmicos en vivo.
 *
 * Son supuestos de cartera, no datos: el portafolio no existe en ninguna tabla,
 * se deriva aplicando estas reglas a las recomendaciones de los agentes. Por eso
 * viven en un único sitio — cambiar el capital o el ticket aquí recalcula todo.
 */

/** Capital asignado al portafolio algorítmico de acciones. */
export const CAPITAL_ACCIONES = 100_000

/**
 * Capital asignado a las opciones largas, las compras del agente Gamma.
 *
 * Una compra solo arriesga la prima, así que con este capital caben holgadas
 * todas las señales que el agente llega a abrir a la vez.
 */
export const CAPITAL_OPCIONES_LARGAS = 100_000

/**
 * Capital asignado a las opciones cortas, las ventas del agente Theta.
 *
 * Triplica al de las largas porque una venta no inmoviliza la prima sino el
 * colateral que respalda la obligación: el efectivo del strike en un put
 * asegurado y el valor de las acciones en una call cubierta, decenas de miles
 * por contrato. Con los dos agentes compartiendo $100.000 la cartera desplegaba
 * más capital del que tenía.
 */
export const CAPITAL_OPCIONES_CORTAS = 300_000

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

/** Compras de opciones: el agente Gamma paga prima por calls y puts. */
export const OPTION_LONG_CATEGORIES: readonly string[] = [CATEGORIA_GAMMA]

/** Ventas de opciones: el agente Theta cobra prima y aporta colateral. */
export const OPTION_SHORT_CATEGORIES: readonly string[] = [CATEGORIA_THETA]

/** Ambas juntas, para lo que no distingue el lado (cotizar los contratos). */
export const OPTION_CATEGORIES: readonly string[] = [
  ...OPTION_LONG_CATEGORIES,
  ...OPTION_SHORT_CATEGORIES,
]
