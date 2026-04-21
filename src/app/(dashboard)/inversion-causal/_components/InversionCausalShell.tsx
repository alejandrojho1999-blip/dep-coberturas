'use client'

import { useState } from 'react'
import type { CausalConfig } from '@/lib/causal/types'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
import AssetSelector from './AssetSelector'
import NewAssetForm from './NewAssetForm'
import CausalAnalysisClient from './CausalAnalysisClient'
import IRChatPanel from './IRChatPanel'

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
  const [chatOpen, setChatOpen] = useState(false)

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

  async function handleDelete(id: string) {
    try {
      await fetch('/api/causal/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      // best-effort
    }
    setAssets((prev) => prev.filter((a) => a.id !== id))
    if (activeId === id) {
      const remaining = assets.filter((a) => a.id !== id)
      setActiveId(remaining[0]?.id ?? null)
    }
  }

  return (
    <div className="space-y-6">
      <AssetSelector
        assets={assets}
        activeId={activeId}
        onSelect={handleSelect}
        onNewAsset={() => setShowNewForm(true)}
        onDelete={handleDelete}
      />

      {showNewForm ? (
        <NewAssetForm
          onCreated={handleAssetCreated}
          onCancel={() => setShowNewForm(false)}
        />
      ) : (
        <div className="relative">
          <CausalAnalysisClient
            config={activeConfig}
            assetId={activeAsset?.id}
            userId={userId}
          />

          {/* Chat button — shown when there's a real asset selected */}
          {activeAsset && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-[#3b82f6] text-white text-sm font-semibold shadow-lg hover:bg-[#2563eb] transition-colors"
            >
              <span>💬</span>
              <span>Analista IA — {activeAsset.ticker}</span>
            </button>
          )}
        </div>
      )}

      {activeAsset && (
        <IRChatPanel
          assetId={activeAsset.id}
          ticker={activeAsset.ticker}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  )
}
