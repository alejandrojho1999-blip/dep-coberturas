import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin'
import { FichaAlertas } from './_components/FichaAlertas'

export const metadata = {
  title: 'Ficha técnica · Alerta temprana',
}

/**
 * Documentación del sistema de alerta temprana.
 *
 * Mismo guard que el registro: la ficha describe la infraestructura interna
 * —dónde corre el motor, con qué claves, por qué el puente solo escucha en
 * local— y eso no es material público.
 */
export default async function FichaAlertasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdminEmail(user.email)) redirect('/dashboard')

  return <FichaAlertas />
}
