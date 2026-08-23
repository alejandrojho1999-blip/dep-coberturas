import type { SupabaseClient } from '@supabase/supabase-js'
import { quoteContracts } from './quote-contracts'
import { sideForCategory } from './mark'
import {
  contractsToQuote,
  planExitReview,
  describeClosure,
  describeHeld,
  type ReviewablePick,
} from './exit-review-core'

/**
 * Ejecución de la revisión de niveles contra la base de datos.
 *
 * Lo comparten el endpoint que usa la sesión del usuario y el que dispara el
 * cron: cambia quién es el cliente de Supabase y de dónde sale el `user_id`,
 * pero el camino que siguen los datos tiene que ser el mismo, o acabarían
 * divergiendo en silencio.
 */

export const OPTION_CATEGORIES = ['OPTIONS_GAMMA', 'OPTIONS_THETA'] as const
export type OptionCategory = typeof OPTION_CATEGORIES[number]

export function isOptionCategory(value: unknown): value is OptionCategory {
  return typeof value === 'string' && (OPTION_CATEGORIES as readonly string[]).includes(value)
}

export interface ExitReviewResult {
  category: OptionCategory
  revisadas: number
  cerradas: number
  porObjetivo: number
  porStop: number
  sinCotizar: number
  /** Cierres que la base de datos rechazó. */
  fallidos: number
  log: string[]
}

/**
 * Revisa las posiciones vivas de una categoría y cierra las que hayan tocado
 * un nivel.
 *
 * El `userId` se pasa siempre de forma explícita y se usa en todas las
 * consultas. Con el cliente de servicio no hay RLS que respalde el filtro, así
 * que este parámetro es la frontera entre cuentas.
 */
export async function runExitReview(
  supabase: SupabaseClient,
  userId: string,
  category: OptionCategory
): Promise<ExitReviewResult> {
  const side = sideForCategory(category)
  const vacio: ExitReviewResult = {
    category, revisadas: 0, cerradas: 0, porObjetivo: 0, porStop: 0,
    sinCotizar: 0, fallidos: 0, log: [],
  }

  const { data, error } = await supabase
    .from('agent_recommendations')
    .select('id, ticker, precio_entrada, ai_report')
    .eq('user_id', userId)
    .eq('category', category)
    .neq('estado', 'Vender')
    .limit(200)

  if (error) throw new Error(error.message)

  const picks = (data ?? []) as ReviewablePick[]
  if (!picks.length) {
    return { ...vacio, log: [`✓ ${category}: sin posiciones activas`] }
  }

  const contracts = contractsToQuote(picks)
  const prices = contracts.length ? await quoteContracts(contracts) : {}
  const { closures, held } = planExitReview(picks, side, prices)

  const entradaPorId = new Map(picks.map(p => [p.id, p.precio_entrada]))
  const log: string[] = []
  let porObjetivo = 0
  let porStop = 0
  let fallidos = 0

  for (const closure of closures) {
    const { error: patchError } = await supabase
      .from('agent_recommendations')
      .update(closure.patch)
      .eq('id', closure.id)
      .eq('user_id', userId)

    if (patchError) {
      fallidos++
      log.push(`⚠ ${closure.ticker}: el cierre no se guardó — ${patchError.message}`)
      continue
    }
    log.push(describeClosure(closure, entradaPorId.get(closure.id) ?? 0))
    if (closure.motivo === 'objetivo') porObjetivo++
    else porStop++
  }

  for (const h of held) log.push(describeHeld(h))

  return {
    category,
    revisadas: closures.length + held.filter(h => h.razon === 'entre-niveles').length,
    cerradas: porObjetivo + porStop,
    porObjetivo,
    porStop,
    sinCotizar: held.filter(h => h.razon === 'sin-cotizacion').length,
    fallidos,
    log,
  }
}
