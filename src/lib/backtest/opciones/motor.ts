/**
 * Motor de simulación de carteras de opciones.
 *
 * No reutiliza `../engine.ts` porque aquel está acoplado al screener Lynch y
 * asume un precio por ticker y fecha. Aquí una posición tiene strike,
 * vencimiento, prima y lado, y su valor cambia aunque el subyacente no se mueva:
 * el tiempo corre y la prima se derrite. Son dos problemas distintos.
 *
 * El ritmo es doble a propósito:
 *   · **Se abre** solo en los vencimientos, porque es el único calendario en el
 *     que siempre hay un contrato dentro de la ventana de plazo de los agentes
 *     (ver `cadena.ts:fechasDeRebalanceo`).
 *   · **Se vigila a diario**, porque los niveles de salida saltan cuando saltan.
 *     Revisar solo una vez al mes regalaría al backtest posiciones que en la
 *     realidad se habrían cerrado en pérdidas mucho antes.
 */
import { blackScholesPrice } from '@/lib/options/blackScholes'
import type { OptionType } from '@/lib/options/pricing'
import { evaluarSalida } from '@/lib/options/exit-levels'
import { settleOption, type SettlementPosition } from '@/lib/options/settlement'
import { CONTRACT_MULTIPLIER, COMISION_POR_CONTRATO, MARGEN_SHORT_PUT } from './config'
import { construirContrato, type ContratoSintetico } from './cadena'

/* ── Tipos ───────────────────────────────────────────────────────────────── */

/** Lo que el motor necesita saber de un subyacente en una fecha. */
export interface EstadoSubyacente {
  spot: number
  /** IV base ya modelada, antes del skew. */
  iv: number
  r: number
}

/** Una orden de apertura que produce la cascada de un agente. */
export interface Orden {
  ticker: string
  tipo: OptionType
  /** Comprada (Gamma) o vendida (Theta). */
  lado: 'long' | 'short'
  contrato: ContratoSintetico
}

export interface PosicionAbierta extends Orden {
  fechaEntrada: string
  /** Prima por acción efectivamente pagada o cobrada, ya con horquilla. */
  primaEntrada: number
  contratos: number
  /** Efectivo inmovilizado como garantía mientras la posición vive. */
  garantia: number
}

export interface OperacionOpciones {
  ticker: string
  lado: 'long' | 'short'
  tipo: OptionType
  strike: number
  vencimiento: string
  fechaEntrada: string
  fechaSalida: string
  primaEntrada: number
  primaSalida: number
  contratos: number
  /** Resultado en dólares, neto de horquilla y comisiones. */
  resultado: number
  /** Resultado sobre el capital comprometido, en fracción. */
  retorno: number
  motivoSalida: 'objetivo' | 'stop' | 'vencimiento'
  dteEntrada: number
  deltaEntrada: number
  ivEntrada: number
}

export interface ResultadoOpciones {
  curva: Array<{ fecha: string; valor: number }>
  operaciones: OperacionOpciones[]
  /** Retornos entre fechas de rebalanceo, para los contrastes estadísticos. */
  retornos: Array<{ fecha: string; retorno: number }>
  posicionesPorFecha: Array<{ fecha: string; n: number }>
  /** Meses sin ninguna posición abierta: si son muchos, el agente no opera. */
  fechasSinPosiciones: number
  /**
   * Fecha en la que el patrimonio se agotó, si llegó a ocurrir.
   *
   * Una cartera de opciones vendidas puede perder más que la prima cobrada: si
   * el subyacente se desploma, la obligación de recomprar supera lo que hay en
   * caja. Eso es la ruina, y hay que contarlo como tal en vez de dejar que el
   * patrimonio cruce el cero y las métricas salgan `NaN`.
   */
  fechaDeRuina: string | null
}

/** Qué posición de liquidación corresponde a cada combinación de lado y tipo. */
export function posicionDeLiquidacion(lado: 'long' | 'short', tipo: OptionType): SettlementPosition {
  if (lado === 'long') return tipo === 'call' ? 'LONG_CALL' : 'LONG_PUT'
  return tipo === 'call' ? 'COVERED_CALL' : 'SHORT_PUT'
}

/* ── Valoración ──────────────────────────────────────────────────────────── */

/** Días naturales entre dos fechas ISO. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

/**
 * Reprecia una posición viva contra el mercado del día.
 *
 * Devuelve la prima por acción. Al llegar el vencimiento el valor es puramente
 * intrínseco, que es lo que hace `settlement.ts`; aquí se delega en
 * Black-Scholes mientras quede tiempo y se deja que el llamador liquide cuando
 * el plazo se agota.
 */
export function repreciar(p: PosicionAbierta, fecha: string, estado: EstadoSubyacente): number | null {
  const dte = diasEntre(fecha, p.contrato.vencimiento)
  if (dte <= 0) return null

  const precio = blackScholesPrice({
    type: p.tipo, S: estado.spot, K: p.contrato.strike,
    T: dte / 365, r: estado.r, sigma: estado.iv,
  })
  return Number.isFinite(precio) && precio > 0 ? precio : 0.01
}

/* ── Motor ───────────────────────────────────────────────────────────────── */

export interface OpcionesMotor {
  capital: number
  /** Fechas de decisión: los terceros viernes. */
  fechasRebalanceo: string[]
  /** Todas las sesiones del periodo, para la vigilancia diaria. */
  sesiones: string[]
  /**
   * Genera las órdenes de un día de rebalanceo. Es la cascada del agente, que
   * el motor no conoce: aquí solo se ejecuta lo que decida.
   */
  generarOrdenes: (fecha: string) => Orden[]
  /** Estado del subyacente en una fecha, o null si ese día no cotiza. */
  estadoEn: (ticker: string, fecha: string) => EstadoSubyacente | null
  /** Tope de posiciones simultáneas; reparte el capital. */
  maxPosiciones: number
  /**
   * Si está activo, los niveles de salida de `exit-levels.ts` se vigilan a
   * diario. Desactivarlo mide qué aportan esos niveles, que es una de las
   * preguntas abiertas del proyecto: hoy `stop_loss` se guarda y nadie lo lee.
   */
  usarNivelesDeSalida: boolean
  /**
   * Garantía de una posición corta, como fracción del nocional.
   *
   * Por defecto la del bróker (20 %). La réplica de `^PUT` pasa 1.0 porque el
   * índice está **totalmente colateralizado**: reserva el nocional entero. Con
   * el 20 % la réplica estaría apalancada cinco veces y no seguiría al índice
   * ni con el `k` correcto, por bien calibrado que estuviera.
   */
  margenShortPut?: number
}

export function simularOpciones(o: OpcionesMotor): ResultadoOpciones {
  const abiertas: PosicionAbierta[] = []
  const operaciones: OperacionOpciones[] = []
  const curva: ResultadoOpciones['curva'] = []
  const retornos: ResultadoOpciones['retornos'] = []
  const posicionesPorFecha: ResultadoOpciones['posicionesPorFecha'] = []

  let caja = o.capital
  // La garantía de una posición corta se **reserva**, no se gasta: el bróker la
  // bloquea pero sigue siendo del titular. Restarla de la caja haría que abrir
  // un put vendido pareciera una pérdida instantánea. Se lleva aparte y solo
  // sirve para limitar cuánto se puede abrir.
  let reservado = 0
  const rebalanceo = new Set(o.fechasRebalanceo)
  let valorAnterior = o.capital
  let sinPosiciones = 0
  let fechaDeRuina: string | null = null

  /** Valor de mercado de lo abierto: positivo si se compró, negativo si se vendió. */
  const valorDeMercado = (fecha: string): number => {
    let total = 0
    for (const p of abiertas) {
      const estado = o.estadoEn(p.ticker, fecha)
      const prima = estado ? repreciar(p, fecha, estado) : null
      // Sin cotización se mantiene la última prima conocida: inventar un cero
      // cerraría la posición gratis y regalaría el resultado.
      const valor = (prima ?? p.primaEntrada) * CONTRACT_MULTIPLIER * p.contratos
      total += p.lado === 'long' ? valor : -valor
    }
    return total
  }

  const cerrar = (
    p: PosicionAbierta,
    fecha: string,
    primaSalida: number,
    motivo: OperacionOpciones['motivoSalida'],
  ) => {
    const nominal = primaSalida * CONTRACT_MULTIPLIER * p.contratos
    const comision = COMISION_POR_CONTRATO * p.contratos

    // Quien compró vende y cobra; quien vendió recompra y paga. La garantía
    // solo se libera de la reserva: nunca salió de la caja.
    reservado -= p.garantia
    caja += p.lado === 'long' ? nominal - comision : -nominal - comision

    const entradaNominal = p.primaEntrada * CONTRACT_MULTIPLIER * p.contratos
    const resultado = p.lado === 'long'
      ? nominal - entradaNominal - comision * 2
      : entradaNominal - nominal - comision * 2

    operaciones.push({
      ticker: p.ticker, lado: p.lado, tipo: p.tipo,
      strike: p.contrato.strike, vencimiento: p.contrato.vencimiento,
      fechaEntrada: p.fechaEntrada, fechaSalida: fecha,
      primaEntrada: p.primaEntrada, primaSalida, contratos: p.contratos,
      resultado,
      // El denominador es lo que la posición inmovilizó de verdad: la prima
      // pagada en las largas, la garantía en las cortas. Dividir la ganancia de
      // un put vendido por su prima daría retornos de tres cifras sin sentido.
      retorno: p.garantia > 0 ? resultado / p.garantia : 0,
      motivoSalida: motivo,
      dteEntrada: p.contrato.dte,
      deltaEntrada: p.contrato.delta,
      ivEntrada: p.contrato.iv,
    })
  }

  for (const fecha of o.sesiones) {
    // Tras la ruina no se opera más: no queda con qué. Se sigue recorriendo el
    // calendario para que la curva tenga la misma longitud que las demás.
    if (fechaDeRuina) {
      if (rebalanceo.has(fecha)) {
        curva.push({ fecha, valor: 0 })
        retornos.push({ fecha, retorno: 0 })
        posicionesPorFecha.push({ fecha, n: 0 })
      }
      continue
    }

    // ── 1. Vencimientos ─────────────────────────────────────────────────────
    for (let i = abiertas.length - 1; i >= 0; i--) {
      const p = abiertas[i]
      if (diasEntre(fecha, p.contrato.vencimiento) > 0) continue

      const estado = o.estadoEn(p.ticker, fecha)
      if (!estado) continue // sin cierre del subyacente no se puede liquidar

      // Se delega en el mismo módulo que liquida en producción.
      const s = settleOption({
        position: posicionDeLiquidacion(p.lado, p.tipo),
        strike: p.contrato.strike,
        premium: p.primaEntrada,
        underlyingAtExpiry: estado.spot,
        contracts: p.contratos,
      })
      if (!s) continue
      abiertas.splice(i, 1)
      cerrar(p, fecha, s.intrinsicValue, 'vencimiento')
    }

    // ── 2. Niveles de salida ────────────────────────────────────────────────
    if (o.usarNivelesDeSalida) {
      for (let i = abiertas.length - 1; i >= 0; i--) {
        const p = abiertas[i]
        const estado = o.estadoEn(p.ticker, fecha)
        if (!estado) continue
        const prima = repreciar(p, fecha, estado)
        if (prima == null) continue

        const salida = evaluarSalida(p.lado, p.primaEntrada, prima)
        if (!salida || salida.accion === 'mantener') continue

        abiertas.splice(i, 1)
        cerrar(p, fecha, prima, salida.accion)
      }
    }

    // ── 3. Aperturas ────────────────────────────────────────────────────────
    if (rebalanceo.has(fecha)) {
      const hueco = o.maxPosiciones - abiertas.length
      if (hueco > 0) {
        const ordenes = o.generarOrdenes(fecha).slice(0, hueco)
        // Se dimensiona sobre el **patrimonio de hoy**, no sobre el capital
        // inicial. Usar el inicial hace que una cartera que ha perdido siga
        // abriendo como si no hubiera perdido: la caja se va a negativo, el
        // patrimonio cruza el cero y el CAGR sale NaN. Una cartera que solo
        // compra opciones no puede perder más del 100 %, y esta regla es lo que
        // lo garantiza.
        const patrimonio = caja + valorDeMercado(fecha)
        const disponible = Math.max(0, Math.min(patrimonio, o.capital) - reservado)
        const porPosicion = disponible / Math.max(1, hueco)

        for (const orden of ordenes) {
          const c = orden.contrato
          const primaEntrada = orden.lado === 'long' ? c.compra : c.venta

          // Cuánto compromete un contrato: la prima si se compra, la garantía
          // exigida por el bróker si se vende. Dimensionar las cortas por la
          // prima cobrada haría parecer a Theta infinitamente escalable.
          //
          // La comisión de ida y vuelta entra en el coste unitario. Sin ella, un
          // agente que gasta todo el capital en prima acaba con la caja en
          // negativo desde el primer día y la cartera se declara arruinada en
          // cuanto la prima decae, que es un artefacto y no un resultado.
          const comisionUnitaria = COMISION_POR_CONTRATO * 2
          const porContrato = comisionUnitaria + (orden.lado === 'long'
            ? primaEntrada * CONTRACT_MULTIPLIER
            : c.strike * CONTRACT_MULTIPLIER * (o.margenShortPut ?? MARGEN_SHORT_PUT))

          if (!(porContrato > 0)) continue
          const contratos = Math.floor(porPosicion / porContrato)
          if (contratos < 1) continue

          // La garantía es lo que queda bloqueado, sin la comisión: esa se paga
          // y desaparece, no se recupera al cerrar.
          const garantia = (porContrato - comisionUnitaria) * contratos
          const comision = COMISION_POR_CONTRATO * contratos
          const nominal = primaEntrada * CONTRACT_MULTIPLIER * contratos

          // Movimientos de caja reales: la prima se paga o se cobra. La
          // garantía solo se anota como reservada.
          caja += orden.lado === 'long' ? -nominal - comision : nominal - comision
          reservado += garantia

          abiertas.push({
            ...orden, fechaEntrada: fecha, primaEntrada, contratos, garantia,
          })
        }
      }
    }

    // ── 4. Valoración ───────────────────────────────────────────────────────
    // La ruina se comprueba **a diario**, no solo en los rebalanceos: si el
    // patrimonio se agota un martes, esperar al tercer viernes para darse cuenta
    // dejaría que la cartera siguiera operando con dinero que ya no tiene.
    const patrimonioHoy = caja + valorDeMercado(fecha)
    if (patrimonioHoy <= 0) {
      fechaDeRuina = fecha
      abiertas.length = 0
      if (rebalanceo.has(fecha)) {
        curva.push({ fecha, valor: 0 })
        retornos.push({ fecha, retorno: -1 })
        posicionesPorFecha.push({ fecha, n: 0 })
      }
      continue
    }

    if (rebalanceo.has(fecha)) {
      const valor = patrimonioHoy
      curva.push({ fecha, valor })
      retornos.push({
        fecha,
        retorno: valorAnterior > 0 ? valor / valorAnterior - 1 : 0,
      })
      posicionesPorFecha.push({ fecha, n: abiertas.length })
      if (!abiertas.length) sinPosiciones++
      valorAnterior = valor
    }
  }

  return {
    curva,
    operaciones,
    // El primer retorno es siempre 0 —no hay periodo anterior— y contarlo
    // diluiría todas las medias.
    retornos: retornos.slice(1),
    posicionesPorFecha,
    fechasSinPosiciones: sinPosiciones,
    fechaDeRuina,
  }
}

/** Reexportado para que el orquestador construya contratos sin importar `cadena`. */
export { construirContrato }
