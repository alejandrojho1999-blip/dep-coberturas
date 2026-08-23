import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admin'
import AgentesClient from './AgentesClient'

export default async function AgentesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Quién puede ejecutar se decide en el servidor, con el correo de la sesión:
  // el cliente no debe poder darse permisos cambiando un estado.
  return <AgentesClient puedeEjecutar={isAdminEmail(user.email)} />
}
