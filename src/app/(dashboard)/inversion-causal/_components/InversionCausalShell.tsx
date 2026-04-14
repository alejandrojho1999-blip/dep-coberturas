'use client'

import { useState } from 'react'
import type { CausalConfig } from '@/lib/causal/types'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
import AssetSelector from './AssetSelector'
import NewAssetForm from './NewAssetForm'
import CausalAnalysisClient from './CausalAnalysisClient'

interface CausalAsset {
  id: string
  ticker: string
  config: CausalConfig
  last_run_at: string | null
  last_score: number | null
  last_signal: string | null
}

interface Props {
  initialAssets: CausalAsset[]
  userId?: string
}

export default function InversionCausalShell({ initialAssets, userId }: Props) {
  const [assets, setAssets] = useState<CausalAsset[]>(initialAssets)
  const [activeId, setActiveId] = useState<string | null>(initialAssets[0]?.id ?? null)
  const [showNewForm, setShowNewForm] = useState(false)

  const activeAsset = assets.find((a) => a.id === activeId) ?? null
  const activeConfig: CausalConfig = activeAsset?.config ?? AAPL_DEFAULT_CONFIG

  function handleAssetCreated(asset: CausalAsset) {
    setAssets((prev) => [asset, ...prev])
    setActiveId(asset.id)
    setShowNewForm(false)
  }

  function handleSelect(id: string) {
    setActiveId(id)
    setShowNewForm(false)
  }

  return (
    <div className="space-y-6">
      <AssetSelector
        assets={assets}
        activeId={activeId}
        onSelect={handleSelect}
        onNewAsset={() => setShowNewForm(true)}
      />

      {showNewForm ? (
        <NewAssetForm
          onCreated={handleAssetCreated}
          onCancel={() => setShowNewForm(false)}
        />
      ) : (
        <CausalAnalysisClient
          config={activeConfig}
          assetId={activeAsset?.id}
          userId={userId}
        />
      )}
    </div>
  )
}
