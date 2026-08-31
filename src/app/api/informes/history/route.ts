import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAILS = new Set(['lriofrio915@gmail.com', 'walletserick123@gmail.com'])

const APROBACION_VALUES = new Set(['Revision', 'Aprobada', 'Rechazada', 'Observacion'])

const HISTORY_FIELDS = 'id, user_id, user_email, ticker, empresa, bolsa, solicitante, filename, informe_numero, fecha_generacion, content_json, custom_docx_path, precio_compra, cantidad_acciones, precio_objetivo_personal, estado, precio_venta, aprobacion, aprobacion_at, comision_cobrada, comision_cobrada_at, comision_cobrada_monto'

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = ADMIN_EMAILS.has(user.email ?? '')

  let query = supabase
    .from('informes_history')
    .select(HISTORY_FIELDS)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!isAdmin) query = query.eq('user_id', user.id)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { id?: string } & Record<string, unknown>
  const { id, ...updates } = body
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const ALLOWED_FIELDS = new Set([
    'precio_compra', 'cantidad_acciones', 'precio_objetivo_personal', 'estado', 'precio_venta',
    'aprobacion', 'aprobacion_at', 'comision_cobrada', 'comision_cobrada_at', 'comision_cobrada_monto',
  ])
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED_FIELDS.has(k))
  )
  if (Object.keys(safeUpdates).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // El CHECK de la base de datos también lo rechazaría, pero con un error de
  // Postgres que no dice nada útil a quien llama a la API.
  if ('aprobacion' in safeUpdates && !APROBACION_VALUES.has(safeUpdates.aprobacion as string)) {
    return Response.json({ error: 'Invalid aprobacion' }, { status: 400 })
  }

  const isAdmin = ADMIN_EMAILS.has(user.email ?? '')

  let query = supabase.from('informes_history').update(safeUpdates).eq('id', id)
  if (!isAdmin) query = query.eq('user_id', user.id)
  const { error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json() as { id?: string }
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const isAdmin = ADMIN_EMAILS.has(user.email ?? '')

  let deleteQuery = supabase.from('informes_history').delete().eq('id', id)
  if (!isAdmin) deleteQuery = deleteQuery.eq('user_id', user.id)
  const { error } = await deleteQuery

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
