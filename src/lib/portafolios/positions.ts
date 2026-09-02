import type { AgentRec } from '@/lib/agentes/types'
import { estaAbierta, nombreAgente } from '@/lib/agentes/types'
import { hasFabricatedEntryPrice } from '@/lib/agentes/legacy-entry-price'
import { contractKey } from '@/lib/options/occ-symbol'
import { optionOutcome, optionRefFromRec, sideForCategory } from '@/lib/options/mark'
import { CONTRACT_MULTIPLIER, positionFromReport } from '@/lib/options/settlement'
import { CONTRATOS_POR_SENAL, OPTION_CATEGORIES, STOCK_CATEGORIES, TICKET_ACCIONES } from './config'
import { isoDay, resolveClosedDate } from './closed-date'
import type { ClosesByTicker, OptionPosition, StockPosition } from './types'

/**
 * Traducción de recomendaciones a posiciones de cartera.
 *
 * El portafolio no está guardado en ninguna parte: se deriva aplicando las
 * reglas de sizing de `config.ts` a las filas de `agent_recommendations`. Que
 * sea derivado es lo que hace que una posición vendida por el agente
 * desaparezca sola de los gráficos en el siguiente refresco.
 */

export interface BuildResult<T> {
  positions: T[]
  /** Recomendaciones descartadas y el motivo, para poder explicarlo en la UI. */
  excluidas: Array<{ ticker: string; motivo: string }>
}

/**
 * Construye las posiciones del portafolio de acciones.
 *
 * Se invierte un ticket fijo por recomendación, así que la cantidad de acciones
 * es fraccional: es una cartera modelo, no una orden que haya que ejecutar en
 * lotes enteros.
 */
export function buildStockPositions(
  recs: AgentRec[],
  livePrices: Record<string, number>,
  closes: ClosesByTicker = {}
): BuildResult<StockPosition> {
  const positions: StockPosition[] = []
  const excluidas: BuildResult<StockPosition>['excluidas'] = []

  for (const rec of recs) {
    if (!STOCK_CATEGORIES.includes(rec.category)) continue

    const entrada = rec.precio_entrada
    if (entrada == null || entrada <= 0) {
      excluidas.push({ ticker: rec.ticker, motivo: 'sin precio de entrada' })
      continue
    }
    // Estas filas guardan un precio de entrada que nunca cotizó: incluirlas
    // inventaría rendimiento en el track record.
    if (hasFabricatedEntryPrice(rec)) {
      excluidas.push({ ticker: rec.ticker, motivo: 'precio de entrada no fiable' })
      continue
    }

    const abierta = estaAbierta(rec)
    const cantidad = TICKET_ACCIONES / entrada
    const cierre = resolveClosedDate(rec, closes[rec.ticker])
    const precioActual = livePrices[rec.ticker] ?? null
    const referencia = abierta ? precioActual : (rec.precio_venta ?? null)
    const valorActual = referencia != null ? cantidad * referencia : null
    const pnl = valorActual != null ? valorActual - TICKET_ACCIONES : null

    positions.push({
      id: rec.id,
      ticker: rec.ticker,
      empresa: rec.empresa,
      agente: nombreAgente(rec.category),
      category: rec.category,
      fechaEntrada: isoDay(rec.created_at),
      fechaCierre: cierre.date,
      fechaCierreEstimada: cierre.estimada,
      abierta,
      capitalComprometido: TICKET_ACCIONES,
      precioEntrada: entrada,
      cantidad,
      precioSalida: rec.precio_venta,
      precioActual,
      valorActual,
      pnl,
      pnlPct: pnl != null ? (pnl / TICKET_ACCIONES) * 100 : null,
    })
  }

  return { positions, excluidas }
}

/**
 * Capital que un contrato inmoviliza en el portafolio.
 *
 * Un largo solo arriesga la prima que pagó. Un corto no inmoviliza la prima
 * —la cobra— sino el colateral que respalda la obligación: el efectivo del
 * strike en un put asegurado, y el valor de las acciones en una call cubierta.
 * Usar la prima como peso pintaría a Theta como una posición diminuta cuando
 * es la que más capital retiene.
 */
export function capitalComprometidoOpcion(
  posicion: string,
  strike: number,
  prima: number,
  subyacenteEntrada: number | null,
  contratos: number
): { capital: number; detalle: string } {
  const lote = CONTRACT_MULTIPLIER * contratos
  if (posicion === 'SHORT_PUT') {
    return {
      capital: strike * lote,
      detalle: `Put asegurado con efectivo: $${strike.toFixed(2)} × ${lote} = $${(strike * lote).toFixed(2)} de colateral`,
    }
  }
  if (posicion === 'COVERED_CALL') {
    const base = subyacenteEntrada ?? strike
    return {
      capital: base * lote,
      detalle: `Call cubierta: $${base.toFixed(2)} × ${lote} = $${(base * lote).toFixed(2)} en acciones`,
    }
  }
  return {
    capital: prima * lote,
    detalle: `Prima pagada: $${prima.toFixed(2)} × ${lote} = $${(prima * lote).toFixed(2)}`,
  }
}

/**
 * Construye las posiciones del portafolio de opciones.
 *
 * `primas` viene indexado por `contractKey`, igual que lo devuelve
 * `/api/informes/option-prices`.
 *
 * `categorias` acota qué agentes entran. Las compras de Gamma y las ventas de
 * Theta son carteras distintas —una arriesga la prima, la otra inmoviliza el
 * colateral— y cada una se construye por separado para que sus exclusiones y
 * su capital comprometido no se mezclen. Por defecto entran las dos.
 */
export function buildOptionPositions(
  recs: AgentRec[],
  primas: Record<string, number>,
  categorias: readonly string[] = OPTION_CATEGORIES
): BuildResult<OptionPosition> {
  const positions: OptionPosition[] = []
  const excluidas: BuildResult<OptionPosition>['excluidas'] = []

  for (const rec of recs) {
    if (!categorias.includes(rec.category)) continue

    const ref = optionRefFromRec(rec)
    if (!ref) {
      excluidas.push({ ticker: rec.ticker, motivo: 'contrato sin strike o vencimiento' })
      continue
    }
    const posicion = positionFromReport(rec.ai_report ?? {})
    if (!posicion) {
      excluidas.push({ ticker: rec.ticker, motivo: 'tipo de contrato no reconocido' })
      continue
    }
    const primaEntrada = rec.precio_entrada
    if (primaEntrada == null || primaEntrada <= 0) {
      excluidas.push({ ticker: rec.ticker, motivo: 'sin prima de entrada' })
      continue
    }

    const abierta = estaAbierta(rec)
    const side = sideForCategory(rec.category)
    const outcome = optionOutcome(rec, primas[contractKey(ref)], side)
    // `underlying` es el precio de la acción al abrir la posición. Se valida el
    // tipo en vez de castearlo: las filas antiguas de Gamma guardaban aquí el
    // ticker, y un string colándose como número convertiría el colateral de una
    // call cubierta en `NaN` sin que nada avisara.
    const underlyingCrudo = (rec.ai_report ?? {}).underlying
    const subyacente = typeof underlyingCrudo === 'number' && underlyingCrudo > 0
      ? underlyingCrudo
      : null
    const { capital, detalle } = capitalComprometidoOpcion(
      posicion, ref.strike, primaEntrada, subyacente, CONTRATOS_POR_SENAL
    )
    const cierre = resolveClosedDate(rec)
    const pnl = outcome ? outcome.usd * CONTRATOS_POR_SENAL : null

    positions.push({
      id: rec.id,
      ticker: rec.ticker,
      agente: nombreAgente(rec.category),
      category: rec.category,
      fechaEntrada: isoDay(rec.created_at),
      fechaCierre: cierre.date,
      fechaCierreEstimada: cierre.estimada,
      abierta,
      capitalComprometido: capital,
      posicion,
      strike: ref.strike,
      expiration: ref.expiration,
      primaEntrada,
      primaActual: outcome?.valorActual ?? null,
      contratos: CONTRATOS_POR_SENAL,
      esCorta: side === 'short',
      detalleCapital: detalle,
      valorActual: outcome ? capital + outcome.usd * CONTRATOS_POR_SENAL : null,
      pnl,
      pnlPct: pnl != null && capital > 0 ? (pnl / capital) * 100 : null,
    })
  }

  return { positions, excluidas }
}
