'use client'

import { useState } from 'react'
import { Search, TrendingUp, AlertCircle, Loader2, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import MaiaBiasPanel from './MaiaBiasPanel'
import type { CfdAnalysisResponse } from '@/app/api/cfds/analysis/route'

// ── Asset catalog ──────────────────────────────────────────────────────────────

const CFD_ASSETS = [
  { group: 'Índices',         symbol: '^GSPC',    label: 'S&P 500' },
  { group: 'Índices',         symbol: '^NDX',     label: 'NASDAQ 100' },
  { group: 'Índices',         symbol: '^DJI',     label: 'Dow Jones' },
  { group: 'Materias Primas', symbol: 'GC=F',     label: 'Gold (Oro)' },
  { group: 'Materias Primas', symbol: 'CL=F',     label: 'WTI Crude Oil' },
  { group: 'Cripto',          symbol: 'BTC-USD',  label: 'Bitcoin' },
  { group: 'Cripto',          symbol: 'ETH-USD',  label: 'Ethereum' },
  { group: 'Forex',           symbol: 'EURUSD=X', label: 'EUR/USD' },
  { group: 'Forex',           symbol: 'DX-Y.NYB', label: 'DXY (Dólar Index)' },
] as const

type AssetSymbol = typeof CFD_ASSETS[number]['symbol']

// ── Loading skeleton ────────────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border border-[#1e2035] p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="w-14 h-14 rounded-xl bg-[#1e2035]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24 bg-[#1e2035]" />
            <Skeleton className="h-5 w-40 bg-[#1e2035]" />
            <Skeleton className="h-2 w-full bg-[#1e2035]" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[#1e2035] overflow-hidden">
        <div className="px-4 py-2 bg-[#161622] border-b border-[#1e2035]">
          <Skeleton className="h-3 w-32 bg-[#1e2035]" />
        </div>
        <div className="px-4 py-2 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 border-b border-[#1e2035] last:border-0">
              <div className="space-y-1">
                <Skeleton className="h-3 w-28 bg-[#1e2035]" />
                <Skeleton className="h-2 w-48 bg-[#1e2035]" />
              </div>
              <Skeleton className="h-4 w-14 bg-[#1e2035]" />
              <Skeleton className="h-5 w-16 rounded bg-[#1e2035]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Position sizer ─────────────────────────────────────────────────────────────

function PositionSizer({ entry, slPct }: { entry: number; slPct: number }) {
  const [capital, setCapital] = useState('')
  const [riskPct, setRiskPct] = useState('1')

  const capitalNum = parseFloat(capital.replace(/,/g, '')) || 0
  const riskPctNum = parseFloat(riskPct) || 1
  const usdAtRisk   = (capitalNum * riskPctNum) / 100
  const unitsRaw    = slPct > 0 ? usdAtRisk / (entry * slPct / 100) : 0
  const units       = Math.floor(unitsRaw * 100) / 100
  const positionUSD = units * entry

  return (
    <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
        <Calculator size={12} className="text-[#374151]" />
        <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
          CALCULADORA DE POSICIÓN
        </span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="text-[9px] font-mono text-[#374151] uppercase tracking-wide block mb-1.5">
            Capital (USD)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={capital}
            onChange={e => setCapital(e.target.value)}
            placeholder="10,000"
            className="w-full bg-[#161622] border border-[#1e2035] rounded px-2.5 py-1.5 text-xs font-mono text-[#F0EFE8] placeholder-[#374151] focus:outline-none focus:border-[#F59E0B]/50"
          />
        </div>

        <div>
          <label className="text-[9px] font-mono text-[#374151] uppercase tracking-wide block mb-1.5">
            Riesgo %
          </label>
          <input
            type="number"
            step="0.5"
            min="0.1"
            max="10"
            value={riskPct}
            onChange={e => setRiskPct(e.target.value)}
            className="w-full bg-[#161622] border border-[#1e2035] rounded px-2.5 py-1.5 text-xs font-mono text-[#F0EFE8] focus:outline-none focus:border-[#F59E0B]/50"
          />
        </div>

        <div>
          <p className="text-[9px] font-mono text-[#374151] uppercase tracking-wide mb-1.5">USD en Riesgo</p>
          <p className="text-sm font-mono font-semibold tabular-nums text-[#ef4444]">
            {capitalNum > 0 ? `$${usdAtRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          </p>
        </div>

        <div>
          <p className="text-[9px] font-mono text-[#374151] uppercase tracking-wide mb-1.5">Tamaño Posición</p>
          <p className="text-sm font-mono font-semibold tabular-nums text-[#F59E0B]">
            {capitalNum > 0
              ? `${units.toLocaleString('en-US', { maximumFractionDigits: 2 })} uds ($${positionUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })})`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CfdsTrading() {
  const [selected, setSelected] = useState<AssetSymbol>('^GSPC')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CfdAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedAsset = CFD_ASSETS.find(a => a.symbol === selected)!

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/cfds/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: selected }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `Error ${res.status}`)
      }
      const data: CfdAnalysisResponse = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const groups = [...new Set(CFD_ASSETS.map(a => a.group))]

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl border border-[#1e2035] bg-[#0f0f17] p-5 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F59E0B]/0 via-[#F59E0B]/40 to-[#F59E0B]/0" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp size={12} className="text-[#F59E0B]" />
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#F59E0B] uppercase">
                Análisis de Sesgo MAIA
              </span>
            </div>
            <h2 className="text-lg font-bold text-[#F0EFE8] tracking-tight">
              CFDs · Trading de Contratos por Diferencia
            </h2>
            <p className="text-xs text-[#64748b] mt-1 max-w-lg leading-relaxed">
              Análisis técnico multi-factor: RSI, tendencia SMA, EMA, volumen y momentum para determinar el sesgo direccional del activo.
            </p>
          </div>
        </div>
      </div>

      {/* ── Asset selector ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
            SELECCIONAR ACTIVO
          </span>
        </div>

        <div className="p-4 space-y-3">
          {groups.map(group => (
            <div key={group}>
              <p className="text-[9px] font-mono text-[#374151] uppercase tracking-[0.12em] mb-2">{group}</p>
              <div className="flex flex-wrap gap-2">
                {CFD_ASSETS.filter(a => a.group === group).map(asset => (
                  <button
                    key={asset.symbol}
                    onClick={() => { setSelected(asset.symbol); setResult(null); setError(null) }}
                    className={[
                      'px-3 py-1.5 rounded border text-xs font-mono transition-colors',
                      selected === asset.symbol
                        ? 'border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]'
                        : 'border-[#1e2035] bg-[#161622] text-[#64748b] hover:border-[#374151] hover:text-[#F0EFE8]',
                    ].join(' ')}
                  >
                    {asset.label}
                    <span className="ml-1.5 text-[9px] opacity-60">{asset.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-2 flex items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-[#07070b] font-mono font-bold text-xs h-9 px-5 gap-2"
            >
              {loading ? (
                <><Loader2 size={13} className="animate-spin" /> Analizando…</>
              ) : (
                <><Search size={13} /> Analizar {selectedAsset.label}</>
              )}
            </Button>
            {result && !loading && (
              <span className="text-[10px] font-mono text-[#374151]">
                Último análisis: {new Date(result.analyzedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={14} className="text-[#ef4444] shrink-0" />
          <p className="text-xs font-mono text-[#ef4444]">{error}</p>
        </div>
      )}

      {/* ── Skeleton / Results ───────────────────────────────────────────────── */}
      {loading && <AnalysisSkeleton />}

      {result && !loading && (
        <>
          <MaiaBiasPanel data={result} />
          <PositionSizer entry={result.tradeSetup.entry} slPct={result.tradeSetup.slPct} />
        </>
      )}
    </div>
  )
}
