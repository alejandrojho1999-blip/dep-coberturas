'use client'

import { useState } from 'react'
import type { CausalConfig, DataRow, PipelineResult } from '@/lib/causal/types'
import { runPC } from '@/lib/causal/discovery'
import type { PCResult } from '@/lib/causal/discovery'
import DataPanel from './DataPanel'
import DagPanel from './DagPanel'
import ModelComparisonPanel from './ModelComparison'
import PortfolioScorePanel from './PortfolioScore'
import BacktestPanelComponent from './BacktestPanel'
import PlaceboPanelComponent from './PlaceboPanel'
import ResultsHistory from './ResultsHistory'

interface Props {
  config: CausalConfig
  assetId?: string
  userId?: string
}

type ActiveTab = 'data' | 'dag' | 'results' | 'historial'

export default function CausalAnalysisClient({ config, assetId }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('data')
  const [mergedData, setMergedData] = useState<DataRow[] | null>(null)
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null)
  const [pcResult, setPcResult] = useState<PCResult | null>(null)
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

      // Run PC algorithm in background after results are shown
      const variables = [config.treatment, config.outcome, ...config.confounders]
      const dataByVar: Record<string, number[]> = Object.fromEntries(
        variables.map((v) => [v, [] as number[]])
      )
      for (const row of mergedData) {
        const allFinite = variables.every((v) => {
          const val = row[v]
          return typeof val === 'number' && isFinite(val)
        })
        if (!allFinite) continue
        for (const v of variables) {
          dataByVar[v].push(row[v] as number)
        }
      }
      const n = dataByVar[variables[0]]?.length ?? 0
      if (n > variables.length + 3) {
        setTimeout(() => {
          const pc = runPC(dataByVar, variables, n)
          setPcResult(pc)
        }, 0)
      }

      setActiveTab('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const hasRealAsset = Boolean(assetId) && config.ticker !== 'AAPL'

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'data', label: 'Datos' },
    { id: 'dag', label: 'DAG' },
    { id: 'results', label: 'Resultados' },
    ...(hasRealAsset ? [{ id: 'historial' as const, label: 'Historial' }] : []),
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
          <DagPanel config={config} pcResult={pcResult ?? undefined} />
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            {pipelineResult ? (
              <div className="space-y-6">
                <p className="text-[#64748b] text-xs">
                  Análisis completado —{' '}
                  {new Date(pipelineResult.runAt).toLocaleString('es-ES')}
                </p>
                <ModelComparisonPanel models={pipelineResult.models} />
                <PortfolioScorePanel portfolio={pipelineResult.portfolio} />
                <BacktestPanelComponent backtest={pipelineResult.backtest} />
                <PlaceboPanelComponent multipleTesting={pipelineResult.multipleTesting} />
              </div>
            ) : (
              <p className="text-[#64748b]">Ejecuta el análisis para ver los resultados.</p>
            )}
          </div>
        )}

        {activeTab === 'historial' && assetId && (
          <ResultsHistory
            assetId={assetId}
            onLoadResult={(result) => {
              setPipelineResult(result)
              setActiveTab('results')
            }}
          />
        )}
      </div>
    </div>
  )
}
