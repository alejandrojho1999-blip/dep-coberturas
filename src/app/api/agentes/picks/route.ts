import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * Las recomendaciones de los agentes son una cartera única: la del
 * administrador. Cualquier usuario autenticado la lee; solo él la escribe.
 *
 * Las guardas de escritura de aquí son la primera puerta, no la única: la que
 * de verdad protege la tabla es la política RLS de la migración 018, porque un
 * cliente puede hablar con Supabase sin pasar por esta API.
 */

const SOLO_ADMIN = { error: 'Solo el administrador puede modificar las recomendaciones' }

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  // Sin filtro por usuario a propósito: la política de lectura ya limita las
  // filas visibles a las del administrador, y filtrar aquí por `user.id`
  // devolvería una cartera vacía a todos los demás.
  const base = supabase
    .from('agent_recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data, error } = await (category ? base.eq('category', category) : base)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return Response.json(SOLO_ADMIN, { status: 403 })

  const body = await request.json() as Record<string, unknown>
  const { ticker, category } = body as { ticker?: string; category?: string }

  // Dedup: skip if an active (non-sold) recommendation already exists for this ticker
  if (ticker && category) {
    const { data: existing } = await supabase
      .from('agent_recommendations')
      .select('id')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .eq('category', category)
      .neq('estado', 'Vender')
      .limit(1)
      .single()
    if (existing) return Response.json({ skipped: true, id: existing.id }, { status: 200 })
  }

  const { error, data } = await supabase
    .from('agent_recommendations')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

const EDITABLE = ['estado', 'precio_venta', 'precio_entrada', 'precio_objetivo', 'stop_loss', 'cantidad_acciones', 'resumen', 'rentabilidad', 'ai_report', 'closed_at']

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return Response.json(SOLO_ADMIN, { status: 403 })

  const body = await request.json() as Record<string, unknown>
  const { id, ...rest } = body
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const safe = Object.fromEntries(Object.entries(rest).filter(([k]) => EDITABLE.includes(k)))
  const { error } = await supabase
    .from('agent_recommendations')
    .update(safe)
    .eq('id', id as string)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) return Response.json(SOLO_ADMIN, { status: 403 })

  const { id } = await request.json() as { id: string }
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase
    .from('agent_recommendations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
