/**
 * ATR (Average True Range) de Wilder.
 *
 * El nivel de una orden stop tiene que respirar lo que respira el activo: medio
 * ATR en el oro son unos tres dólares y en bitcoin casi mil, y un porcentaje
 * fijo trataría a los dos por igual. Aquí se calcula el rango verdadero clásico
 * (Wilder, 1978) y su media suavizada, que es la que usan los brókers.
 */

export interface Vela {
  date: string
  high: number
  low: number
  close: number
}

/**
 * Rango verdadero de una vela.
 *
 * El máximo de los tres candidatos, no solo `high - low`: un hueco de apertura
 * es movimiento real aunque la vela sea estrecha, y sin el cierre anterior se
 * subestimaría justo en los días que importan.
 */
export function trueRange(vela: Vela, cierreAnterior: number | null): number {
  const rango = vela.high - vela.low
  if (cierreAnterior == null) return rango
  return Math.max(
    rango,
    Math.abs(vela.high - cierreAnterior),
    Math.abs(vela.low - cierreAnterior),
  )
}

/**
 * ATR suavizado de Wilder sobre las últimas `periodo` velas.
 *
 * Devuelve `null` si no hay historia suficiente: preferimos no mandar la señal
 * a mandarla con un nivel calculado sobre cuatro velas. La primera lectura es
 * la media simple de los primeros `periodo` rangos y a partir de ahí se aplica
 * el suavizado `(ATR_anterior * (n-1) + TR) / n`.
 */
export function atr(velas: Vela[], periodo = 14): number | null {
  if (periodo < 1) throw new Error('El periodo del ATR debe ser al menos 1')
  if (velas.length < periodo + 1) return null

  const rangos: number[] = []
  for (let i = 1; i < velas.length; i++) {
    rangos.push(trueRange(velas[i], velas[i - 1].close))
  }
  if (rangos.length < periodo) return null

  let valor = rangos.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo
  for (let i = periodo; i < rangos.length; i++) {
    valor = (valor * (periodo - 1) + rangos[i]) / periodo
  }

  return Number.isFinite(valor) ? valor : null
}
