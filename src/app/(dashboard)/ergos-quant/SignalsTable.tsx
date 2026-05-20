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
  BULLISH:    'text-[#00ff88]',
  BEARISH:    'text-[#ff4444]',
  NEUTRAL:    'text-[#f59e0b]',
  'SIN DATOS': 'text-[#475569]',
}

const magnitudeBadge: Record<string, string> = {
  HIGH:   'bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20',
  MEDIUM: 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20',
  LOW:    'bg-[#475569]/10 text-[#94a3b8] border border-[#475569]/30',
  'N/A':  'bg-transparent text-[#475569]',
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
        <p className="text-sm text-[#94a3b8]">
          Señales macroeconómicas de cambio de régimen por activo
        </p>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-semibold font-mono rounded border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Calculando…' : 'Calcular señales'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-[#ff4444]/30 bg-[#ff4444]/5 px-4 py-3 text-sm text-[#ff4444]">
          {error}
        </div>
      )}

      {data?.message && !data.signals.length && (
        <div className="rounded border border-[#475569]/30 bg-[#0f1829] px-4 py-6 text-center text-sm text-[#475569]">
          {data.message} — configura activos en el backend.
        </div>
      )}

      {data?.signals && data.signals.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#1e293b]">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e293b] text-[#475569]">
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
                    'border-b border-[#1e293b] transition-colors hover:bg-[#0f1829]',
                    i % 2 === 0 ? '' : 'bg-[#060d1a]',
                  ].join(' ')}
                >
                  <td className="px-3 py-2 font-bold text-[#e2e8f0]">{s.ticker}</td>
                  <td className="px-3 py-2 text-[#94a3b8]">{s.name}</td>
                  <td className="px-3 py-2 text-[#475569]">{s.treatment_var}</td>
                  <td className={`px-3 py-2 font-bold ${directionColor[s.direction] ?? 'text-[#94a3b8]'}`}>
                    {s.direction}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${magnitudeBadge[s.magnitude] ?? ''}`}>
                      {s.magnitude}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#e2e8f0]">{fmt(s.current_value)}</td>
                  <td className="px-3 py-2 text-[#e2e8f0]">{fmt(s.quarterly_change)}</td>
                  <td className="px-3 py-2 text-[#94a3b8]">{fmt(s.zscore_change, 2)}</td>
                  <td className="px-3 py-2">
                    {s.regime_changed ? (
                      <span className="rounded bg-[#ff4444]/10 px-2 py-0.5 text-[10px] font-bold text-[#ff4444] border border-[#ff4444]/20">
                        CAMBIO
                      </span>
                    ) : (
                      <span className="text-[#475569]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#475569]">{s.last_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data && !loading && (
        <div className="rounded border border-[#1e293b] bg-[#060d1a] px-4 py-12 text-center">
          <p className="text-sm text-[#475569]">Presiona &quot;Calcular señales&quot; para obtener los datos</p>
        </div>
      )}
    </div>
  )
}
