import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase con la clave de servicio.
 *
 * ⚠️ Esta clave SE SALTA LAS POLÍTICAS RLS por completo: puede leer y escribir
 * cualquier fila de cualquier usuario. Solo existe para las tareas programadas,
 * que no tienen sesión de nadie a la que asociarse.
 *
 * Reglas al usarlo:
 *
 * - Nunca se importa desde código de cliente. No lleva el prefijo
 *   `NEXT_PUBLIC_`, así que el bundler no la expone al navegador; mantenerlo
 *   así es lo único que impide que acabe en el JS que descarga el visitante.
 * - Toda consulta filtra por `user_id` **explícitamente**. Sin RLS detrás, el
 *   filtro del código es la única frontera entre las cuentas.
 * - Si la variable falta, esto lanza. Un cron que no puede autenticarse debe
 *   fallar, nunca continuar con menos permisos de los que cree tener.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurada')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada')

  return createSupabaseClient(url, serviceKey, {
    auth: {
      // Un proceso automático no tiene sesión que persistir ni que refrescar.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
