import type { OptionSide } from './mark'

/**
 * Niveles de salida de las recomendaciones de opciones.
 *
 * Gamma y Theta guardaban un objetivo y un stop que ningún proceso leía. Aquí
 * viven ahora los múltiplos y la comparación, en funciones puras y sin fetch,
 * para que los agentes, la UI y un futuro cron usen exactamente el mismo
 * criterio.
 *
 * IMPORTANTE: esto NO es un stop-loss. Los agentes solo corren cuando el
 * usuario pulsa el botón, así que estos niveles son las órdenes que hay que
 * colocar en el bróker; el sistema únicamente los revisa al ejecutarse y
 * refleja lo que ya ocurrió. Entre ejecuciones no vigila nadie.
 */

/** Gamma compra la prima: sale al 250 % o al perder la mitad de lo pagado. */
export const LONG_OBJETIVO_MULT = 2.5
export const LONG_STOP_MULT = 0.5

/**
 * Theta cobra la prima: recompra al 50 % de lo cobrado (la mitad del beneficio
 * ya está capturada y el tramo final es el de peor relación riesgo/recompensa),
 * y corta si la prima se dobla, o sea al perder una vez lo cobrado.
 */
export const SHORT_OBJETIVO_MULT = 0.5
export const SHORT_STOP_MULT = 2

export interface ExitLevels {
  /** Prima a la que se cierra en beneficio. */
  objetivo: number
  /** Prima a la que se corta la pérdida. */
  stop: number
}

/** Redondeo al mismo detalle con el que se guarda la prima de entrada. */
function redondea(valor: number): number {
  return parseFloat(valor.toFixed(4))
}

/**
 * Niveles de salida de una posición según su lado y la prima de entrada.
 * Devuelve `null` si la prima no es un número positivo y finito.
 */
export function nivelesSalida(side: OptionSide, prima: number): ExitLevels | null {
  if (!Number.isFinite(prima) || prima <= 0) return null

  return side === 'short'
    ? {
        objetivo: redondea(prima * SHORT_OBJETIVO_MULT),
        stop: redondea(prima * SHORT_STOP_MULT),
      }
    : {
        objetivo: redondea(prima * LONG_OBJETIVO_MULT),
        stop: redondea(prima * LONG_STOP_MULT),
      }
}

export interface ExitEvaluation {
  accion: 'mantener' | 'objetivo' | 'stop'
  /** Resultado sobre la prima de entrada, en porcentaje. */
  pnlPct: number
  niveles: ExitLevels
}

/**
 * Compara la prima viva con los niveles de la posición.
 *
 * La comparación se invierte según el lado y ahí está todo el riesgo de este
 * módulo: en `long` se gana cuando la prima **sube**, en `short` cuando
 * **baja**, porque recomprar más barato de lo que se cobró es el beneficio.
 *
 * Devuelve `null` si la entrada o la prima viva no son números utilizables.
 */
export function evaluarSalida(
  side: OptionSide,
  entrada: number,
  primaViva: number
): ExitEvaluation | null {
  const niveles = nivelesSalida(side, entrada)
  if (!niveles) return null
  if (!Number.isFinite(primaViva) || primaViva < 0) return null

  const porAccion = side === 'short' ? entrada - primaViva : primaViva - entrada
  const pnlPct = (porAccion / entrada) * 100

  let accion: ExitEvaluation['accion'] = 'mantener'
  if (side === 'short') {
    if (primaViva <= niveles.objetivo) accion = 'objetivo'
    else if (primaViva >= niveles.stop) accion = 'stop'
  } else {
    if (primaViva >= niveles.objetivo) accion = 'objetivo'
    else if (primaViva <= niveles.stop) accion = 'stop'
  }

  return { accion, pnlPct, niveles }
}
