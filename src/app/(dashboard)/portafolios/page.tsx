import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortfolioView from './_components/PortfolioView'

export default async function PortafoliosPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: assets, error } = await supabase
    .from('causal_assets')
    .select('id, ticker, config, last_run_at, last_score, last_signal')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Portafolios Híbridos</h1>
        <p className="text-red-400 text-sm">Error al cargar activos: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Portafolios Híbridos</h1>
        <p className="text-[#64748b] text-sm mt-1">
          Asignación óptima basada en señales causales
        </p>
      </div>
      <PortfolioView assets={assets ?? []} />
    </div>
  )
}
