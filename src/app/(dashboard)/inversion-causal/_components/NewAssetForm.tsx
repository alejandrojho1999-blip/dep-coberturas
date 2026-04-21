'use client'

import { useState, useRef } from 'react'
import { AAPL_DEFAULT_CONFIG } from '@/lib/causal/dag'
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInputChange = (value: string) => {
    setQuery(value)
    setSelectedTicker('')
    setSelectedName('')
    setIrInfo(null)
    setIrStatus('idle')
    setError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }

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

    try {
      // Step 1: discover IR page
      const discoverRes = await fetch(`/api/causal/ir-discover?ticker=${result.symbol}`)
      if (!discoverRes.ok) { setIrStatus('error'); return }
      const discovered = await discoverRes.json() as IRInfo
      setIrStatus('extracting')

      // Step 2: extract treatment
      const extractRes = await fetch('/api/causal/ir-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          irUrl: discovered.irUrl,
          ticker: result.symbol,
          sector: discovered.sector,
        }),
      })
      const extracted = await extractRes.json() as {
        treatment: string
        label: string
        rationale: string
        irContent: string
      }

      setIrInfo({
        ...discovered,
        treatment: extracted.treatment,
        treatmentLabel: extracted.label,
        rationale: extracted.rationale,
      })
      setIrStatus('done')
    } catch {
      setIrStatus('error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicker || !selectedName) return

    setLoading(true)
    setError(null)

    const treatment = irInfo?.treatment ?? AAPL_DEFAULT_CONFIG.treatment
    const config: CausalConfig = {
      ...AAPL_DEFAULT_CONFIG,
      ticker: selectedTicker,
      name: selectedName,
      treatment,
    }

    try {
      const res = await fetch('/api/causal/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: selectedTicker,
          name: selectedName,
          config,
          ir_url: irInfo?.irUrl,
          treatment,
          sector: irInfo?.sector,
        }),
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 max-w-sm space-y-4"
    >
      <div>
        <h3 className="text-sm font-medium text-[#e2e8f0]">Nuevo activo causal</h3>
        <p className="text-xs text-[#64748b] mt-1">
          Busca un ticker — detectamos automáticamente la página IR y el tratamiento causal.
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <label htmlFor="new-asset-search" className="text-xs text-[#64748b] block mb-1">
          Buscar activo
        </label>
        <input
          id="new-asset-search"
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Buscar ticker o empresa..."
          autoComplete="off"
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-sm placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
        {searching && (
          <span className="absolute right-3 top-8 text-xs text-[#64748b]">Buscando...</span>
        )}
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] shadow-xl overflow-hidden">
            {suggestions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-[#64748b]">Sin resultados</p>
            ) : (
              suggestions.map((result) => (
                <button
                  key={result.symbol}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="w-full px-3 py-2 text-left hover:bg-[#1e1e2e] transition-colors flex items-center gap-2"
                >
                  <span className="text-sm font-mono text-[#00ff88] shrink-0">{result.symbol}</span>
                  <span className="text-sm text-[#e2e8f0] truncate">{result.name}</span>
                  {result.exchange && (
                    <span className="text-xs text-[#64748b] shrink-0 ml-auto">{result.exchange}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* IR discovery status */}
      {irStatus === 'discovering' && (
        <div className="flex items-center gap-2 text-xs text-[#64748b] bg-[#0a0a0f] px-3 py-2 rounded-lg border border-[#1e1e2e]">
          <span className="animate-spin">⟳</span>
          Detectando página Investor Relations...
        </div>
      )}
      {irStatus === 'extracting' && (
        <div className="flex items-center gap-2 text-xs text-[#64748b] bg-[#0a0a0f] px-3 py-2 rounded-lg border border-[#1e1e2e]">
          <span className="animate-spin">⟳</span>
          Identificando variable de tratamiento con IA...
        </div>
      )}
      {irStatus === 'done' && irInfo && (
        <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[#00ff88] text-xs">✓ Tratamiento identificado</span>
            <span className="ml-auto text-xs text-[#64748b]">{irInfo.sector}</span>
          </div>
          <div className="font-mono text-sm text-[#3b82f6]">{irInfo.treatment}</div>
          <div className="text-xs text-[#64748b]">{irInfo.treatmentLabel}</div>
          {irInfo.rationale && (
            <div className="text-xs text-[#64748b] italic border-t border-[#1e1e2e] pt-2">
              {irInfo.rationale}
            </div>
          )}
          {irInfo.irUrl && !irInfo.irUrl.includes('google.com') && (
            <a
              href={irInfo.irUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#64748b] hover:text-[#3b82f6] underline block truncate"
            >
              {irInfo.irUrl}
            </a>
          )}
        </div>
      )}
      {irStatus === 'error' && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-lg">
          No se pudo detectar IR automáticamente. Se usará Revenue_Growth por defecto.
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!selectedTicker || !selectedName || loading || irStatus === 'discovering' || irStatus === 'extracting'}
          className="px-4 py-2 rounded-lg bg-[#00ff88] text-[#0a0a0f] text-sm font-semibold hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creando...' : 'Crear activo'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[#1e1e2e] text-[#64748b] text-sm hover:text-[#e2e8f0] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
