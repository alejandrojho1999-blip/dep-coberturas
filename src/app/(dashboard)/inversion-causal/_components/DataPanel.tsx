'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CausalConfig, DataRow } from '@/lib/causal/types'

interface Props {
  config: CausalConfig
  onDataReady: (data: DataRow[]) => void
  assetId?: string
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

function latestValueFor(data: FredRow[], key: keyof FredRow): number | undefined {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][key]
    if (v != null && typeof v === 'number' && isFinite(v)) return v
  }
  return undefined
}

function latestFutureReturn(data: YahooRow[]): number | null {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].futureReturn != null) return data[i].futureReturn!
  }
  return null
}

export default function DataPanel({ config, onDataReady, assetId }: Props) {
  const [startDate, setStartDate] = useState('2010-01-01')
  const [endDate, setEndDate] = useState(todayISO)
  const [pendingStart, setPendingStart] = useState('2010-01-01')
  const [pendingEnd, setPendingEnd] = useState(todayISO)

  const [fredState, setFredState] = useState<SourceState<FredRow>>({ status: 'idle', data: null, error: null })
  const [yahooState, setYahooState] = useState<SourceState<YahooRow>>({ status: 'idle', data: null, error: null })
  const [merging, setMerging] = useState(false)

  const [manualTreatmentValue, setManualTreatmentValue] = useState(
    config.manualValues?.[config.treatment] != null
      ? String(config.manualValues[config.treatment])
      : ''
  )
  const manualTreatmentRef = useRef(manualTreatmentValue)
  manualTreatmentRef.current = manualTreatmentValue
  const configManualValuesRef = useRef(config.manualValues)
  configManualValuesRef.current = config.manualValues
  const [editingTreatment, setEditingTreatment] = useState(false)

  const [rowEdits, setRowEdits] = useState<Record<string, string>>(() => {
    const saved = config.manualRowValues?.[config.treatment] ?? {}
    return Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)]))
  })
  const rowEditsRef = useRef(rowEdits)
  rowEditsRef.current = rowEdits
  const [editingRowDate, setEditingRowDate] = useState<string | null>(null)
  const configManualRowValuesRef = useRef(config.manualRowValues)
  configManualRowValuesRef.current = config.manualRowValues

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
      for (const obs of body.YIELD_10Y ?? []) {
        const q = toQuarter(obs.date)
        byDate.set(q, { date: quarterToDate(q), ...byDate.get(q), YIELD_10Y: obs.value })
      }
      for (const obs of body.FED_RATE ?? []) {
        const q = toQuarter(obs.date)
        byDate.set(q, { date: quarterToDate(q), ...byDate.get(q), FED_RATE: obs.value })
      }
      for (const obs of body.VIX ?? []) {
        const q = toQuarter(obs.date)
        byDate.set(q, { date: quarterToDate(q), ...byDate.get(q), VIX: obs.value })
      }
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

  const serializedManualValues = JSON.stringify(config.manualValues ?? {})
  const serializedRowEdits = JSON.stringify(rowEdits)

  useEffect(() => {
    if (fredState.status === 'success' && yahooState.status === 'success') {
      mergeAndNotify()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fredState.status, yahooState.status, manualTreatmentValue, serializedManualValues, serializedRowEdits])

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

      // Inject stored manual values for all non-FRED variables (confounders, colliders, treatment)
      for (const [varName, val] of Object.entries(configManualValuesRef.current ?? {})) {
        if (!isNaN(val) && isFinite(val)) {
          for (const row of merged) {
            ;(row as Record<string, number | string>)[varName] = val
          }
        }
      }

      // Treatment: use per-row edits when available, fall back to single value
      if (!treatmentIsFred) {
        for (const row of merged) {
          const dateKey = row.date as string
          const perRowStr = rowEditsRef.current[dateKey]
          const perRowSaved = configManualRowValuesRef.current?.[config.treatment]?.[dateKey]
          const num = perRowStr != null
            ? parseFloat(perRowStr)
            : perRowSaved != null
              ? perRowSaved
              : parseFloat(manualTreatmentRef.current)
          if (!isNaN(num) && isFinite(num)) {
            ;(row as Record<string, number | string>)[config.treatment] = num
          }
        }
      }

      onDataReady(merged)
    } finally {
      setMerging(false)
    }
  }

  async function saveRowValues(edits: Record<string, string>) {
    if (!assetId) return
    const parsed: Record<string, number> = {}
    for (const [date, val] of Object.entries(edits)) {
      const num = parseFloat(val)
      if (!isNaN(num) && isFinite(num)) parsed[date] = num
    }
    try {
      await fetch('/api/causal/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId, manualRowValues: { [config.treatment]: parsed } }),
      })
    } catch { /* silent */ }
  }

  async function saveManualValue(value: string) {
    if (!assetId) return
    const num = parseFloat(value)
    if (isNaN(num) || !isFinite(num)) return
    try {
      await fetch('/api/causal/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assetId, manualValues: { [config.treatment]: num } }),
      })
    } catch {
      // silent fail — value still works in memory
    }
  }

  function handleApplyDates() {
    setStartDate(pendingStart)
    setEndDate(pendingEnd)
    loadFred(pendingStart, pendingEnd)
    loadYahoo(pendingStart, pendingEnd)
  }

  const latestYahoo = yahooState.data?.at(-1)
  const fredLoading = fredState.status === 'loading'
  const yahooLoading = yahooState.status === 'loading'
  const treatmentIsFred = FRED_VARS.has(config.treatment)
  const fredTableCols = [...new Set([config.treatment, ...config.confounders].filter((v) => FRED_VARS.has(v)))]
  const latestFredValueFor = (key: keyof FredRow): number | undefined =>
    fredState.data ? latestValueFor(fredState.data, key) : undefined
  const bestFutureReturn = yahooState.data ? latestFutureReturn(yahooState.data) : null

  const anyLoading = fredLoading || yahooLoading

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
    <div className="space-y-5">

      {/* ── Date Range Filter ── */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-[#1e1e2e] bg-[#0a0a0f]">
        <div className="flex-1 min-w-[130px]">
          <label className="text-xs text-[#64748b] mb-1.5 block font-medium">Desde</label>
          <input
            type="date"
            value={pendingStart}
            onChange={(e) => setPendingStart(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#12121a] border border-[#1e1e2e] text-[#e2e8f0] text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
          />
        </div>
        <div className="flex-1 min-w-[130px]">
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
          disabled={anyLoading}
          className="px-4 py-2 rounded-lg bg-[#1e1e2e] text-[#e2e8f0] text-sm font-medium hover:bg-[#252535] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Aplicar
        </button>
        <div className="text-xs text-[#475569] self-center">Frecuencia: trimestral</div>
      </div>

      {/* ── Variables Table ── */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Variables del modelo</p>
          {anyLoading && <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />}
        </div>

        {/* Warning when treatment is not a FRED/Yahoo variable */}
        {!treatmentIsFred && (
          <div className="px-4 py-2.5 bg-yellow-500/8 border-b border-yellow-500/20 flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5 shrink-0">⚠</span>
            <p className="text-xs text-yellow-400/90 leading-relaxed">
              <span className="font-mono font-semibold">{config.treatment}</span> no está disponible en FRED/Yahoo Finance.
              Ingresa el valor actual manualmente o cambia el tratamiento a una variable macro (FED_RATE, YIELD_10Y, VIX).
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[320px]">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="px-4 py-2.5 text-left font-medium text-[#475569]">Variable</th>
                <th className="px-4 py-2.5 text-left font-medium text-[#475569]">Rol</th>
                <th className="px-4 py-2.5 text-right font-medium text-[#475569]">Valor actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]/60">

              {/* Treatment row — always present */}
              <tr className="hover:bg-[#3b82f6]/5 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[#3b82f6] font-medium">{config.treatment}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/20 font-semibold uppercase tracking-wide">
                    Tratamiento
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {treatmentIsFred ? (
                    <span className="text-[#3b82f6]">
                      {fredLoading
                        ? <span className="text-[#334155] animate-pulse">···</span>
                        : formatVarValue(config.treatment, latestFredValueFor(config.treatment as keyof FredRow))
                      }
                    </span>
                  ) : editingTreatment ? (
                    <span className="flex items-center justify-end gap-1.5">
                      <input
                        type="text"
                        value={manualTreatmentValue}
                        onChange={(e) => setManualTreatmentValue(e.target.value)}
                        placeholder="ej: 12.5%"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') { setEditingTreatment(false); void saveManualValue(manualTreatmentValue) } }}
                        className="w-24 px-2 py-0.5 rounded bg-[#12121a] border border-[#3b82f6]/40 text-[#e2e8f0] text-right focus:outline-none focus:border-[#3b82f6] text-xs"
                      />
                      <button
                        onClick={() => { setEditingTreatment(false); void saveManualValue(manualTreatmentValue) }}
                        className="text-[#00ff88] hover:text-[#00ff88]/80 cursor-pointer font-bold"
                      >
                        ✓
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center justify-end gap-2">
                      <span className={manualTreatmentValue ? 'text-[#e2e8f0]' : 'text-[#475569]'}>
                        {manualTreatmentValue || 'N/D'}
                      </span>
                      <button
                        onClick={() => setEditingTreatment(true)}
                        title="Ingresar valor"
                        className="text-[#475569] hover:text-[#3b82f6] cursor-pointer transition-colors text-sm leading-none"
                      >
                        ✏
                      </button>
                    </span>
                  )}
                </td>
              </tr>

              {/* Confounder rows */}
              {config.confounders.map((v) => {
                const isFred = FRED_VARS.has(v)
                const value = isFred ? latestFredValueFor(v as keyof FredRow) : undefined
                return (
                  <tr key={v} className="hover:bg-[#f59e0b]/5 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[#f59e0b]">{v}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20 font-semibold uppercase tracking-wide">
                        Confusor
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[#f59e0b]">
                      {isFred
                        ? (fredLoading ? <span className="text-[#334155] animate-pulse">···</span> : formatVarValue(v, value))
                        : <span className="text-[#475569]">N/D</span>
                      }
                    </td>
                  </tr>
                )
              })}

              {/* Outcome row — always shows "?" because this is the target to be determined by the causal analysis */}
              <tr className="hover:bg-[#00ff88]/5 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[#00ff88]">{config.outcome}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/20 font-semibold uppercase tracking-wide">
                    Resultado
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  <span
                    className="text-[#475569] italic text-sm tracking-widest"
                    title="Variable objetivo — su valor se determina al ejecutar el análisis causal"
                  >
                    ?
                  </span>
                </td>
              </tr>

              {/* Price row */}
              <tr className="hover:bg-white/2 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[#64748b]">{config.ticker}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-1.5 py-0.5 rounded-full text-[0.6rem] bg-[#475569]/15 text-[#64748b] border border-[#475569]/20 font-semibold uppercase tracking-wide">
                    Precio
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-[#e2e8f0]">
                  {yahooLoading
                    ? <span className="text-[#334155] animate-pulse">···</span>
                    : latestYahoo?.close != null ? `$${latestYahoo.close.toFixed(2)}` : '—'
                  }
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* ── FRED Data Table ── */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[#e2e8f0] font-semibold text-sm">Datos Macro · FRED</h3>
            <p className="text-[#475569] text-xs mt-0.5">
              {fredTableCols.join(' · ') || 'YIELD_10Y · FED_RATE · VIX'}
              <span className="ml-2 text-[#334155]">· más reciente primero</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(fredState)}
            {fredState.status === 'error' && (
              <button onClick={() => loadFred(startDate, endDate)} className="text-xs text-[#3b82f6] hover:underline cursor-pointer">
                Reintentar
              </button>
            )}
          </div>
        </div>

        {fredState.status === 'error' && (
          <p className="text-xs text-red-400 mb-3 bg-red-500/10 px-3 py-2 rounded-lg">{fredState.error}</p>
        )}

        {fredState.status === 'success' && fredState.data && fredState.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="text-xs w-full min-w-[360px]">
              <thead>
                <tr className="text-[#475569] border-b border-[#1e1e2e]">
                  <th className="pb-2 pr-3 text-left font-medium">Fecha</th>
                  <th className="pb-2 pr-3 text-right font-medium">YIELD 10Y</th>
                  <th className="pb-2 pr-3 text-right font-medium">FED Rate</th>
                  <th className="pb-2 pr-3 text-right font-medium">VIX</th>
                  {!treatmentIsFred && (
                    <th className="pb-2 text-right font-medium text-[#3b82f6]">{config.treatment}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {fredState.data.slice().reverse().map((row, i) => (
                  <tr key={i} className="text-[#e2e8f0] border-b border-[#1e1e2e]/40 last:border-0 hover:bg-white/2">
                    <td className="py-2 pr-3 text-[#64748b] tabular-nums">{row.date.slice(0, 7)}</td>
                    <td className={`py-2 pr-3 text-right font-mono tabular-nums ${config.confounders.includes('YIELD_10Y') ? 'text-[#f59e0b]' : 'text-[#e2e8f0]'}`}>
                      {row.YIELD_10Y != null ? `${row.YIELD_10Y.toFixed(2)}%` : '—'}
                    </td>
                    <td className={`py-2 pr-3 text-right font-mono tabular-nums ${config.treatment === 'FED_RATE' ? 'text-[#3b82f6]' : config.confounders.includes('FED_RATE') ? 'text-[#f59e0b]' : 'text-[#e2e8f0]'}`}>
                      {row.FED_RATE != null ? `${row.FED_RATE.toFixed(2)}%` : '—'}
                    </td>
                    <td className={`py-2 pr-3 text-right font-mono tabular-nums ${config.confounders.includes('VIX') ? 'text-[#f59e0b]' : 'text-[#e2e8f0]'}`}>
                      {row.VIX != null ? row.VIX.toFixed(1) : '—'}
                    </td>
                    {!treatmentIsFred && (
                      <td className="py-2 text-right font-mono tabular-nums">
                        {editingRowDate === row.date ? (
                          <input
                            type="text"
                            autoFocus
                            value={rowEdits[row.date] ?? ''}
                            onChange={(e) => setRowEdits((prev) => ({ ...prev, [row.date]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                setEditingRowDate(null)
                                void saveRowValues(rowEditsRef.current)
                              }
                            }}
                            onBlur={() => { setEditingRowDate(null); void saveRowValues(rowEditsRef.current) }}
                            className="w-20 px-1.5 py-0.5 rounded bg-[#12121a] border border-[#3b82f6]/40 text-[#e2e8f0] text-right text-xs focus:outline-none focus:border-[#3b82f6]"
                          />
                        ) : (
                          <span
                            className="flex items-center justify-end gap-1.5 cursor-pointer group"
                            onClick={() => setEditingRowDate(row.date)}
                          >
                            <span className={
                              rowEdits[row.date] != null || config.manualRowValues?.[config.treatment]?.[row.date] != null
                                ? 'text-[#3b82f6]'
                                : config.manualValues?.[config.treatment] != null
                                  ? 'text-[#3b82f6]/60'
                                  : 'text-[#475569]'
                            }>
                              {rowEdits[row.date]
                                ?? (config.manualRowValues?.[config.treatment]?.[row.date] != null
                                  ? String(config.manualRowValues[config.treatment]![row.date])
                                  : config.manualValues?.[config.treatment] != null
                                    ? config.manualValues[config.treatment].toFixed(2)
                                    : '—')}
                            </span>
                            <span className="text-[#334155] group-hover:text-[#3b82f6] transition-colors text-[0.65rem]">✏</span>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!treatmentIsFred && Object.keys(rowEdits).length === 0 && !config.manualValues?.[config.treatment] && fredState.status === 'success' && (
          <p className="text-xs text-yellow-400/70 mt-1.5 px-1">
            ⚠ Sin valores para {config.treatment} — haz clic en ✏ en cada fila para ingresar un valor distinto por trimestre
          </p>
        )}
        {fredState.status === 'success' && fredState.data && (
          <p className="text-xs text-[#475569] mt-2 px-1">
            {fredState.data.length} trimestres descargados
          </p>
        )}
      </div>

      {merging && <p className="text-xs text-[#64748b] text-center animate-pulse">Unificando datasets…</p>}
    </div>
  )
}
