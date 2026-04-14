'use client'

import { useState } from 'react'
import type { PricingResult } from '@/lib/options/types'

interface Props {
  onResult: (result: PricingResult) => void
}

interface FormValues {
  type: 'call' | 'put'
  S: string
  K: string
  T: string
  r: string
  sigma: string
}

const DEFAULTS: FormValues = {
  type: 'call',
  S: '185',
  K: '190',
  T: '0.25',
  r: '0.053',
  sigma: '0.28',
}

function parsePositiveNumber(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

export default function OptionsPricer({ onResult }: Props) {
  const [form, setForm] = useState<FormValues>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isValid(): boolean {
    const S = parsePositiveNumber(form.S)
    const K = parsePositiveNumber(form.K)
    const T = parsePositiveNumber(form.T)
    const r = parsePositiveNumber(form.r)
    const sigma = parsePositiveNumber(form.sigma)
    return (
      S !== null && S > 0 &&
      K !== null && K > 0 &&
      T !== null && T >= 0 &&
      r !== null &&
      sigma !== null && sigma >= 0
    )
  }

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/options/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          S: parseFloat(form.S),
          K: parseFloat(form.K),
          T: parseFloat(form.T),
          r: parseFloat(form.r),
          sigma: parseFloat(form.sigma),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json() as PricingResult
      onResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6] transition-colors'
  const labelClass = 'block text-xs font-medium text-[#64748b] mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Option type */}
      <div>
        <label className={labelClass}>Tipo</label>
        <div className="flex gap-2">
          {(['call', 'put'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setField('type', t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.type === t
                  ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]'
                  : 'border-[#1e1e2e] text-[#64748b] hover:text-[#e2e8f0] hover:border-[#3b82f6]'
              }`}
            >
              {t === 'call' ? 'Call' : 'Put'}
            </button>
          ))}
        </div>
      </div>

      {/* Numeric fields — 2 column grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Precio subyacente (S)
          </label>
          <input
            type="number"
            step="any"
            min="0.01"
            value={form.S}
            onChange={(e) => setField('S', e.target.value)}
            className={inputClass}
            placeholder="185"
          />
        </div>

        <div>
          <label className={labelClass}>
            Precio ejercicio (K)
          </label>
          <input
            type="number"
            step="any"
            min="0.01"
            value={form.K}
            onChange={(e) => setField('K', e.target.value)}
            className={inputClass}
            placeholder="190"
          />
        </div>

        <div>
          <label className={labelClass}>
            Vencimiento (T) <span className="text-[#475569]">en años</span>
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={form.T}
            onChange={(e) => setField('T', e.target.value)}
            className={inputClass}
            placeholder="0.25"
          />
        </div>

        <div>
          <label className={labelClass}>
            Tasa libre riesgo (r) <span className="text-[#475569]">ej. 0.053</span>
          </label>
          <input
            type="number"
            step="any"
            value={form.r}
            onChange={(e) => setField('r', e.target.value)}
            className={inputClass}
            placeholder="0.053"
          />
        </div>

        <div className="col-span-2">
          <label className={labelClass}>
            Volatilidad implícita (σ) <span className="text-[#475569]">ej. 0.28</span>
          </label>
          <input
            type="number"
            step="any"
            min="0"
            value={form.sigma}
            onChange={(e) => setField('sigma', e.target.value)}
            className={inputClass}
            placeholder="0.28"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={!isValid() || loading}
        className="w-full px-5 py-2.5 rounded-lg bg-[#00ff88] text-[#0a0a0f] text-sm font-semibold hover:bg-[#00ff88]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Calculando...' : 'Calcular'}
      </button>
    </form>
  )
}
