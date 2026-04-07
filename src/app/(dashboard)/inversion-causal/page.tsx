import { createClient } from '@/lib/supabase/server'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
import CausalAnalysisClient from './_components/CausalAnalysisClient'
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

  const defaultAsset = assets[0] ?? null
  const defaultConfig: CausalConfig = defaultAsset?.config ?? AAPL_DEFAULT_CONFIG

  function signalBadgeClass(signal: string | null) {
    if (signal === 'AUMENTAR') return 'bg-[#00ff88]/10 text-[#00ff88]'
    if (signal === 'REDUCIR') return 'bg-red-500/10 text-red-400'
    return 'bg-blue-500/10 text-blue-400'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Inversión Causal</h1>
        <p className="text-[#64748b] text-sm mt-1">
          Framework López de Prado &amp; Zoonekynd (2025)
        </p>
      </div>

      {/* Asset section */}
      {assets.length === 0 ? (
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-6 max-w-sm">
          <p className="text-[#64748b] text-sm mb-4">
            No tienes activos configurados. Comienza con AAPL.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[#e2e8f0] font-semibold">AAPL</span>
            <span className="text-xs text-[#64748b]">Apple Inc. — config predeterminada</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 min-w-[200px]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#e2e8f0] font-bold text-lg">{asset.ticker}</span>
                {asset.last_signal && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${signalBadgeClass(asset.last_signal)}`}
                  >
                    {asset.last_signal}
                  </span>
                )}
              </div>
              {asset.last_score != null && (
                <p className="text-[#64748b] text-sm">
                  Score: <span className="text-[#e2e8f0]">{asset.last_score.toFixed(1)}</span>
                </p>
              )}
              {asset.last_run_at && (
                <p className="text-[#64748b] text-xs mt-1">
                  Último análisis:{' '}
                  {new Date(asset.last_run_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main interactive client */}
      <CausalAnalysisClient
        config={defaultConfig}
        assetId={defaultAsset?.id}
        userId={user?.id}
      />
    </div>
  )
}
