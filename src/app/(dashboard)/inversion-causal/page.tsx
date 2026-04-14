import { createClient } from '@/lib/supabase/server'
import InversionCausalShell from './_components/InversionCausalShell'
import type { CausalConfig } from '@/lib/causal/types'

interface CausalAsset {
  id: string
  ticker: string
  config: CausalConfig
  last_run_at: string | null
  last_score: number | null
  last_signal: string | null
}

export default async function InversionCausalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let assets: CausalAsset[] = []

  if (user) {
    const { data } = await supabase
      .from('causal_assets')
      .select('id, ticker, config, last_run_at, last_score, last_signal')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    assets = (data as CausalAsset[]) ?? []
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Inversión Causal</h1>
        <p className="text-[#64748b] text-sm mt-1">
          Framework López de Prado &amp; Zoonekynd (2025)
        </p>
      </div>

      <InversionCausalShell initialAssets={assets} userId={user?.id} />
    </div>
  )
}
