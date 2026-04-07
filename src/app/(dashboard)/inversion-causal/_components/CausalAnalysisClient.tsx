'use client'

import { useState } from 'react'
import type { CausalConfig, DataRow, PipelineResult } from '@/lib/causal/types'
import DataPanel from './DataPanel'
import DagPanel from './DagPanel'

interface Props {
  config: CausalConfig
  assetId?: string
  userId?: string
}

type ActiveTab = 'data' | 'dag' | 'results'

export default function CausalAnalysisClient({ config, assetId }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('data')
  const [mergedData, setMergedData] = useState<DataRow[] | null>(null)
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRunAnalysis() {
    if (!mergedData) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/causal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, config, data: mergedData }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { result: PipelineResult }
      setPipelineResult(body.result)
      setActiveTab('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'data', label: 'Datos' },
    { id: 'dag', label: 'DAG' },
    { id: 'results', label: 'Resultados' },
  ]

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#1e1e2e]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[#00ff88] border-b-2 border-[#00ff88]'
                : 'text-[#64748b] hover:text-[#e2e8f0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'data' && (
          <div className="space-y-6">
            <DataPanel config={config} onDataReady={setMergedData} />

            {mergedData && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-[#64748b]">
                  {mergedData.length} observaciones listas
                </span>
                <button
                  onClick={handleRunAnalysis}
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-[#00ff88] text-[#0a0a0f] text-sm font-semibold hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Ejecutando...' : 'Ejecutar Análisis'}
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
            )}
          </div>
        )}

        {activeTab === 'dag' && (
          <DagPanel config={config} />
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            {pipelineResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-[#64748b] text-sm">Signal:</span>
                  <span
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      pipelineResult.portfolio.signal === 'AUMENTAR'
                        ? 'bg-[#00ff88]/10 text-[#00ff88]'
                        : pipelineResult.portfolio.signal === 'REDUCIR'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    {pipelineResult.portfolio.signal}
                  </span>
                  <span className="text-[#64748b] text-sm ml-2">
                    Score: <span className="text-[#e2e8f0]">{pipelineResult.portfolio.score.toFixed(1)}</span>
                  </span>
                </div>
                <p className="text-[#64748b] text-xs">
                  Análisis completado —{' '}
                  {new Date(pipelineResult.runAt).toLocaleString('es-ES')}
                </p>
                <p className="text-[#64748b] text-sm mt-2">
                  Panel completo de resultados — próximamente (Task 12)
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-[#64748b] text-sm">
                Resultados — próximamente (Task 12)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
