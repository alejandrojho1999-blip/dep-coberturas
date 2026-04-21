'use client'

import { useState } from 'react'

interface CausalAsset {
  id: string
  ticker: string
  last_score: number | null
  last_signal: string | null
}

interface Props {
  assets: CausalAsset[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewAsset: () => void
  onDelete: (id: string) => void
}

function signalColor(signal: string | null): string {
  if (signal === 'AUMENTAR') return 'text-[#00ff88]'
  if (signal === 'REDUCIR') return 'text-red-400'
  return 'text-blue-400'
}

export default function AssetSelector({ assets, activeId, onSelect, onNewAsset, onDelete }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmAsset = assets.find((a) => a.id === confirmId)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {assets.map((asset) => (
          <div key={asset.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelect(asset.id)}
              className={`flex items-center gap-2 px-4 py-2 pr-8 rounded-xl border text-sm font-medium transition-colors ${
                activeId === asset.id
                  ? 'border-[#00ff88] bg-[#00ff88]/10 text-[#e2e8f0]'
                  : 'border-[#1e1e2e] bg-[#12121a] text-[#64748b] hover:border-[#3b82f6] hover:text-[#e2e8f0] cursor-pointer'
              }`}
            >
              <span>{asset.ticker}</span>
              {asset.last_signal != null && asset.last_score != null && (
                <span className={`text-xs ${signalColor(asset.last_signal)}`}>
                  {asset.last_score.toFixed(0)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmId(asset.id) }}
              title={`Eliminar ${asset.ticker}`}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[#64748b] hover:text-red-400 text-xs leading-none"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onNewAsset}
          className="px-4 py-2 rounded-xl border border-dashed border-[#1e1e2e] text-[#64748b] text-sm font-medium hover:border-[#3b82f6] hover:text-[#3b82f6] cursor-pointer transition-colors"
        >
          + Nuevo activo
        </button>
      </div>

      {/* Delete confirmation modal */}
      {confirmId && confirmAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-[#e2e8f0] font-semibold">Eliminar {confirmAsset.ticker}</h3>
            <p className="text-sm text-[#64748b]">
              ¿Eliminar <span className="text-[#e2e8f0] font-mono">{confirmAsset.ticker}</span> del
              portafolio causal? Esta acción también eliminará el historial de análisis.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-[#1e1e2e] text-[#64748b] text-sm hover:text-[#e2e8f0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { onDelete(confirmId); setConfirmId(null) }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
