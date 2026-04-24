'use client'

import { useState, useEffect } from 'react'

interface SavedVariable {
  id: string
  ticker: string
  variable: string
  type: 'confounder' | 'collider'
  source: 'auto' | 'manual'
  label: string | null
  rationale: string | null
}

interface Props {
  ticker: string
  currentConfounders: string[]
  currentColliders: Record<string, string>
  currentManualValues?: Record<string, number>
  assetId?: string
  onApply: (confounders: string[], colliders: Record<string, string>, manualValues: Record<string, number>) => void
}

const FRED_VARS = new Set(['FED_RATE', 'YIELD_10Y', 'VIX'])

export default function VariableSelector({
  ticker,
  currentConfounders,
  currentColliders,
  currentManualValues,
  assetId,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<SavedVariable[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(currentConfounders))
  const [excludedSelected, setExcludedSelected] = useState<Set<string>>(new Set(Object.keys(currentColliders)))
  const [excludedRationale, setExcludedRationale] = useState<Record<string, string>>(currentColliders)
  const [manualValues, setManualValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const [k, v] of Object.entries(currentManualValues ?? {})) {
      init[k] = String(v)
    }
    return init
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/causal/variables?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d: { variables?: SavedVariable[] }) => setSaved(d.variables ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, ticker])

  const savedConfounders = saved.filter((v) => v.type === 'confounder')
  const savedColliders = saved.filter((v) => v.type === 'collider')

  function toggleConfounder(variable: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(variable)) next.delete(variable)
      else next.add(variable)
      return next
    })
  }

  function toggleCollider(variable: string, rationale: string) {
    setExcludedSelected((prev) => {
      const next = new Set(prev)
      if (next.has(variable)) {
        next.delete(variable)
      } else {
        next.add(variable)
        setExcludedRationale((r) => ({ ...r, [variable]: rationale }))
      }
      return next
    })
  }

  function setVarValue(variable: string, value: string) {
    setManualValues((prev) => ({ ...prev, [variable]: value }))
  }

  async function handleApply() {
    const colliders: Record<string, string> = {}
    for (const v of excludedSelected) {
      colliders[v] = excludedRationale[v] ?? 'Colisionador seleccionado'
    }

    const parsed: Record<string, number> = {}
    for (const [k, v] of Object.entries(manualValues)) {
      const num = parseFloat(v)
      if (!isNaN(num) && isFinite(num)) parsed[k] = num
    }

    if (assetId && Object.keys(parsed).length > 0) {
      try {
        await fetch('/api/causal/assets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: assetId, manualValues: parsed }),
        })
      } catch {
        // silent fail
      }
    }

    onApply(Array.from(selected), colliders, parsed)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[#64748b] hover:text-[#e2e8f0] border border-[#1e1e2e] px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
      >
        Variables guardadas ({ticker})
      </button>
    )
  }

  function renderValueInput(variable: string) {
    if (FRED_VARS.has(variable)) return null
    return (
      <input
        type="text"
        value={manualValues[variable] ?? ''}
        onChange={(e) => setVarValue(variable, e.target.value)}
        placeholder="valor"
        className="ml-auto w-20 px-2 py-0.5 rounded bg-[#12121a] border border-[#1e1e2e] text-[#e2e8f0] text-right text-xs focus:outline-none focus:border-[#3b82f6] placeholder-[#334155]"
      />
    )
  }

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a0f] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#e2e8f0]">Variables guardadas — {ticker}</span>
        <button type="button" onClick={() => setOpen(false)}
          className="text-[#64748b] hover:text-[#e2e8f0] text-sm cursor-pointer">✕</button>
      </div>

      {loading && <p className="text-xs text-[#64748b] animate-pulse">Cargando...</p>}

      {!loading && savedConfounders.length === 0 && savedColliders.length === 0 && (
        <p className="text-xs text-[#64748b]">No hay variables guardadas para {ticker}.</p>
      )}

      {savedConfounders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#f59e0b]">🌀 Confusores guardados</p>
          <div className="space-y-2">
            {savedConfounders.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(v.variable)}
                  onChange={() => toggleConfounder(v.variable)}
                  className="accent-[#f59e0b] shrink-0"
                />
                <span className="font-mono text-xs text-[#e2e8f0] shrink-0">{v.variable}</span>
                {v.label && <span className="text-xs text-[#64748b] truncate">{v.label}</span>}
                <span className={`text-[0.6rem] px-1 rounded shrink-0 ${v.source === 'auto' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#3b82f6]/10 text-[#3b82f6]'}`}>
                  {v.source}
                </span>
                {renderValueInput(v.variable)}
              </div>
            ))}
          </div>
          {savedConfounders.some((v) => !FRED_VARS.has(v.variable)) && (
            <p className="text-[0.65rem] text-[#475569]">Ingresa el valor para las variables no disponibles en FRED/Yahoo</p>
          )}
        </div>
      )}

      {savedColliders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#ef4444]">⛔ Colisionadores guardados</p>
          <div className="space-y-2">
            {savedColliders.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={excludedSelected.has(v.variable)}
                  onChange={() => toggleCollider(v.variable, v.rationale ?? 'Colisionador')}
                  className="accent-[#ef4444] shrink-0"
                />
                <span className="font-mono text-xs text-[#e2e8f0] shrink-0">{v.variable}</span>
                {v.rationale && <span className="text-xs text-[#64748b] truncate">{v.rationale}</span>}
                <span className={`text-[0.6rem] px-1 rounded shrink-0 ${v.source === 'auto' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#3b82f6]/10 text-[#3b82f6]'}`}>
                  {v.source}
                </span>
                {renderValueInput(v.variable)}
              </div>
            ))}
          </div>
          {savedColliders.some((v) => !FRED_VARS.has(v.variable)) && (
            <p className="text-[0.65rem] text-[#475569]">Ingresa el valor para las variables no disponibles en FRED/Yahoo</p>
          )}
        </div>
      )}

      {(savedConfounders.length > 0 || savedColliders.length > 0) && (
        <button
          type="button"
          onClick={() => void handleApply()}
          className="w-full px-3 py-2 rounded-lg bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-semibold hover:bg-[#3b82f6]/30 cursor-pointer transition-colors"
        >
          Aplicar selección al análisis
        </button>
      )}
    </div>
  )
}
