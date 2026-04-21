'use client'

import { useState, useEffect } from 'react'
import type { CausalConfig, DataRow } from '@/lib/causal/types'

interface Props {
  config: CausalConfig
  onDataReady: (data: DataRow[]) => void
}

interface FredRow {
  date: string
  YIELD_10Y?: number
  FED_RATE?: number
  VIX?: number
}

interface YahooRow {
  date: string
  close?: number
  logReturn?: number
  futureReturn?: number | null
}

type DataStatus = 'idle' | 'loading' | 'success' | 'error'

interface SourceState<T> {
  status: DataStatus
  data: T[] | null
  error: string | null
}

function toQuarter(dateStr: string): string {
  const d = new Date(dateStr)
  const q = Math.ceil((d.getUTCMonth() + 1) / 3)
  return `${d.getUTCFullYear()}-Q${q}`
}

function quarterToDate(q: string): string {
  const [year, quarter] = q.split('-Q')
  const month = (parseInt(quarter) - 1) * 3 + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export default function DataPanel({ config, onDataReady }: Props) {
  const [fredState, setFredState] = useState<SourceState<FredRow>>({ status: 'idle', data: null, error: null })
  const [yahooState, setYahooState] = useState<SourceState<YahooRow>>({ status: 'idle', data: null, error: null })
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    loadFred()
    loadYahoo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.ticker, config.horizon])

  useEffect(() => {
    if (fredState.status === 'success' && yahooState.status === 'success') {
      mergeAndNotify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fredState.status, yahooState.status])

  async function loadFred() {
    setFredState({ status: 'loading', data: null, error: null })
    try {
      const res = await fetch('/api/data/fred?start=2010-01-01')
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as {
        YIELD_10Y?: { date: string; value: number }[]
        FED_RATE?: { date: string; value: number }[]
        VIX?: { date: string; value: number }[]
      }
      const byDate = new Map<string, FredRow>()
      for (const obs of body.YIELD_10Y ?? []) byDate.set(obs.date, { ...byDate.get(obs.date), date: obs.date, YIELD_10Y: obs.value })
      for (const obs of body.FED_RATE ?? [])  byDate.set(obs.date, { ...byDate.get(obs.date), date: obs.date, FED_RATE: obs.value })
      for (const obs of body.VIX ?? [])       byDate.set(obs.date, { ...byDate.get(obs.date), date: obs.date, VIX: obs.value })
      const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      setFredState({ status: 'success', data: rows, error: null })
    } catch (err) {
      setFredState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Error cargando FRED' })
    }
  }

  async function loadYahoo() {
    setYahooState({ status: 'loading', data: null, error: null })
    try {
      const params = new URLSearchParams({ ticker: config.ticker, start: '2010-01-01', horizon: String(config.horizon) })
      const res = await fetch(`/api/data/yahoo?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { observations: YahooRow[] }
      setYahooState({ status: 'success', data: body.observations, error: null })
    } catch (err) {
      setYahooState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Error cargando Yahoo Finance' })
    }
  }

  function mergeAndNotify() {
    if (fredState.status !== 'success' || yahooState.status !== 'success') return
    setMerging(true)
    try {
      const fredByQ = new Map<string, FredRow>()
      for (const row of fredState.data!) fredByQ.set(toQuarter(row.date), row)

      const yahooByQ = new Map<string, YahooRow>()
      for (const row of yahooState.data!) yahooByQ.set(toQuarter(row.date), row)

      const merged: DataRow[] = Array.from(fredByQ.keys())
        .filter((q) => yahooByQ.has(q))
        .sort()
        .map((q) => {
          const fred = fredByQ.get(q)!
          const yahoo = yahooByQ.get(q)!
          return {
            date: quarterToDate(q),
            YIELD_10Y: fred.YIELD_10Y ?? NaN,
            FED_RATE: fred.FED_RATE ?? NaN,
            VIX: fred.VIX ?? NaN,
            Return: yahoo.logReturn ?? NaN,
            FutureReturn: yahoo.futureReturn ?? NaN,
          }
        })

      onDataReady(merged)
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* FRED */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[#e2e8f0] font-medium text-sm">Datos FRED</h3>
              <p className="text-[#64748b] text-xs mt-0.5">YIELD_10Y · FED_RATE · VIX</p>
            </div>
            {fredState.status === 'loading' && <span className="text-xs text-[#64748b] animate-pulse">Cargando...</span>}
            {fredState.status === 'success' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
                ✓ {fredState.data!.length} filas
              </span>
            )}
            {fredState.status === 'error' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Error</span>
            )}
          </div>

          {fredState.status === 'error' && (
            <div className="mb-2 space-y-1">
              <p className="text-xs text-red-400">{fredState.error}</p>
              <button onClick={loadFred} className="text-xs text-[#3b82f6] hover:underline cursor-pointer">Reintentar</button>
            </div>
          )}

          {fredState.status === 'success' && fredState.data && fredState.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-[#64748b] border-b border-[#1e1e2e]">
                    <th className="pb-1 pr-3 text-left font-normal">Fecha</th>
                    <th className="pb-1 pr-3 text-right font-normal">10Y</th>
                    <th className="pb-1 pr-3 text-right font-normal">FED</th>
                    <th className="pb-1 text-right font-normal">VIX</th>
                  </tr>
                </thead>
                <tbody>
                  {fredState.data.slice(-3).map((row, i) => (
                    <tr key={i} className="text-[#e2e8f0]">
                      <td className="py-0.5 pr-3">{row.date.slice(0, 7)}</td>
                      <td className="py-0.5 pr-3 text-right">{row.YIELD_10Y?.toFixed(2) ?? '—'}</td>
                      <td className="py-0.5 pr-3 text-right">{row.FED_RATE?.toFixed(2) ?? '—'}</td>
                      <td className="py-0.5 text-right">{row.VIX?.toFixed(2) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Yahoo */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[#e2e8f0] font-medium text-sm">Yahoo Finance</h3>
              <p className="text-[#64748b] text-xs mt-0.5">{config.ticker} · horizonte {config.horizon}Q</p>
            </div>
            {yahooState.status === 'loading' && <span className="text-xs text-[#64748b] animate-pulse">Cargando...</span>}
            {yahooState.status === 'success' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
                ✓ {yahooState.data!.length} obs
              </span>
            )}
            {yahooState.status === 'error' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Error</span>
            )}
          </div>

          {yahooState.status === 'error' && (
            <div className="mb-2 space-y-1">
              <p className="text-xs text-red-400">{yahooState.error}</p>
              <button onClick={loadYahoo} className="text-xs text-[#3b82f6] hover:underline cursor-pointer">Reintentar</button>
            </div>
          )}

          {yahooState.status === 'success' && yahooState.data && yahooState.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-[#64748b] border-b border-[#1e1e2e]">
                    <th className="pb-1 pr-3 text-left font-normal">Fecha</th>
                    <th className="pb-1 pr-3 text-right font-normal">Precio</th>
                    <th className="pb-1 pr-3 text-right font-normal">LogRet</th>
                    <th className="pb-1 text-right font-normal">FutRet</th>
                  </tr>
                </thead>
                <tbody>
                  {yahooState.data.slice(-3).map((row, i) => (
                    <tr key={i} className="text-[#e2e8f0]">
                      <td className="py-0.5 pr-3">{String(row.date).slice(0, 7)}</td>
                      <td className="py-0.5 pr-3 text-right">{row.close?.toFixed(2) ?? '—'}</td>
                      <td className="py-0.5 pr-3 text-right">{row.logReturn != null ? (row.logReturn * 100).toFixed(1) + '%' : '—'}</td>
                      <td className="py-0.5 text-right">{row.futureReturn != null ? (row.futureReturn * 100).toFixed(1) + '%' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {merging && <p className="text-xs text-[#64748b] text-center animate-pulse">Unificando datos...</p>}
    </div>
  )
}
