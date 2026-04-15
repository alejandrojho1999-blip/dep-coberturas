'use client'

interface Asset {
  id: string
  ticker: string
  config: { name: string }
  last_run_at: string | null
  last_score: number | null
  last_signal: 'AUMENTAR' | 'MANTENER' | 'REDUCIR' | null
}

interface Props {
  assets: Asset[]
}

function signalStyle(signal: Asset['last_signal']): string {
  if (signal === 'REDUCIR') return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (signal === 'MANTENER') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  if (signal === 'AUMENTAR') return 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]/30'
  return 'bg-[#1e1e2e] text-[#64748b] border-[#1e1e2e]'
}

function scoreColor(score: number | null): string {
  if (score === null) return '#64748b'
  if (score < 40) return '#f87171'
  if (score < 60) return '#fbbf24'
  return '#00ff88'
}

function suggestedWeight(score: number | null): string {
  if (score === null) return '—'
  return ((score / 100) * 10).toFixed(1) + '%'
}

function totalAllocated(assets: Asset[]): number {
  return assets.reduce((sum, a) => {
    if (a.last_score === null) return sum
    return sum + (a.last_score / 100) * 10
  }, 0)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function PortfolioView({ assets }: Props) {
  const analyzed = assets.filter((a) => a.last_score !== null)
  const pending = assets.filter((a) => a.last_score === null)
  const total = totalAllocated(assets)

  const aumentar = analyzed.filter((a) => a.last_signal === 'AUMENTAR').length
  const mantener = analyzed.filter((a) => a.last_signal === 'MANTENER').length
  const reducir = analyzed.filter((a) => a.last_signal === 'REDUCIR').length

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-8 text-center">
        <p className="text-[#64748b] text-sm">
          No hay activos causales todavía.{' '}
          <a href="/inversion-causal" className="text-[#00ff88] hover:underline">
            Agrega uno en Inversión Causal
          </a>{' '}
          para comenzar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
          <p className="text-[#64748b] text-xs uppercase tracking-wide mb-1">Activos totales</p>
          <p className="text-[#e2e8f0] text-2xl font-bold font-mono">{assets.length}</p>
        </div>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
          <p className="text-[#64748b] text-xs uppercase tracking-wide mb-1">Asignación total</p>
          <p className="text-2xl font-bold font-mono" style={{ color: total > 100 ? '#f87171' : '#00ff88' }}>
            {total.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
          <p className="text-[#64748b] text-xs uppercase tracking-wide mb-1">Analizados</p>
          <p className="text-[#e2e8f0] text-2xl font-bold font-mono">{analyzed.length}</p>
        </div>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
          <p className="text-[#64748b] text-xs uppercase tracking-wide mb-1">Señales</p>
          <div className="flex gap-2 mt-1">
            <span className="text-[#00ff88] font-mono text-sm font-semibold">↑{aumentar}</span>
            <span className="text-yellow-400 font-mono text-sm font-semibold">→{mantener}</span>
            <span className="text-red-400 font-mono text-sm font-semibold">↓{reducir}</span>
          </div>
        </div>
      </div>

      {/* Asset cards */}
      {analyzed.length > 0 && (
        <div>
          <h2 className="text-[#e2e8f0] font-semibold text-sm uppercase tracking-wide mb-3">
            Activos analizados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {analyzed.map((asset) => {
              const color = scoreColor(asset.last_score)
              const pct = Math.min(100, Math.max(0, asset.last_score ?? 0))
              return (
                <div
                  key={asset.id}
                  className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 flex flex-col gap-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[#e2e8f0] font-bold text-lg font-mono">{asset.ticker}</p>
                      <p className="text-[#64748b] text-xs mt-0.5">{asset.config?.name ?? '—'}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${signalStyle(asset.last_signal)}`}
                    >
                      {asset.last_signal ?? '—'}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#64748b]">Score</span>
                      <span className="font-mono font-semibold" style={{ color }}>
                        {asset.last_score?.toFixed(1) ?? '—'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  {/* Weight + date */}
                  <div className="flex justify-between text-xs text-[#64748b]">
                    <span>
                      Peso:{' '}
                      <span className="text-[#e2e8f0] font-mono font-semibold">
                        {suggestedWeight(asset.last_score)}
                      </span>
                    </span>
                    <span>Análisis: {formatDate(asset.last_run_at)}</span>
                  </div>

                  {/* Link */}
                  <a
                    href={`/inversion-causal?asset=${asset.id}`}
                    className="text-xs text-[#00ff88]/70 hover:text-[#00ff88] transition-colors text-right"
                  >
                    Ver análisis →
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending analysis */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-[#e2e8f0] font-semibold text-sm uppercase tracking-wide mb-3">
            Sin analizar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pending.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 flex items-center justify-between opacity-60"
              >
                <div>
                  <p className="text-[#e2e8f0] font-bold font-mono">{asset.ticker}</p>
                  <p className="text-[#64748b] text-xs mt-0.5">{asset.config?.name ?? '—'}</p>
                </div>
                <a
                  href={`/inversion-causal?asset=${asset.id}`}
                  className="text-xs text-[#00ff88]/70 hover:text-[#00ff88] transition-colors"
                >
                  Analizar →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
