import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PortafoliosClient from './_components/PortafoliosClient'
import { backtestCartera } from '@/lib/estrategias/datos'

export default async function PortafoliosPage() {
  // Defensa en profundidad: el proxy ya protege la ruta, pero la página no
  // debe quedar accesible si algún día se retoca esa lista.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // El backtest de las seis estrategias es estático: se lee en el servidor y
  // viaja como prop. Pedirlo por fetch no funcionaría, porque
  // public/estrategias/ cae dentro del guard de rutas protegidas del proxy.
  const cartera = await backtestCartera()

  return <PortafoliosClient cartera={cartera} />
}
