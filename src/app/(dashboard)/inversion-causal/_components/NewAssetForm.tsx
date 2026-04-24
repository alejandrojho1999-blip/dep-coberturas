'use client'

import { useState, useRef, useEffect } from 'react'
import { buildCausalConfig } from '@/lib/causal/config'
import type { CausalConfig } from '@/lib/causal/types'

interface CreatedAsset {
  id: string
  ticker: string
  config: CausalConfig
  last_run_at: string | null
  last_score: number | null
  last_signal: string | null
}

interface Props {
  onCreated: (asset: CreatedAsset) => void
  onCancel: () => void
}

interface SearchResult {
  symbol: string
  name: string
  exchange: string
}

interface ExtractedVar {
  variable: string
  label: string
  rationale: string
  source: 'auto' | 'manual'
}

interface IRInfo {
  irUrl: string
  companyName: string
  sector: string
  website: string
  treatment?: string
  treatmentLabel?: string
  rationale?: string
}

type IRStatus = 'idle' | 'discovering' | 'extracting' | 'done' | 'error'

export default function NewAssetForm({ onCreated, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [selectedTicker, setSelectedTicker] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [irInfo, setIrInfo] = useState<IRInfo | null>(null)
  const [irStatus, setIrStatus] = useState<IRStatus>('idle')
  const [confounders, setConfounders] = useState<ExtractedVar[]>([])
  const [colliders, setColliders] = useState<ExtractedVar[]>([])
  const [newConfounder, setNewConfounder] = useState('')
  const [newColliderVar, setNewColliderVar] = useState('')
  const [savedSuggestions, setSavedSuggestions] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load cross-ticker suggestions for confounders
  useEffect(() => {
    fetch('/api/causal/variables?type=confounder')
      .then((r) => r.json())
      .then((d: { variables?: { variable: string }[] }) => {
        const unique = Array.from(new Set((d.variables ?? []).map((v) => v.variable)))
        setSavedSuggestions(unique)
      })
      .catch(() => {})
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    setSelectedTicker('')
    setSelectedName('')
    setIrInfo(null)
    setIrStatus('idle')
    setError(null)
    setConfounders([])
    setColliders([])

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/causal/search?q=${encodeURIComponent(value.trim())}`)
        if (!res.ok) { setSuggestions([]); setShowDropdown(true); return }
        const data = await res.json() as { results?: SearchResult[] }
        setSuggestions(data.results ?? [])
        setShowDropdown(true)
      } catch {
        setSuggestions([])
        setShowDropdown(true)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleSelect = async (result: SearchResult) => {
    setSelectedTicker(result.symbol)
    setSelectedName(result.name)
    setQuery(`${result.symbol} — ${result.name}`)
    setShowDropdown(false)
    setSuggestions([])
    setIrInfo(null)
    setIrStatus('discovering')
    setConfounders([])
    setColliders([])

    try {
      const discoverRes = await fetch(`/api/causal/ir-discover?ticker=${result.symbol}`)
      if (!discoverRes.ok) { setIrStatus('error'); return }
      const discovered = await discoverRes.json() as IRInfo
      setIrStatus('extracting')

      const extractRes = await fetch('/api/causal/ir-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ irUrl: discovered.irUrl, ticker: result.symbol, sector: discovered.sector }),
      })
      const extracted = await extractRes.json() as {
        treatment: string
        label: string
        rationale: string
        irContent: string
        confounders?: { variable: string; label: string; rationale: string }[]
        colliders?: { variable: string; label: string; rationale: string }[]
      }

      setIrInfo({ ...discovered, treatment: extracted.treatment, treatmentLabel: extracted.label, rationale: extracted.rationale })
      setConfounders((extracted.confounders ?? []).map((c) => ({ ...c, source: 'auto' as const })))
      setColliders((extracted.colliders ?? []).map((c) => ({ ...c, source: 'auto' as const })))
      setIrStatus('done')
    } catch {
      setIrStatus('error')
      setConfounders([
        { variable: 'YIELD_10Y', label: 'Tasa bono 10Y EEUU', rationale: 'Macro que afecta valuación DCF', source: 'auto' },
        { variable: 'FED_RATE',  label: 'Tasa de política Fed', rationale: 'Costo del capital afecta múltiplos', source: 'auto' },
        { variable: 'VIX',       label: 'Índice de volatilidad VIX', rationale: 'Sentimiento de mercado', source: 'auto' },
      ])
      setColliders([
        { variable: 'PE_RATIO', label: 'P/E ratio', rationale: 'Endógeno al precio de mercado', source: 'auto' },
      ])
    }
  }

  function addConfounder() {
    const v = newConfounder.trim().toUpperCase()
    if (!v || confounders.some((c) => c.variable === v)) return
    setConfounders((prev) => [...prev, { variable: v, label: v, rationale: 'Añadido manualmente', source: 'manual' }])
    setNewConfounder('')
  }

  function removeConfounder(variable: string) {
    setConfounders((prev) => prev.filter((c) => c.variable !== variable))
  }

  function addCollider() {
    const v = newColliderVar.trim().toUpperCase()
    if (!v || colliders.some((c) => c.variable === v)) return
    setColliders((prev) => [...prev, { variable: v, label: v, rationale: 'Añadido manualmente', source: 'manual' }])
    setNewColliderVar('')
  }

  function removeCollider(variable: string) {
    setColliders((prev) => prev.filter((c) => c.variable !== variable))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicker || !selectedName) return
    setLoading(true)
    setError(null)

    const treatment = irInfo?.treatment ?? 'Revenue_Growth'
    const sector = irInfo?.sector ?? 'Unknown'
    const collidersRecord: Record<string, string> = Object.fromEntries(
      colliders.map((c) => [c.variable, c.rationale])
    )
    const config: CausalConfig = buildCausalConfig(
      selectedTicker, selectedName, sector, treatment,
      confounders.map((c) => c.variable),
      collidersRecord,
    )

    // Save manual variables to DB
    await Promise.allSettled([
      ...confounders.filter((c) => c.source === 'manual').map((c) =>
        fetch('/api/causal/variables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: selectedTicker, variable: c.variable, type: 'confounder', source: 'manual', label: c.label, rationale: c.rationale }),
        })
      ),
      ...colliders.filter((c) => c.source === 'manual').map((c) =>
        fetch('/api/causal/variables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: selectedTicker, variable: c.variable, type: 'collider', source: 'manual', label: c.label, rationale: c.rationale }),
        })
      ),
    ])

    try {
      const res = await fetch('/api/causal/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: selectedTicker, name: selectedName, config, ir_url: irInfo?.irUrl, treatment, sector }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Error al crear el activo')
      }
      const data = await res.json() as { asset: CreatedAsset }
      onCreated(data.asset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el activo')
    } finally {
      setLoading(false)
    }
  }

  const suggestionsForConfounder = savedSuggestions.filter(
    (s) => s.toLowerCase().includes(newConfounder.toLowerCase()) && !confounders.some((c) => c.variable === s)
  ).slice(0, 4)

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 max-w-xl space-y-4">
      <div>
        <h3 className="text-sm font-medium text-[#e2e8f0]">Nuevo activo causal</h3>
        <p className="text-xs text-[#64748b] mt-1">
          Busca un ticker — detectamos automáticamente la página IR, tratamiento causal y confusores.
        </p>
      </div>

      {/* Ticker search */}
      <div style={{ position: 'relative' }}>
        <label htmlFor="new-asset-search" className="text-xs text-[#64748b] block mb-1">Buscar activo</label>
        <input
          id="new-asset-search"
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Buscar ticker o empresa..."
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-sm placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
        {searching && <span className="absolute right-3 top-8 text-xs text-[#64748b]">Buscando...</span>}
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] shadow-xl overflow-hidden">
            {suggestions.length === 0
              ? <p className="px-3 py-2 text-sm text-[#64748b]">Sin resultados</p>
              : suggestions.map((result) => (
                <button key={result.symbol} type="button" onClick={() => handleSelect(result)}
                  className="w-full px-3 py-2 text-left hover:bg-[#1e1e2e] transition-colors flex items-center gap-2 cursor-pointer">
                  <span className="text-sm font-mono text-[#00ff88] shrink-0">{result.symbol}</span>
                  <span className="text-sm text-[#e2e8f0] truncate">{result.name}</span>
                  {result.exchange && <span className="text-xs text-[#64748b] shrink-0 ml-auto">{result.exchange}</span>}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* IR discovery status */}
      {(irStatus === 'discovering' || irStatus === 'extracting') && (
        <div className="flex items-center gap-2 text-xs text-[#64748b] bg-[#0a0a0f] px-3 py-2 rounded-lg border border-[#1e1e2e]">
          <span className="animate-spin inline-block">⟳</span>
          {irStatus === 'discovering' ? 'Detectando página Investor Relations...' : 'Identificando variables causales con IA...'}
        </div>
      )}

      {/* Treatment summary — only when IR succeeded */}
      {irStatus === 'done' && irInfo && (
        <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[#00ff88] text-xs">✓ Tratamiento identificado</span>
            <span className="ml-auto text-xs text-[#64748b]">{irInfo.sector}</span>
          </div>
          <div className="font-mono text-sm text-[#3b82f6]">{irInfo.treatment}</div>
          <div className="text-xs text-[#64748b]">{irInfo.treatmentLabel}</div>
          {irInfo.rationale && (
            <div className="text-xs text-[#64748b] italic border-t border-[#1e1e2e] pt-2">{irInfo.rationale}</div>
          )}
        </div>
      )}

      {irStatus === 'error' && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg">
          No se pudo detectar IR automáticamente. Se usarán confusores macro por defecto.
        </div>
      )}

      {/* Confounders + Colliders — shown on success OR error (always editable) */}
      {(irStatus === 'done' || irStatus === 'error') && (
        <div className="space-y-4">
          {/* Confounders */}
          <div className="bg-[#0a0a0f] border border-[#f59e0b]/30 rounded-lg px-3 py-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">🌀</span>
              <span className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wide">Confusores</span>
              <span className="text-xs text-[#64748b] ml-1">— variables a controlar</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {confounders.map((c) => (
                <span key={c.variable} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                  <span title={c.rationale} className="font-mono">{c.variable}</span>
                  {c.source === 'auto'
                    ? <span className="text-[0.6rem] opacity-60">auto</span>
                    : <span className="text-[0.6rem] opacity-60">manual</span>}
                  <button type="button" onClick={() => removeConfounder(c.variable)}
                    className="ml-0.5 opacity-50 hover:opacity-100 cursor-pointer leading-none">✕</button>
                </span>
              ))}
            </div>
            {/* Add confounder input */}
            <div style={{ position: 'relative' }}>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newConfounder}
                  onChange={(e) => setNewConfounder(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addConfounder() } }}
                  placeholder="+ Añadir confusor (ej: YIELD_10Y)"
                  className="flex-1 px-2 py-1.5 rounded-lg bg-[#12121a] border border-[#1e1e2e] text-xs text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
                <button type="button" onClick={addConfounder}
                  className="px-2 py-1.5 rounded-lg bg-[#f59e0b]/20 text-[#f59e0b] text-xs hover:bg-[#f59e0b]/30 cursor-pointer transition-colors">
                  +
                </button>
              </div>
              {newConfounder.length > 0 && suggestionsForConfounder.length > 0 && (
                <div className="absolute z-10 w-full mt-1 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] shadow-xl overflow-hidden">
                  {suggestionsForConfounder.map((s) => (
                    <button key={s} type="button"
                      onClick={() => { setNewConfounder(s); addConfounder() }}
                      className="w-full px-3 py-1.5 text-left text-xs text-[#64748b] hover:bg-[#1e1e2e] hover:text-[#e2e8f0] cursor-pointer transition-colors font-mono">
                      {s} <span className="text-[0.6rem] opacity-50 ml-1">guardado anteriormente</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Colliders */}
          <div className="bg-[#0a0a0f] border border-[#ef4444]/30 rounded-lg px-3 py-3 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">⛔</span>
              <span className="text-xs font-semibold text-[#ef4444] uppercase tracking-wide">Colisionadores</span>
              <span className="text-xs text-[#64748b] ml-1">— variables a excluir</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {colliders.map((c) => (
                <span key={c.variable} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20">
                  <span title={c.rationale} className="font-mono">{c.variable}</span>
                  {c.source === 'auto'
                    ? <span className="text-[0.6rem] opacity-60">auto</span>
                    : <span className="text-[0.6rem] opacity-60">manual</span>}
                  <button type="button" onClick={() => removeCollider(c.variable)}
                    className="ml-0.5 opacity-50 hover:opacity-100 cursor-pointer leading-none">✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newColliderVar}
                onChange={(e) => setNewColliderVar(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCollider() } }}
                placeholder="Variable (ej: PE_RATIO)"
                className="flex-1 px-2 py-1.5 rounded-lg bg-[#12121a] border border-[#1e1e2e] text-xs text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#ef4444] transition-colors"
              />
              <button type="button" onClick={addCollider}
                className="px-2 py-1.5 rounded-lg bg-[#ef4444]/20 text-[#ef4444] text-xs hover:bg-[#ef4444]/30 cursor-pointer transition-colors">
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!selectedTicker || !selectedName || loading || irStatus === 'discovering' || irStatus === 'extracting'}
          className="px-4 py-2 rounded-lg bg-[#00ff88] text-[#0a0a0f] text-sm font-semibold hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {loading ? 'Creando...' : 'Crear activo'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[#1e1e2e] text-[#64748b] text-sm hover:text-[#e2e8f0] cursor-pointer transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
