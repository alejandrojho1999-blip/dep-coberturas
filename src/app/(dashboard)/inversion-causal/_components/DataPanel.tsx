'use client'

import { useState, useEffect, useCallback } from 'react'
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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
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

const FRED_VARS = new Set(['FED_RATE', 'YIELD_10Y', 'VIX'])

function formatVarValue(varName: string, value: number | undefined): string {
  if (value == null || !isFinite(value)) return '—'
  if (varName === 'VIX') return value.toFixed(1)
  if (varName === 'FED_RATE' || varName === 'YIELD_10Y') return `${value.toFixed(2)}%`
  return value.toFixed(3)
}

interface VarCardProps {
  label: string
  varName: string
  value: number | undefined
  loading: boolean
  accentColor: string
  bgColor: string
  borderColor: string
  role: string
}

function VarCard({ label, varName, value, loading, accentColor, bgColor, borderColor, role }: VarCardProps) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${accentColor}`}>{role}</span>
        {loading && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ color: accentColor.replace('text-[', '').replace(']', '') }} />}
      </div>
      <div>
        <div className="text-xs font-mono text-[#64748b] mb-1">{varName}</div>
        <div className={`text-xl font-bold font-mono ${accentColor}`}>
          {loading ? <span className="text-[#334155] animate-pulse">···</span> : formatVarValue(varName, value)}
        </div>
      </div>
      <div className="text-xs text-[#475569]">{label}</div>
    </div>
  )
}

export default function DataPanel({ config, onDataReady }: Props) {
  const [startDate, setStartDate] = useState('2010-01-01')
  const [endDate, setEndDate] = useState(todayISO)
  const [pendingStart, setPendingStart] = useState('2010-01-01')
  const [pendingEnd, setPendingEnd] = useState(todayISO)

  const [fredState, setFredState] = useState<SourceState<FredRow>>({ status: 'idle', data: null, error: null })
  const [yahooState, setYahooState] = useState<SourceState<YahooRow>>({ status: 'idle', data: null, error: null })
  const [merging, setMerging] = useState(false)

  const loadFred = useCallback(async (start: string, end: string) => {
    setFredState({ status: 'loading', data: null, error: null })
    try {
      const res = await fetch(`/api/data/fred?start=${start}&end=${end}`)
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
      for (const obs of body.FED_RATE ?? []) byDate.set(obs.date, { ...byDate.get(obs.date), date: obs.date, FED_RATE: obs.value })
      for (const obs of body.VIX ?? []) byDate.set(obs.date, { ...byDate.get(obs.date), date: obs.date, VIX: obs.value })
      const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      setFredState({ status: 'success', data: rows, error: null })
    } catch (err) {
      setFredState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Error cargando FRED' })
    }
  }, [])

  const loadYahoo = useCallback(async (start: string, end: string) => {
    setYahooState({ status: 'loading', data: null, error: null })
    try {
      const params = new URLSearchParams({ ticker: config.ticker, start, end, horizon: String(config.horizon) })
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
  }, [config.ticker, config.horizon])

  useEffect(() => {
    loadFred(startDate, endDate)
    loadYahoo(startDate, endDate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.ticker, config.horizon])

  useEffect(() => {
    if (fredState.status === 'success' && yahooState.status === 'success') {
      mergeAndNotify()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fredState.status, yahooState.status])

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

  function handleApplyDates() {
    setStartDate(pendingStart)
    setEndDate(pendingEnd)
    loadFred(pendingStart, pendingEnd)
    loadYahoo(pendingStart, pendingEnd)
  }

  const latestFred = fredState.data?.at(-1)
  const latestYahoo = yahooState.data?.at(-1)
  const fredLoading = fredState.status === 'loading'
  const yahooLoading = yahooState.status === 'loading'

  // Determine which FRED vars are relevant for this config
  const treatmentIsFred = FRED_VARS.has(config.treatment)
  const confoundersFred = config.confounders.filter((v) => FRED_VARS.has(v))

  // Table columns: treatment + confounders that are in FRED data
  const fredTableCols = [config.treatment, ...config.confounders].filter((v) => FRED_VARS.has(v))

  const statusBadge = (state: SourceState<unknown>) => {
    if (state.status === 'loading') return <span className="text-xs text-[#64748b] animate-pulse">Cargando…</span>
    if (state.status === 'success') return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
        ✓ {state.data!.length} filas
      </span>
    )
    if (state.status === 'error') return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Error</span>
    )
    return null
  }

  return (
    <div className="space-y-6">
      {/* ── Date Range Filter ── */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-[#1e1e2e] bg-[#0a0a0f]">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-[#64748b] mb-1.5 block font-medium">Desde</label>
          <input
            type="date"
            value={pendingStart}
            onChange={(e) => setPendingStart(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-[#1e1e2e] text-[#e2e8f0] text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-[#64748b] mb-1.5 block font-medium">Hasta</label>
          <input
            type="date"
            value={pendingEnd}
            onChange={(e) => setPendingEnd(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-[#1e1e2e] text-[#e2e8f0] text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
          />
        </div>
        <button
          onClick={handleApplyDates}
          disabled={fredLoading || yahooLoading}
          className="px-4 py-2 rounded-lg bg-[#1e1e2e] text-[#e2e8f0] text-sm font-medium hover:bg-[#252535] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Aplicar
        </button>
        <div className="text-xs text-[#475569] self-center">
          Frecuencia: trimestral
        </div>
      </div>

      {/* ── Variable Value Cards ── */}
      <div>
        <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-3">
          Valores actuales de variables
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* Treatment card */}
          {treatmentIsFred && (
            <VarCard
              role="Tratamiento"
              varName={config.treatment}
              label="Variable causal"
              value={latestFred?.[config.treatment as keyof FredRow] as number | undefined}
              loading={fredLoading}
              accentColor="text-[#3b82f6]"
              bgColor="bg-[#0a0a0f]"
              borderColor="border-[#3b82f6]/40"
            />
          )}

          {/* Confounder cards */}
          {confoundersFred.map((v) => (
            <VarCard
              key={v}
              role="Confusor"
              varName={v}
              label="Variable de control"
              value={latestFred?.[v as keyof FredRow] as number | undefined}
              loading={fredLoading}
              accentColor="text-[#f59e0b]"
              bgColor="bg-[#0a0a0f]"
              borderColor="border-[#f59e0b]/40"
            />
          ))}

          {/* Outcome card (Yahoo) */}
          <VarCard
            role="Resultado"
            varName={config.outcome}
            label={`Retorno ${config.horizon}Q futuro`}
            value={latestYahoo?.futureReturn != null ? latestYahoo.futureReturn * 100 : undefined}
            loading={yahooLoading}
            accentColor="text-[#00ff88]"
            bgColor="bg-[#0a0a0f]"
            borderColor="border-[#00ff88]/40"
          />

          {/* Ticker price card */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748b]">Precio</span>
            </div>
            <div>
              <div className="text-xs font-mono text-[#64748b] mb-1">{config.ticker}</div>
              <div className="text-xl font-bold font-mono text-[#e2e8f0]">
                {yahooLoading
                  ? <span className="text-[#334155] animate-pulse">···</span>
                  : latestYahoo?.close != null ? `$${latestYahoo.close.toFixed(2)}` : '—'
                }
              </div>
            </div>
            <div className="text-xs text-[#475569]">Último cierre disponible</div>
          </div>
        </div>
      </div>

      {/* ── Data Tables ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* FRED table */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[#e2e8f0] font-semibold text-sm">Datos Macro · FRED</h3>
              <p className="text-[#475569] text-xs mt-0.5">
                {fredTableCols.join(' · ') || 'YIELD_10Y · FED_RATE · VIX'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(fredState)}
              {fredState.status === 'error' && (
                <button onClick={() => loadFred(startDate, endDate)} className="text-xs text-[#3b82f6] hover:underline cursor-pointer">Reintentar</button>
              )}
            </div>
          </div>

          {fredState.status === 'error' && (
            <p className="text-xs text-red-400 mb-3">{fredState.error}</p>
          )}

          {fredState.status === 'success' && fredState.data && fredState.data.length > 0 && (
            <div className="overflow-x-auto max-h-52 overflow-y-auto">
              <table className="text-xs w-full">
                <thead className="sticky top-0 bg-[#0a0a0f]">
                  <tr className="text-[#475569] border-b border-[#1e1e2e]">
                    <th className="pb-2 pr-3 text-left font-medium">Fecha</th>
                    <th className="pb-2 pr-3 text-right font-medium">YIELD 10Y</th>
                    <th className="pb-2 pr-3 text-right font-medium">FED Rate</th>
                    <th className="pb-2 text-right font-medium">VIX</th>
                  </tr>
                </thead>
                <tbody>
                  {fredState.data.slice(-8).map((row, i) => (
                    <tr key={i} className="text-[#e2e8f0] border-b border-[#1e1e2e]/50 last:border-0">
                      <td className="py-1.5 pr-3 text-[#64748b]">{row.date.slice(0, 7)}</td>
                      <td className={`py-1.5 pr-3 text-right font-mono ${config.confounders.includes('YIELD_10Y') ? 'text-[#f59e0b]' : ''}`}>
                        {row.YIELD_10Y?.toFixed(2) ?? '—'}
                      </td>
                      <td className={`py-1.5 pr-3 text-right font-mono ${config.treatment === 'FED_RATE' ? 'text-[#3b82f6]' : config.confounders.includes('FED_RATE') ? 'text-[#f59e0b]' : ''}`}>
                        {row.FED_RATE?.toFixed(2) ?? '—'}
                      </td>
                      <td className={`py-1.5 text-right font-mono ${config.confounders.includes('VIX') ? 'text-[#f59e0b]' : ''}`}>
                        {row.VIX?.toFixed(2) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Yahoo table */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[#e2e8f0] font-semibold text-sm">Precio · Yahoo Finance</h3>
              <p className="text-[#475569] text-xs mt-0.5">{config.ticker} · horizonte {config.horizon}Q</p>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(yahooState)}
              {yahooState.status === 'error' && (
                <button onClick={() => loadYahoo(startDate, endDate)} className="text-xs text-[#3b82f6] hover:underline cursor-pointer">Reintentar</button>
              )}
            </div>
          </div>

          {yahooState.status === 'error' && (
            <p className="text-xs text-red-400 mb-3">{yahooState.error}</p>
          )}

          {yahooState.status === 'success' && yahooState.data && yahooState.data.length > 0 && (
            <div className="overflow-x-auto max-h-52 overflow-y-auto">
              <table className="text-xs w-full">
                <thead className="sticky top-0 bg-[#0a0a0f]">
                  <tr className="text-[#475569] border-b border-[#1e1e2e]">
                    <th className="pb-2 pr-3 text-left font-medium">Fecha</th>
                    <th className="pb-2 pr-3 text-right font-medium">Precio</th>
                    <th className="pb-2 pr-3 text-right font-medium">Log Ret.</th>
                    <th className="pb-2 text-right font-medium">Fut. Ret.</th>
                  </tr>
                </thead>
                <tbody>
                  {yahooState.data.slice(-8).map((row, i) => (
                    <tr key={i} className="text-[#e2e8f0] border-b border-[#1e1e2e]/50 last:border-0">
                      <td className="py-1.5 pr-3 text-[#64748b]">{String(row.date).slice(0, 7)}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">{row.close != null ? `$${row.close.toFixed(2)}` : '—'}</td>
                      <td className={`py-1.5 pr-3 text-right font-mono ${row.logReturn != null && row.logReturn >= 0 ? 'text-[#00ff88]' : 'text-red-400'}`}>
                        {row.logReturn != null ? `${(row.logReturn * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className={`py-1.5 text-right font-mono ${row.futureReturn != null && row.futureReturn >= 0 ? 'text-[#00ff88]' : row.futureReturn != null ? 'text-red-400' : 'text-[#475569]'}`}>
                        {row.futureReturn != null ? `${(row.futureReturn * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {merging && <p className="text-xs text-[#64748b] text-center animate-pulse">Unificando datasets…</p>}
    </div>
  )
}
