'use client'

import { useState, useRef } from 'react'
import type { CausalConfig, DataRow } from '@/lib/causal/types'
import type { ParseResult } from '@/lib/data/parser'
import ColumnMapper from './ColumnMapper'

interface Props {
  config: CausalConfig
  onDataReady: (data: DataRow[]) => void
}

interface FredRow {
  date: string
  YIELD_10Y?: number
  FED_RATE?: number
  VIX?: number
  [key: string]: number | string | undefined
}

interface YahooRow {
  date: string
  close?: number
  adjClose?: number
  [key: string]: number | string | undefined
}

type DataStatus = 'idle' | 'loading' | 'success' | 'error'

interface SourceState<T> {
  status: DataStatus
  data: T[] | null
  error: string | null
}

// Quarter string: "2020-Q1"
function toQuarter(dateStr: string): string {
  const d = new Date(dateStr)
  const q = Math.ceil((d.getUTCMonth() + 1) / 3)
  return `${d.getUTCFullYear()}-Q${q}`
}

// Representative date for a quarter (first day)
function quarterToDate(q: string): string {
  const [year, quarter] = q.split('-Q')
  const month = (parseInt(quarter) - 1) * 3 + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function computeCapexGrowth(values: number[]): number[] {
  return values.map((v, i) => {
    if (i === 0) return NaN
    const prev = values[i - 1]
    if (prev === 0) return NaN
    return (v - prev) / Math.abs(prev)
  })
}

export default function DataPanel({ config, onDataReady }: Props) {
  const [fredState, setFredState] = useState<SourceState<FredRow>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [yahooState, setYahooState] = useState<SourceState<YahooRow>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const [uploadState, setUploadState] = useState<{
    status: DataStatus
    parseResult: ParseResult | null
    confirmedMapping: Record<string, string> | null
    rawRows: Record<string, number[]> | null
    rawDates: string[] | null
    error: string | null
  }>({
    status: 'idle',
    parseResult: null,
    confirmedMapping: null,
    rawRows: null,
    rawDates: null,
    error: null,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [merging, setMerging] = useState(false)

  // ---- FRED ----
  async function loadFred() {
    setFredState({ status: 'loading', data: null, error: null })
    try {
      const res = await fetch('/api/data/fred?start=2010-01-01')
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { data: FredRow[] }
      setFredState({ status: 'success', data: body.data, error: null })
    } catch (err) {
      setFredState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'Error cargando FRED',
      })
    }
  }

  // ---- Yahoo ----
  async function loadYahoo() {
    setYahooState({ status: 'loading', data: null, error: null })
    try {
      const params = new URLSearchParams({
        ticker: config.ticker,
        start: '2010-01-01',
        horizon: String(config.horizon),
      })
      const res = await fetch(`/api/data/yahoo?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { data: YahooRow[] }
      setYahooState({ status: 'success', data: body.data, error: null })
    } catch (err) {
      setYahooState({
        status: 'error',
        data: null,
        error: err instanceof Error ? err.message : 'Error cargando Yahoo Finance',
      })
    }
  }

  // ---- Upload ----
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadState({
      status: 'loading',
      parseResult: null,
      confirmedMapping: null,
      rawRows: null,
      rawDates: null,
      error: null,
    })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/data/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const body = await res.json() as { parseResult: ParseResult }

      // Build rawRows map for later merge
      const rawRows: Record<string, number[]> = {}
      const rawDates: string[] = body.parseResult.columns[0]?.dates ?? []
      for (const col of body.parseResult.columns) {
        rawRows[col.originalName] = col.values
      }

      setUploadState({
        status: 'success',
        parseResult: body.parseResult,
        confirmedMapping: null,
        rawRows,
        rawDates: body.parseResult.columns[0]?.dates ?? [],
        error: null,
      })
    } catch (err) {
      setUploadState({
        status: 'error',
        parseResult: null,
        confirmedMapping: null,
        rawRows: null,
        rawDates: null,
        error: err instanceof Error ? err.message : 'Error procesando archivo',
      })
    }
  }

  function handleMappingConfirmed(mapping: Record<string, string>) {
    setUploadState((prev) => ({ ...prev, confirmedMapping: mapping }))
  }

  // ---- Merge ----
  // Runs when all 3 sources ready and mapping confirmed
  function allReady(): boolean {
    return (
      fredState.status === 'success' &&
      yahooState.status === 'success' &&
      uploadState.status === 'success' &&
      uploadState.confirmedMapping !== null
    )
  }

  function mergeAndNotify() {
    if (!allReady()) return
    setMerging(true)

    try {
      const fredData = fredState.data!
      const yahooData = yahooState.data!
      const { confirmedMapping, rawRows, rawDates, parseResult } = uploadState

      // Build quarter-keyed maps
      const fredByQ: Map<string, FredRow> = new Map()
      for (const row of fredData) {
        fredByQ.set(toQuarter(row.date), row)
      }

      const yahooByQ: Map<string, YahooRow> = new Map()
      for (const row of yahooData) {
        yahooByQ.set(toQuarter(row.date), row)
      }

      // Build bloomberg data by quarter using mapping
      const bloombergByQ: Map<string, Record<string, number>> = new Map()
      const colNames = parseResult!.columns.map((c) => c.originalName)

      // Determine if rawRows contains raw CAPEX (needs pct_change) or CAPEX_Growth directly
      const hasRawCapex =
        rawRows !== null &&
        Object.entries(confirmedMapping!).some(
          ([orig, mapped]) => mapped === 'CAPEX_Growth' && orig !== 'CAPEX_Growth'
        )

      // Pre-compute CAPEX_Growth if needed
      let capexGrowthValues: number[] | null = null
      let capexGrowthDates: string[] | null = null

      if (hasRawCapex && rawRows !== null) {
        const capexEntry = Object.entries(confirmedMapping!).find(
          ([, mapped]) => mapped === 'CAPEX_Growth'
        )
        if (capexEntry) {
          const [capexOrigName] = capexEntry
          const rawCapex = rawRows[capexOrigName]
          if (rawCapex) {
            capexGrowthValues = computeCapexGrowth(rawCapex)
            capexGrowthDates = rawDates
          }
        }
      }

      if (rawRows !== null && rawDates !== null) {
        // Use per-column dates (all columns from same file share same date array mostly)
        // Group by quarter
        const dateArr = rawDates
        const numRows = dateArr.length

        for (let i = 0; i < numRows; i++) {
          const dateStr = dateArr[i]
          if (!dateStr) continue
          const q = toQuarter(dateStr)

          const existing = bloombergByQ.get(q) ?? {}

          for (const origName of colNames) {
            const mapped = confirmedMapping![origName]
            if (!mapped) continue

            // If this is the CAPEX column that needs pct_change, use precomputed values
            if (mapped === 'CAPEX_Growth' && hasRawCapex && capexGrowthValues !== null) {
              const val = capexGrowthValues[i]
              if (!isNaN(val)) existing[mapped] = val
            } else {
              const col = parseResult!.columns.find((c) => c.originalName === origName)
              if (col && col.dates[i] !== undefined) {
                const val = col.values[i]
                if (val !== undefined && !isNaN(val)) existing[mapped] = val
              }
            }
          }

          bloombergByQ.set(q, existing)
        }
      }

      // Inner join on quarters present in all 3 sources
      const allQuarters = Array.from(fredByQ.keys()).filter(
        (q) => yahooByQ.has(q) && bloombergByQ.has(q)
      )

      allQuarters.sort()

      const merged: DataRow[] = allQuarters.map((q) => {
        const fred = fredByQ.get(q)!
        const yahoo = yahooByQ.get(q)!
        const bloom = bloombergByQ.get(q)!

        const row: DataRow = {
          date: quarterToDate(q),
          // FRED fields
          YIELD_10Y: fred.YIELD_10Y ?? NaN,
          FED_RATE: fred.FED_RATE ?? NaN,
          VIX: fred.VIX ?? NaN,
          // Yahoo fields
          Return: yahoo.close ?? yahoo.adjClose ?? NaN,
        }

        // Bloomberg fields
        for (const [key, val] of Object.entries(bloom)) {
          row[key] = val
        }

        return row
      })

      onDataReady(merged)
    } finally {
      setMerging(false)
    }
  }

  const uploadReady =
    uploadState.status === 'success' && uploadState.confirmedMapping !== null

  return (
    <div className="space-y-4">
      {/* FRED Card */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[#e2e8f0] font-medium text-sm">Datos FRED</h3>
            <p className="text-[#64748b] text-xs mt-0.5">YIELD_10Y · FED_RATE · VIX</p>
          </div>
          {fredState.status === 'success' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
              ✓ {fredState.data!.length} filas
            </span>
          )}
          {fredState.status === 'error' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
              Error
            </span>
          )}
        </div>

        <button
          onClick={loadFred}
          disabled={fredState.status === 'loading'}
          className="px-4 py-1.5 rounded-lg border border-[#1e1e2e] text-[#e2e8f0] text-xs font-medium hover:border-[#3b82f6] hover:text-[#3b82f6] disabled:opacity-50 transition-colors"
        >
          {fredState.status === 'loading' ? 'Cargando...' : 'Cargar datos FRED'}
        </button>

        {fredState.status === 'error' && (
          <p className="mt-2 text-xs text-red-400">{fredState.error}</p>
        )}

        {fredState.status === 'success' && fredState.data && fredState.data.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-[#64748b] border-b border-[#1e1e2e]">
                  <th className="pb-1 pr-3 text-left font-normal">Fecha</th>
                  <th className="pb-1 pr-3 text-right font-normal">YIELD_10Y</th>
                  <th className="pb-1 pr-3 text-right font-normal">FED_RATE</th>
                  <th className="pb-1 text-right font-normal">VIX</th>
                </tr>
              </thead>
              <tbody>
                {fredState.data.slice(-3).map((row, i) => (
                  <tr key={i} className="text-[#e2e8f0]">
                    <td className="py-0.5 pr-3">{row.date}</td>
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

      {/* Yahoo Card */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[#e2e8f0] font-medium text-sm">Precios Yahoo Finance</h3>
            <p className="text-[#64748b] text-xs mt-0.5">{config.ticker} — {config.horizon}Q horizon</p>
          </div>
          {yahooState.status === 'success' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
              ✓ {yahooState.data!.length} obs
            </span>
          )}
          {yahooState.status === 'error' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
              Error
            </span>
          )}
        </div>

        <button
          onClick={loadYahoo}
          disabled={yahooState.status === 'loading'}
          className="px-4 py-1.5 rounded-lg border border-[#1e1e2e] text-[#e2e8f0] text-xs font-medium hover:border-[#3b82f6] hover:text-[#3b82f6] disabled:opacity-50 transition-colors"
        >
          {yahooState.status === 'loading' ? 'Cargando...' : 'Cargar precios'}
        </button>

        {yahooState.status === 'error' && (
          <p className="mt-2 text-xs text-red-400">{yahooState.error}</p>
        )}
      </div>

      {/* Upload Card */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[#e2e8f0] font-medium text-sm">Datos Bloomberg</h3>
            <p className="text-[#64748b] text-xs mt-0.5">Subir archivo .xlsx o .csv</p>
          </div>
          {uploadState.status === 'success' && uploadState.confirmedMapping && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
              ✓ Mapeo confirmado
            </span>
          )}
          {uploadState.status === 'error' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
              Error
            </span>
          )}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState.status === 'loading'}
          className="px-4 py-1.5 rounded-lg border border-[#1e1e2e] text-[#e2e8f0] text-xs font-medium hover:border-[#3b82f6] hover:text-[#3b82f6] disabled:opacity-50 transition-colors"
        >
          {uploadState.status === 'loading' ? 'Procesando...' : 'Seleccionar archivo'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {uploadState.status === 'error' && (
          <p className="mt-2 text-xs text-red-400">{uploadState.error}</p>
        )}

        {uploadState.status === 'success' && uploadState.parseResult && !uploadState.confirmedMapping && (
          <div className="mt-4">
            <ColumnMapper
              parseResult={uploadState.parseResult}
              onMappingConfirmed={handleMappingConfirmed}
            />
          </div>
        )}

        {uploadState.confirmedMapping && (
          <div className="mt-3 space-y-1">
            {Object.entries(uploadState.confirmedMapping).map(([orig, mapped]) => (
              <p key={orig} className="text-xs text-[#64748b]">
                <span className="font-mono text-[#e2e8f0]">{orig}</span>{' '}
                → <span className="text-[#3b82f6]">{mapped}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Merge button */}
      {allReady() && (
        <button
          onClick={mergeAndNotify}
          disabled={merging}
          className="w-full px-4 py-2.5 rounded-lg border border-[#00ff88]/30 text-[#00ff88] text-sm font-medium hover:bg-[#00ff88]/5 disabled:opacity-50 transition-colors"
        >
          {merging ? 'Unificando datos...' : 'Unificar fuentes de datos'}
        </button>
      )}
    </div>
  )
}
