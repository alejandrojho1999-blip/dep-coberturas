/**
 * Cadena de opciones sintética.
 *
 * Reconstruye el contrato que un agente habría elegido en una fecha pasada. No
 * es la cadena real —esa no existe hacia atrás— sino la que Black-Scholes
 * implica dados el subyacente, el plazo, el tipo sin riesgo y la volatilidad que
 * modela `volatilidad.ts`.
 *
 * Dos decisiones sostienen el realismo de lo que sale de aquí:
 *
 *   · Los vencimientos son terceros viernes. Es donde está la liquidez de
 *     verdad, y dejar que el motor elija un martes cualquiera produciría
 *     contratos que nadie habría podido negociar.
 *   · El strike se obtiene invirtiendo el delta objetivo y luego redondeando al
 *     strike **cotizable**. Los agentes filtran por delta, no por strike, así
 *     que este es el orden correcto; redondear después es lo que impide fabricar
 *     contratos con tres decimales que no existen en el mercado.
 */
import { blackScholesPrice, computeGreeks } from '@/lib/options/blackScholes'
import type { OptionType } from '@/lib/options/pricing'
import { HORQUILLA_BASE, HORQUILLA_POR_MONEYNESS } from './config'
import { aplicarSkew } from './volatilidad'

export interface ContratoSintetico {
  tipo: OptionType
  strike: number
  /** Fecha de vencimiento en ISO corto. */
  vencimiento: string
  /** Sesiones naturales hasta el vencimiento. */
  dte: number
  /** Precio teórico medio, por acción. */
  mid: number
  /** Lo que costaría comprarlo, ya con media horquilla en contra. */
  compra: number
  /** Lo que se cobraría vendiéndolo, ya con media horquilla en contra. */
  venta: number
  delta: number
  gamma: number
  theta: number
  vega: number
  /** La IV con la que se valoró, ya con skew si estaba activo. */
  iv: number
}

/* ── Vencimientos ────────────────────────────────────────────────────────── */

/** Tercer viernes del mes indicado (`mes` en base 0), en UTC. */
export function tercerViernes(anio: number, mes: number): Date {
  const primero = new Date(Date.UTC(anio, mes, 1))
  // 5 = viernes. Cuántos días faltan desde el día 1 hasta el primer viernes.
  const offset = (5 - primero.getUTCDay() + 7) % 7
  return new Date(Date.UTC(anio, mes, 1 + offset + 14))
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Fechas en las que el motor decide: los terceros viernes de cada mes.
 *
 * No es una comodidad, es lo único que funciona. Con vencimientos mensuales hay
 * tramos de cada mes en los que **ningún** vencimiento cae dentro de la ventana
 * de plazo de los agentes: el 5 de enero de 2026, por ejemplo, los vencimientos
 * más cercanos están a 11 y a 46 días, y Theta pide entre 21 y 45. Un motor que
 * evaluara a diario pasaría media vida sin poder operar, y las entradas que
 * lograra abrir dependerían del día del mes en que arrancó la simulación.
 *
 * Decidiendo en el vencimiento, el siguiente queda siempre a 28-35 días: dentro
 * de la ventana de Theta y de la de Gamma. Es además el calendario exacto del
 * índice `^PUT`, que rota justo el día de vencimiento, así que la calibración
 * compara dos estrategias con el mismo ritmo en vez de dos ritmos distintos.
 */
export function fechasDeRebalanceo(desde: string, hasta: string): string[] {
  const fin = new Date(`${hasta}T00:00:00Z`)
  const ini = new Date(`${desde}T00:00:00Z`)
  const salida: string[] = []

  const cursor = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth(), 1))
  while (cursor <= fin) {
    const v = tercerViernes(cursor.getUTCFullYear(), cursor.getUTCMonth())
    if (v >= ini && v <= fin) salida.push(iso(v))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return salida
}

/**
 * Vencimientos estándar disponibles a partir de una fecha, dentro de una ventana
 * de días. Devuelve los terceros viernes de los próximos meses.
 */
export function vencimientosDisponibles(desde: string, dteMin: number, dteMax: number): Array<{ fecha: string; dte: number }> {
  const hoy = new Date(`${desde}T00:00:00Z`)
  const salida: Array<{ fecha: string; dte: number }> = []

  // Seis meses por delante cubren de sobra cualquier ventana que usen los
  // agentes (el techo de Gamma son 90 días).
  for (let i = 0; i <= 6; i++) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + i, 1))
    const venc = tercerViernes(d.getUTCFullYear(), d.getUTCMonth())
    const dte = Math.round((venc.getTime() - hoy.getTime()) / 86_400_000)
    if (dte >= dteMin && dte <= dteMax) salida.push({ fecha: iso(venc), dte })
  }

  return salida.sort((a, b) => a.dte - b.dte)
}

/* ── Strikes ─────────────────────────────────────────────────────────────── */

/**
 * Paso entre strikes cotizables, según el precio del subyacente.
 *
 * Refleja lo que hacen las bolsas americanas: $1 en valores baratos, $2,50 en la
 * franja media y $5 en los caros. Sin esto se fabricarían strikes imposibles y
 * el backtest se atribuiría una precisión que el mercado no ofrece.
 */
export function pasoDeStrike(spot: number): number {
  if (spot < 25) return 1
  if (spot < 200) return 2.5
  return 5
}

/** Redondea al strike cotizable más cercano. */
export function strikeCotizable(objetivo: number, spot: number): number {
  const paso = pasoDeStrike(spot)
  return Math.round(objetivo / paso) * paso
}

/**
 * Busca el strike cuyo delta se acerca más al objetivo, por bisección.
 *
 * El delta es monótono en el strike —sube al bajar el strike en calls, y al
 * revés en puts—, así que la bisección converge sin sorpresas. Se trabaja con el
 * delta en valor absoluto porque los agentes declaran sus filtros así
 * (Theta pide |Δ| ∈ [0,15; 0,35], sin importar el signo).
 */
export function strikePorDelta(args: {
  tipo: OptionType
  spot: number
  deltaObjetivo: number
  T: number
  r: number
  iv: number
}): number | null {
  const { tipo, spot, deltaObjetivo, T, r, iv } = args
  if (!(spot > 0) || !(T > 0) || !(iv > 0)) return null

  const deltaEn = (K: number) =>
    Math.abs(computeGreeks({ type: tipo, S: spot, K, T, r, sigma: iv }).delta)

  // Horquilla amplia: un delta de 0,05 puede estar muy lejos del dinero cuando
  // la volatilidad es alta.
  let bajo = spot * 0.20
  let alto = spot * 3.00

  // El delta decrece con el strike en calls y crece en puts; se orienta la
  // bisección según el caso en vez de suponer un sentido.
  const creciente = deltaEn(alto) > deltaEn(bajo)

  for (let i = 0; i < 60; i++) {
    const medio = (bajo + alto) / 2
    const d = deltaEn(medio)
    if (!Number.isFinite(d)) return null
    if (Math.abs(d - deltaObjetivo) < 1e-5) return medio
    if ((d < deltaObjetivo) === creciente) bajo = medio
    else alto = medio
  }

  return (bajo + alto) / 2
}

/* ── Construcción del contrato ───────────────────────────────────────────── */

/**
 * Horquilla como fracción del mid.
 *
 * Se ensancha cuanto más lejos del dinero está el contrato, que es lo que pasa
 * en el mercado: un put muy OTM vale centavos y su horquilla se come una parte
 * enorme de la prima. Cobrar y pagar al precio teórico regalaría al backtest un
 * dinero que nadie consigue.
 */
export function horquillaFraccion(spot: number, strike: number): number {
  const moneyness = Math.abs(Math.log(strike / spot))
  return HORQUILLA_BASE + HORQUILLA_POR_MONEYNESS * moneyness
}

export interface ArgsContrato {
  tipo: OptionType
  spot: number
  strike: number
  vencimiento: string
  dte: number
  /** IV base, antes de aplicar el skew. */
  ivBase: number
  r: number
  /** Pendiente del skew; 0 deja la superficie plana. */
  skew?: number
}

/** Valora un contrato concreto y devuelve precio, griegas y horquilla. */
export function construirContrato(a: ArgsContrato): ContratoSintetico | null {
  const { tipo, spot, strike, vencimiento, dte, ivBase, r } = a
  if (!(spot > 0) || !(strike > 0) || dte <= 0) return null

  const iv = aplicarSkew(ivBase, spot, strike, a.skew ?? 0)
  const T = dte / 365
  const entrada = { type: tipo, S: spot, K: strike, T, r, sigma: iv }

  const mid = blackScholesPrice(entrada)
  if (!Number.isFinite(mid) || mid <= 0) return null

  const g = computeGreeks(entrada)
  const media = (mid * horquillaFraccion(spot, strike)) / 2

  return {
    tipo, strike, vencimiento, dte, iv, mid,
    // Quien compra paga por encima del mid y quien vende cobra por debajo: la
    // horquilla siempre juega en contra de quien cruza el mercado.
    compra: mid + media,
    venta: Math.max(0.01, mid - media),
    delta: g.delta,
    gamma: g.gamma,
    theta: g.theta,
    vega: g.vega,
  }
}

/**
 * Elige el contrato que habría escogido un agente: el del delta objetivo dentro
 * de su ventana de plazo.
 *
 * Devuelve `null` cuando no hay ningún vencimiento estándar en la ventana o
 * cuando el strike resultante no es valorable. Que devuelva `null` es
 * información: significa que ese día el agente no habría podido operar, y el
 * motor debe respetarlo en vez de forzar una entrada.
 */
export function elegirContrato(args: {
  tipo: OptionType
  fecha: string
  spot: number
  deltaObjetivo: number
  dteMin: number
  dteMax: number
  iv: number
  r: number
  skew?: number
}): ContratoSintetico | null {
  const vencs = vencimientosDisponibles(args.fecha, args.dteMin, args.dteMax)
  if (!vencs.length) return null

  // El vencimiento más cercano dentro de la ventana: es el que concentra la
  // liquidez y el que ambos agentes eligen en producción.
  const venc = vencs[0]
  const T = venc.dte / 365

  const bruto = strikePorDelta({
    tipo: args.tipo, spot: args.spot, deltaObjetivo: args.deltaObjetivo,
    T, r: args.r, iv: args.iv,
  })
  if (bruto == null) return null

  return construirContrato({
    tipo: args.tipo,
    spot: args.spot,
    strike: strikeCotizable(bruto, args.spot),
    vencimiento: venc.fecha,
    dte: venc.dte,
    ivBase: args.iv,
    r: args.r,
    skew: args.skew,
  })
}
