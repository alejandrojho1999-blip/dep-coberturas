'use client'

import { useState } from 'react'
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

export default function NewAssetForm({ onCreated, onCancel }: Props) {
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = ticker.trim().toUpperCase()
    const n = name.trim()
    if (!t || !n) return

    setLoading(true)
    setError(null)

    try {
      const config: CausalConfig = { ...AAPL_DEFAULT_CONFIG, ticker: t, name: n }

      const res = await fetch('/api/causal/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: t, config }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const body = await res.json() as { asset: CreatedAsset }
      onCreated(body.asset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando activo')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = ticker.trim().length > 0 && name.trim().length > 0 && !loading

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 max-w-sm space-y-4"
    >
      <div>
        <h3 className="text-sm font-medium text-[#e2e8f0]">Nuevo activo causal</h3>
        <p className="text-xs text-[#64748b] mt-1">
          Usa la configuración de AAPL como plantilla. Puedes ajustar el DAG después.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="new-asset-ticker" className="text-xs text-[#64748b]">Ticker</label>
        <input
          id="new-asset-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="MSFT"
          required
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-sm font-mono placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="new-asset-name" className="text-xs text-[#64748b]">Nombre</label>
        <input
          id="new-asset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Microsoft Corporation"
          required
          className="w-full px-3 py-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] text-[#e2e8f0] text-sm placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
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
