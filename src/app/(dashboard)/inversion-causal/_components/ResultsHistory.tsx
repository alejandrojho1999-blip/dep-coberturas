'use client'

import { useEffect, useState } from 'react'
import type { PipelineResult } from '@/lib/causal/types'

interface HistoryEntry {
  id: string
  created_at: string
  result: PipelineResult
}

interface Props {
  assetId: string
  onLoadResult: (result: PipelineResult) => void
}

const signalConfig = {
  AUMENTAR: { label: 'AUMENTAR', color: 'text-green-400 bg-green-500/10' },
  MANTENER: { label: 'MANTENER', color: 'text-yellow-400 bg-yellow-500/10' },
  REDUCIR: { label: 'REDUCIR', color: 'text-red-400 bg-red-500/10' },
} as const

export default function ResultsHistory({ assetId, onLoadResult }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/causal/results?assetId=${encodeURIComponent(assetId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<{ results: HistoryEntry[] }>
      })
      .then(({ results }) => {
        if (!cancelled) setEntries(results)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#64748b] text-sm py-8 justify-center">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Cargando historial...
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-[#64748b] text-sm py-8 text-center">Sin análisis previos</p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#64748b] mb-4">
        Últimos {entries.length} análisis — haz clic para cargar en la vista de resultados
      </p>
      {entries.map((entry) => {
        const signal = entry.result.portfolio.signal
        const score = entry.result.portfolio.score
        const cfg = signalConfig[signal]
        const date = new Date(entry.created_at)

        return (
          <button
            key={entry.id}
            onClick={() => onLoadResult(entry.result)}
            className="w-full text-left rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-4 py-3 hover:border-[#00ff88]/40 hover:bg-[#00ff88]/5 transition-colors group"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-[#e2e8f0] group-hover:text-white transition-colors">
                  {date.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-xs text-[#64748b]">
                  {date.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#e2e8f0]">
                  Score: <span className="font-semibold text-[#00ff88]">{score.toFixed(1)}</span>
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
