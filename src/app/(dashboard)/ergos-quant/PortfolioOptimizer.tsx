'use client'

import { useState } from 'react'

const STRATEGIES = [
  { value: 'hrp',       label: 'HRP — Hierarchical Risk Parity' },
  { value: 'ra-hrp',    label: 'RA-HRP — Risk-Adjusted HRP' },
  { value: 'herc',      label: 'HERC — Hierarchical ERC' },
  { value: 'markowitz', label: 'Markowitz — Max Sharpe' },
]

const COV_METHODS = [
  { value: 'ledoit', label: 'Ledoit-Wolf' },
  { value: 'sample', label: 'Muestral' },
  { value: 'ewma',   label: 'EWMA' },
  { value: 'gerber', label: 'Gerber + MAD' },
]

interface PortfolioResult {
  weights?: Record<string, number>
  metrics?: {
    Sharpe?: number
    Sortino?: number
    'Max DD'?: number
    SSPW?: number
  }
  error?: string
  [key: string]: unknown
}

export default function PortfolioOptimizer() {
  const [tickers, setTickers] = useState('AAPL,MSFT,GOOGL,AMZN,META')
  const [startDate, setStartDate] = useState('2020-01-01')
  const [strategy, setStrategy] = useState('hrp')
  const [covariance, setCovariance] = useState('ledoit')
  const [result, setResult] = useState<PortfolioResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runOptimization() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ergos-quant/portfolio/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: tickers.split(',').map((t) => t.trim()).filter(Boolean),
          start_date: startDate,
          strategy,
          covariance,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      setResult(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const weights = result?.weights ?? {}
  const metrics = result?.metrics ?? {}
  const totalWeight = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0)

  const fmtPct = (v: number | undefined) =>
    v == null ? '—' : `${(v * 100).toFixed(1)}%`
  const fmtNum = (v: number | undefined, d = 3) =>
    v == null ? '—' : v.toFixed(d)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#475569] font-mono tracking-wide">
            TICKERS (separados por coma)
          </label>
          <input
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            className="w-full rounded border border-[#1e293b] bg-[#060d1a] px-3 py-2 text-xs font-mono text-[#e2e8f0] focus:border-[#00ff88]/40 focus:outline-none"
            placeholder="AAPL,MSFT,GOOGL"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#475569] font-mono tracking-wide">
            FECHA INICIO
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border border-[#1e293b] bg-[#060d1a] px-3 py-2 text-xs font-mono text-[#e2e8f0] focus:border-[#00ff88]/40 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#475569] font-mono tracking-wide">
            ESTRATEGIA
          </label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full rounded border border-[#1e293b] bg-[#060d1a] px-3 py-2 text-xs font-mono text-[#e2e8f0] focus:border-[#00ff88]/40 focus:outline-none"
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#475569] font-mono tracking-wide">
            COVARIANZA
          </label>
          <select
            value={covariance}
            onChange={(e) => setCovariance(e.target.value)}
            className="w-full rounded border border-[#1e293b] bg-[#060d1a] px-3 py-2 text-xs font-mono text-[#e2e8f0] focus:border-[#00ff88]/40 focus:outline-none"
          >
            {COV_METHODS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={runOptimization}
        disabled={loading}
        className="px-5 py-2 text-xs font-bold font-mono rounded border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10 disabled:opacity-40 transition-colors"
      >
        {loading ? 'Optimizando…' : 'Optimizar portfolio'}
      </button>

      {error && (
        <div className="rounded border border-[#ff4444]/30 bg-[#ff4444]/5 px-4 py-3 text-sm text-[#ff4444]">
          {error}
        </div>
      )}

      {result && Object.keys(weights).length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Weights table */}
          <div className="rounded border border-[#1e293b] overflow-hidden">
            <div className="border-b border-[#1e293b] px-4 py-2 text-xs font-bold font-mono text-[#475569] tracking-widest">
              PESOS ÓPTIMOS
            </div>
            <table className="w-full text-xs font-mono">
              <tbody>
                {Object.entries(weights)
                  .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
                  .map(([ticker, w]) => (
                    <tr key={ticker} className="border-b border-[#1e293b] last:border-0 hover:bg-[#060d1a]">
                      <td className="px-4 py-2 font-bold text-[#e2e8f0]">{ticker}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 rounded-full bg-[#00ff88]"
                            style={{ width: `${((w ?? 0) / (totalWeight || 1)) * 120}px` }}
                          />
                          <span className="text-[#00ff88] font-bold">{fmtPct(w)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Metrics */}
          <div className="rounded border border-[#1e293b] overflow-hidden">
            <div className="border-b border-[#1e293b] px-4 py-2 text-xs font-bold font-mono text-[#475569] tracking-widest">
              MÉTRICAS
            </div>
            <div className="grid grid-cols-2 gap-px bg-[#1e293b] p-px">
              {[
                { label: 'Sharpe',   value: fmtNum(metrics.Sharpe, 3) },
                { label: 'Sortino',  value: fmtNum(metrics.Sortino, 3) },
                { label: 'Max DD',   value: fmtPct(metrics['Max DD']) },
                { label: 'SSPW',     value: fmtNum(metrics.SSPW, 4) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#060d1a] px-4 py-4">
                  <p className="text-[10px] font-semibold font-mono tracking-widest text-[#475569]">{label}</p>
                  <p className="mt-1 text-xl font-bold font-mono text-[#e2e8f0]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="rounded border border-[#1e293b] bg-[#060d1a] px-4 py-12 text-center">
          <p className="text-sm text-[#475569]">
            Ingresa los tickers, elige la estrategia y presiona &quot;Optimizar portfolio&quot;
          </p>
        </div>
      )}
    </div>
  )
}
