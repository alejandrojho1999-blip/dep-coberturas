'use client'

import { useState } from 'react'

interface Signal {
  ticker: string
  name: string
  direction: string
  magnitude: string
  regime_changed: boolean
  current_value: number | null
  quarterly_change: number | null
  zscore_change: number | null
  last_date: string
  treatment_var: string
}

interface SignalsResponse {
  signals: Signal[]
  message?: string
}

const directionColor: Record<string, string> = {
  BULLISH:    'text-positive',
  BEARISH:    'text-negative',
  NEUTRAL:    'text-text-primary',
  'SIN DATOS': 'text-text-muted',
}

const magnitudeBadge: Record<string, string> = {
  HIGH:   'bg-accent/10 text-positive border border-accent/20',
  MEDIUM: 'bg-accent/10 text-text-primary border border-accent/20',
  LOW:    'bg-surface-hover/10 text-text-secondary border border-border/30',
  'N/A':  'bg-transparent text-text-muted',
}

export default function SignalsTable() {
  const [data, setData] = useState<SignalsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSignals() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ergos-quant/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v: number | null, decimals = 3) =>
    v == null ? '—' : v.toFixed(decimals)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Señales macroeconómicas de cambio de régimen por activo
        </p>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-semibold font-mono rounded border border-accent/30 text-positive hover:bg-accent-hover/10 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Calculando…' : 'Calcular señales'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">
          {error}
        </div>
      )}

      {data?.message && !data.signals.length && (
        <div className="rounded border border-border/30 bg-surface px-4 py-6 text-center text-sm text-text-muted">
          {data.message} — configura activos en el backend.
        </div>
      )}

      {data?.signals && data.signals.length > 0 && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-text-muted">
                {['Ticker', 'Nombre', 'Tratamiento', 'Dirección', 'Magnitud', 'Valor', 'ΔTrimestral', 'Z-score', 'Régimen', 'Fecha'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.signals.map((s, i) => (
                <tr
                  key={s.ticker}
                  className={[
                    'border-b border-border transition-colors hover:bg-surface',
                    i % 2 === 0 ? '' : 'bg-background',
                  ].join(' ')}
                >
                  <td className="px-3 py-2 font-bold text-text-primary">{s.ticker}</td>
                  <td className="px-3 py-2 text-text-secondary">{s.name}</td>
                  <td className="px-3 py-2 text-text-muted">{s.treatment_var}</td>
                  <td className={`px-3 py-2 font-bold ${directionColor[s.direction] ?? 'text-text-secondary'}`}>
                    {s.direction}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${magnitudeBadge[s.magnitude] ?? ''}`}>
                      {s.magnitude}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-primary">{fmt(s.current_value)}</td>
                  <td className="px-3 py-2 text-text-primary">{fmt(s.quarterly_change)}</td>
                  <td className="px-3 py-2 text-text-secondary">{fmt(s.zscore_change, 2)}</td>
                  <td className="px-3 py-2">
                    {s.regime_changed ? (
                      <span className="rounded bg-negative/10 px-2 py-0.5 text-[10px] font-bold text-negative border border-negative/20">
                        CAMBIO
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{s.last_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data && !loading && (
        <div className="rounded border border-border bg-background px-4 py-12 text-center">
          <p className="text-sm text-text-muted">Presiona &quot;Calcular señales&quot; para obtener los datos</p>
        </div>
      )}
    </div>
  )
}
