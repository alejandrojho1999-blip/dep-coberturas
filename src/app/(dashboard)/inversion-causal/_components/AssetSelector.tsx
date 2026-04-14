'use client'

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
}

function signalColor(signal: string | null): string {
  if (signal === 'AUMENTAR') return 'text-[#00ff88]'
  if (signal === 'REDUCIR') return 'text-red-400'
  return 'text-blue-400'
}

export default function AssetSelector({ assets, activeId, onSelect, onNewAsset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {assets.map((asset) => (
        <button
          type="button"
          key={asset.id}
          onClick={() => onSelect(asset.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
            activeId === asset.id
              ? 'border-[#00ff88] bg-[#00ff88]/10 text-[#e2e8f0]'
              : 'border-[#1e1e2e] bg-[#12121a] text-[#64748b] hover:border-[#3b82f6] hover:text-[#e2e8f0]'
          }`}
        >
          <span>{asset.ticker}</span>
          {asset.last_signal != null && asset.last_score != null && (
            <span className={`text-xs ${signalColor(asset.last_signal)}`}>
              {asset.last_score.toFixed(0)}
            </span>
          )}
        </button>
      ))}

      <button
        type="button"
        onClick={onNewAsset}
        className="px-4 py-2 rounded-xl border border-dashed border-[#1e1e2e] text-[#64748b] text-sm font-medium hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
      >
        + Nuevo activo
      </button>
    </div>
  )
}
