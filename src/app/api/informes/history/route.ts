import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('informes_history')
    .select('id, user_id, user_email, ticker, empresa, bolsa, solicitante, filename, informe_numero, fecha_generacion, content_json, custom_docx_path, precio_compra, cantidad_acciones, precio_objetivo_personal, estado, precio_venta')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json() as { id?: string }
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const ADMIN_EMAILS = new Set(['lriofrio915@gmail.com'])
  const isAdmin = ADMIN_EMAILS.has(user.email ?? '')

  let deleteQuery = supabase.from('informes_history').delete().eq('id', id)
  if (!isAdmin) deleteQuery = deleteQuery.eq('user_id', user.id)
  const { error } = await deleteQuery

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
