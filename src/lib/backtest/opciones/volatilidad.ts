/**
 * Modelo de volatilidad implícita para el backtest de opciones.
 *
 * Este es el módulo delicado del estudio, así que conviene decir en voz alta qué
 * problema resuelve y cuál no.
 *
 * No existe histórico gratuito de superficies de volatilidad implícita. Las
 * primas hay que reconstruirlas con Black-Scholes, y Black-Scholes necesita una
 * IV que no tenemos. Lo único observable hacia atrás es la volatilidad
 * **realizada** del subyacente.
 *
 * La relación entre ambas tiene nombre: la prima de riesgo de varianza. La
 * implícita suele ir por encima de la realizada porque quien vende opciones
 * cobra por asumir el riesgo de que el mercado se mueva más de lo esperado. Ese
 * exceso *es* la ventaja que Theta explota.
 *
 * De ahí la trampa: si se modela `IV = realizada × k`, entonces `k` decide por sí
 * solo si Theta gana dinero. Ponerlo a 1,15 garantiza que gane; ponerlo a 1,00
 * garantiza que pierda. Eso no es medir, es suponer con pasos intermedios.
 *
 * Por eso `k` no se elige: se **calibra** contra `^PUT`, el índice PutWrite del
 * CBOE, que vende puts sobre el S&P 500 con precios de opciones reales desde
 * 2005. El `k` que reproduce ese índice es un parámetro ajustado contra el
 * mercado, y su error residual mide cuánto puede uno fiarse del modelo.
 */
import { SESIONES_ANUALES, VENTANA_VOL_REALIZADA } from './config'

/** Serie diaria de cierres, ordenada de más antiguo a más reciente. */
export interface SerieDiaria {
  fechas: string[]
  cierres: number[]
}

/**
 * Volatilidad realizada anualizada, ventana móvil de cierre a cierre.
 *
 * Devuelve un array alineado con `cierres`: la posición `i` contiene la
 * volatilidad calculada con las `ventana` sesiones que **terminan** en `i`, o
 * `null` si no hay suficiente historia. Alinear así importa: usar rendimientos
 * posteriores a la fecha de decisión sería mirar el futuro.
 */
export function volatilidadRealizada(cierres: number[], ventana = VENTANA_VOL_REALIZADA): Array<number | null> {
  const salida: Array<number | null> = new Array(cierres.length).fill(null)
  if (cierres.length < 2) return salida

  const logRet: Array<number | null> = new Array(cierres.length).fill(null)
  for (let i = 1; i < cierres.length; i++) {
    const a = cierres[i - 1]
    const b = cierres[i]
    logRet[i] = a > 0 && b > 0 ? Math.log(b / a) : null
  }

  for (let i = ventana; i < cierres.length; i++) {
    const trozo: number[] = []
    for (let j = i - ventana + 1; j <= i; j++) {
      const r = logRet[j]
      if (r != null && Number.isFinite(r)) trozo.push(r)
    }
    // Con huecos en la serie el tramo puede quedar corto; se exige la mayoría
    // de la ventana antes de dar una cifra por buena.
    if (trozo.length < ventana * 0.8) continue

    const media = trozo.reduce((a, x) => a + x, 0) / trozo.length
    const varianza = trozo.reduce((a, x) => a + (x - media) ** 2, 0) / (trozo.length - 1)
    salida[i] = Math.sqrt(varianza * SESIONES_ANUALES)
  }

  return salida
}

/**
 * Cómo se convierte la volatilidad realizada en implícita.
 *
 * - `constante`: `IV = realizada × k`. Simple y transparente, pero supone que la
 *   prima de varianza es la misma en calma que en pánico, y no lo es.
 * - `regimen`: usa el cociente `VIX / realizada_SPY` del día como medida de la
 *   prima de varianza vigente, escalado por `k`. Recoge que la prima se dispara
 *   cuando el mercado se asusta y se comprime cuando duerme, que es justo cuando
 *   Theta gana o pierde de verdad. Es más realista y por eso más exigente.
 */
export type ModoVolatilidad = 'constante' | 'regimen'

export interface EntradaModelo {
  /** Volatilidad realizada del subyacente en la fecha de decisión. */
  realizada: number
  /** Cociente VIX/realizada_SPY del día; solo lo usa el modo `regimen`. */
  primaDeMercado?: number | null
  k: number
  modo: ModoVolatilidad
}

/**
 * Suelo y techo de la IV resultante.
 *
 * Sin acotar, una racha lateral produce volatilidades cercanas a cero y
 * Black-Scholes devuelve primas ridículas que el motor compraría a millares. El
 * techo evita lo simétrico en marzo de 2020. Los dos bordes son declarados y se
 * cuenta cuántas veces se activan: si el resultado depende de ellos, no vale.
 */
export const IV_MINIMA = 0.08
export const IV_MAXIMA = 2.00

/** Convierte volatilidad realizada en implícita según el modo elegido. */
export function volatilidadImplicita(e: EntradaModelo): number | null {
  if (!Number.isFinite(e.realizada) || e.realizada <= 0) return null

  let iv: number
  if (e.modo === 'regimen') {
    // Sin dato de mercado el modo régimen no puede aplicarse; se degrada al
    // constante en vez de inventarse una prima.
    const prima = e.primaDeMercado
    iv = prima != null && Number.isFinite(prima) && prima > 0
      ? e.realizada * prima * e.k
      : e.realizada * e.k
  } else {
    iv = e.realizada * e.k
  }

  if (!Number.isFinite(iv) || iv <= 0) return null
  return Math.min(IV_MAXIMA, Math.max(IV_MINIMA, iv))
}

/**
 * Prima de varianza del mercado, día a día: `VIX / realizada_SPY`.
 *
 * El VIX viene en puntos de porcentaje (15,2 significa 15,2 %), así que se
 * divide por 100 antes de compararlo con una volatilidad en fracción. Es el
 * error más fácil de cometer aquí y multiplicaría todas las primas por cien.
 */
export function primaDeVarianza(
  vixCierres: number[],
  realizadaSpy: Array<number | null>,
): Array<number | null> {
  const n = Math.min(vixCierres.length, realizadaSpy.length)
  const salida: Array<number | null> = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    const vix = vixCierres[i] / 100
    const rv = realizadaSpy[i]
    if (rv == null || rv <= 0 || !Number.isFinite(vix) || vix <= 0) continue
    salida[i] = vix / rv
  }
  return salida
}

/**
 * Sesgo por moneyness (el «skew» de las opciones sobre acciones).
 *
 * En el mercado real los puts fuera del dinero cotizan con IV más alta que las
 * calls equivalentes: la gente paga de más por asegurarse contra caídas. Una
 * superficie plana **infravalora justo las primas que Theta cobra**, así que el
 * sesgo va en contra de Theta y a favor de Gamma cuando compra puts.
 *
 * Se modela como una pendiente lineal en log-moneyness, que es la aproximación
 * de primer orden habitual. Con `pendiente = 0` se recupera la superficie plana,
 * que es la variante base del estudio; la versión con skew se corre como prueba
 * de robustez para saber cuánto del resultado depende de esta simplificación.
 */
export const PENDIENTE_SKEW = 0.15

export function aplicarSkew(
  ivBase: number,
  spot: number,
  strike: number,
  pendiente = PENDIENTE_SKEW,
): number {
  if (pendiente === 0) return ivBase
  if (!(spot > 0) || !(strike > 0)) return ivBase
  // log(K/S) < 0 para strikes por debajo del spot, que es donde viven los puts
  // OTM: la pendiente negativa les sube la IV.
  const logMoneyness = Math.log(strike / spot)
  const iv = ivBase * (1 - pendiente * logMoneyness)
  return Math.min(IV_MAXIMA, Math.max(IV_MINIMA, iv))
}

/**
 * Tipo sin riesgo a partir de `^IRX`, la letra del Tesoro a 13 semanas.
 *
 * Yahoo devuelve el índice en puntos de porcentaje anualizados, así que 4,5
 * significa 4,5 %. Sustituye a la constante `RISK_FREE = 0.045` que usa el resto
 * de la aplicación: sobre 21 años esa constante es sencillamente falsa, porque
 * los tipos fueron del 5 % al 0 % y de vuelta al 5 %.
 */
export function tipoSinRiesgo(irxCierre: number | null | undefined): number {
  if (irxCierre == null || !Number.isFinite(irxCierre)) return 0.045
  const r = irxCierre / 100
  // En 2008 y 2020 la letra llegó a cotizar en negativo por escasez de
  // colateral. Un tipo negativo rompe Black-Scholes sin aportar nada, así que
  // se pisa a cero.
  return Math.min(0.20, Math.max(0, r))
}
