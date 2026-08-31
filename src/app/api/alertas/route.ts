import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * Lectura del registro de alertas tempranas.
 *
 * Solo lectura, y solo para el administrador: quien escribe estas tablas es el
 * motor que corre como tarea del servidor con la clave de servicio, no la
 * aplicación. La guarda de aquí es la primera puerta; la que de verdad protege
 * las filas es la política RLS de la migración 022, porque un cliente puede
 * hablar con Supabase sin pasar por esta API.
 */
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminEmail(user.email)) {
    return Response.json({ error: 'Solo el administrador ve las alertas' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')
  const limite = Math.min(200, Math.max(1, Number(searchParams.get('limite')) || 60))

  const consulta = supabase
    .from('alert_signals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)

  const [senales, macro] = await Promise.all([
    tipo ? consulta.eq('tipo', tipo) : consulta,
    supabase
      .from('macro_snapshots')
      .select('*')
      .order('tomado_at', { ascending: false })
      .limit(48),
  ])

  if (senales.error) return Response.json({ error: senales.error.message }, { status: 500 })
  if (macro.error) return Response.json({ error: macro.error.message }, { status: 500 })

  return Response.json({
    senales: senales.data ?? [],
    macro: macro.data ?? [],
  })
}
