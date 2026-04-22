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
  onApply: (confounders: string[], colliders: Record<string, string>) => void
}

export default function VariableSelector({ ticker, currentConfounders, currentColliders, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<SavedVariable[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(currentConfounders))
  const [excludedSelected, setExcludedSelected] = useState<Set<string>>(new Set(Object.keys(currentColliders)))

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

  const [excludedRationale, setExcludedRationale] = useState<Record<string, string>>(currentColliders)

  function handleApply() {
    const colliders: Record<string, string> = {}
    for (const v of excludedSelected) {
      colliders[v] = excludedRationale[v] ?? 'Colisionador seleccionado'
    }
    onApply(Array.from(selected), colliders)
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
          <div className="space-y-1">
            {savedConfounders.map((v) => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selected.has(v.variable)}
                  onChange={() => toggleConfounder(v.variable)}
                  className="accent-[#f59e0b]"
                />
                <span className="font-mono text-xs text-[#e2e8f0]">{v.variable}</span>
                {v.label && <span className="text-xs text-[#64748b]">{v.label}</span>}
                <span className={`text-[0.6rem] px-1 rounded ${v.source === 'auto' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#3b82f6]/10 text-[#3b82f6]'}`}>
                  {v.source}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {savedColliders.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#ef4444]">⛔ Colisionadores guardados</p>
          <div className="space-y-1">
            {savedColliders.map((v) => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludedSelected.has(v.variable)}
                  onChange={() => toggleCollider(v.variable, v.rationale ?? 'Colisionador')}
                  className="accent-[#ef4444]"
                />
                <span className="font-mono text-xs text-[#e2e8f0]">{v.variable}</span>
                {v.rationale && <span className="text-xs text-[#64748b] truncate">{v.rationale}</span>}
                <span className={`text-[0.6rem] px-1 rounded ${v.source === 'auto' ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#3b82f6]/10 text-[#3b82f6]'}`}>
                  {v.source}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {(savedConfounders.length > 0 || savedColliders.length > 0) && (
        <button
          type="button"
          onClick={handleApply}
          className="w-full px-3 py-2 rounded-lg bg-[#3b82f6]/20 text-[#3b82f6] text-xs font-semibold hover:bg-[#3b82f6]/30 cursor-pointer transition-colors"
        >
          Aplicar selección al análisis
        </button>
      )}
    </div>
  )
}
