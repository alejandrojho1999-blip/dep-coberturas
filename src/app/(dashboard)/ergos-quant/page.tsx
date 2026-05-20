import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ErgoQuantClient from './ErgoQuantClient'

export default async function ErgosQuantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <ErgoQuantClient />
}
