import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PortafoliosClient from './_components/PortafoliosClient'

export default async function PortafoliosPage() {
  // Defensa en profundidad: el proxy ya protege la ruta, pero la página no
  // debe quedar accesible si algún día se retoca esa lista.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <PortafoliosClient />
}
