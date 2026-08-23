import { createClient } from '@/lib/supabase/server'
import { quoteContracts } from '@/lib/options/quote-contracts'
import { sideForCategory } from '@/lib/options/mark'
import {
  contractsToQuote,
  planExitReview,
  describeClosure,
  describeHeld,
  type ReviewablePick,
} from '@/lib/options/exit-review-core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Revisión de los niveles de salida de las posiciones vivas de un agente de
 * opciones.
 *
 * Antes esto era un bucle en el navegador que encadenaba una petición por paso.
 * Aquí ocurre entero en el servidor: se leen las posiciones, se cotizan los
 * contratos y se escriben los cierres en una sola llamada. Es también la pieza
 * que un cron podrá invocar cuando exista, sin depender de que nadie tenga la
 * pantalla abierta.
 *
 * Lo que NO es: vigilancia continua. Cierra lo que ya tocó un nivel, asumiendo
 * que la orden OCO del bróker saltó sola. La protección real vive en el bróker.
 */

const CATEGORIES = ['OPTIONS_GAMMA', 'OPTIONS_THETA'] as const
type Category = typeof CATEGORIES[number]

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { category?: unknown }
  try {
    body = await request.json() as { category?: unknown }
  } catch {
    return Response.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  if (!isCategory(body.category)) {
    return Response.json(
      { error: `category debe ser una de: ${CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }
  const category = body.category
  const side = sideForCategory(category)

  const { data, error } = await supabase
    .from('agent_recommendations')
    .select('id, ticker, precio_entrada, ai_report')
    .eq('user_id', user.id)
    .eq('category', category)
    .neq('estado', 'Vender')
    .limit(200)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const picks = (data ?? []) as ReviewablePick[]
  if (!picks.length) {
    return Response.json({ revisadas: 0, cerradas: 0, porObjetivo: 0, porStop: 0, sinCotizar: 0, log: [] })
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
      .eq('user_id', user.id)

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

  return Response.json({
    revisadas: closures.length + held.filter(h => h.razon === 'entre-niveles').length,
    cerradas: porObjetivo + porStop,
    porObjetivo,
    porStop,
    sinCotizar: held.filter(h => h.razon === 'sin-cotizacion').length,
    fallidos,
    log,
  })
}
