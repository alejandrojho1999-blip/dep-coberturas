import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AgentesClient from './AgentesClient'

export default async function AgentesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AgentesClient />
}
