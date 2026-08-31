/**
 * Niveles de las órdenes stop sugeridas.
 *
 * La orden va siempre *más allá* del precio actual en el sentido del
 * movimiento esperado: un buy stop por encima para no comprar en un rebote que
 * se agota, y un sell stop por debajo para no vender en un susto que se corrige
 * solo. La distancia es una fracción del ATR, así que un activo tranquilo
 * necesita menos confirmación que uno nervioso.
 */

import type { SimboloAlerta } from '@/lib/alertas/simbolos'

/** Fracción de ATR por encima (o debajo) del precio. Configurable por entorno. */
export const K_ATR_POR_DEFECTO = 0.5

export function factorAtr(): number {
  const raw = process.env.ALERTAS_ATR_K
  const k = raw ? Number(raw) : NaN
  return Number.isFinite(k) && k > 0 ? k : K_ATR_POR_DEFECTO
}

/**
 * Redondea al tick del contrato.
 *
 * `Math.round(x / tick) * tick` arrastra el error binario del flotante
 * (0.1 + 0.2), así que se corta a los decimales que el propio tick implica.
 */
export function redondearATick(valor: number, tick: number): number {
  if (!(tick > 0)) return valor
  const decimales = (String(tick).split('.')[1] ?? '').length
  return Number((Math.round(valor / tick) * tick).toFixed(decimales))
}

export interface NivelOrden {
  direccion: 'buy' | 'sell'
  precio: number
  nivel: number
  atr: number
  k: number
  /** Distancia del nivel al precio, en porcentaje. Para juzgar si es razonable. */
  distanciaPct: number
}

/**
 * Nivel de la orden a partir del precio y el ATR.
 *
 * `atr` puede llegar como `null` cuando el activo no tiene historia suficiente;
 * en ese caso no se inventa una distancia, se devuelve `null` y el mensaje sale
 * sin nivel en lugar de con un nivel falso.
 */
export function calcularNivel(
  direccion: 'buy' | 'sell',
  precio: number,
  atrValor: number | null,
  simbolo: SimboloAlerta,
  k = factorAtr(),
): NivelOrden | null {
  if (!Number.isFinite(precio) || precio <= 0) return null
  if (atrValor == null || !Number.isFinite(atrValor) || atrValor <= 0) return null

  const desplazamiento = atrValor * k
  const bruto = direccion === 'buy' ? precio + desplazamiento : precio - desplazamiento
  if (bruto <= 0) return null

  const nivel = redondearATick(bruto, simbolo.tick)

  return {
    direccion,
    precio,
    nivel,
    atr: atrValor,
    k,
    distanciaPct: (Math.abs(nivel - precio) / precio) * 100,
  }
}
