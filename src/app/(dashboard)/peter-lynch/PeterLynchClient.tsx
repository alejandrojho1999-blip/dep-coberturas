'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { ScreenerResult } from '@/lib/peter-lynch/screener'

const FILTERS = [
  { key: 'pe_historico',    label: 'P/E Histórico',         threshold: '< 25',       desc: 'No pagar de más por ganancias actuales' },
  { key: 'pe_proyectado',   label: 'P/E Proyectado',        threshold: '< 15',       desc: 'Valuación futura más barata al crecer' },
  { key: 'deuda_capital',   label: 'Deuda / Capital',       threshold: '< 35%',      desc: 'Menos deuda reduce riesgo en crisis' },
  { key: 'crecimiento_eps', label: 'Crecimiento EPS',       threshold: '> 15%',      desc: 'El motor — sin crecimiento no hay grandes ganadores' },
  { key: 'peg',             label: 'Ratio PEG',             threshold: '< 2',        desc: 'Crecimiento a precio razonable' },
  { key: 'market_cap',      label: 'Capitalización',        threshold: '> USD 5.000M', desc: 'Probada pero con margen para crecer' },
] as const

const CATEGORIES = [
  { name: 'Slow Growers',  growth: '2–4% anual',     icon: '🐢', desc: 'Utilities y compañías maduras. Dividendos estables. Bajo riesgo, baja recompensa.' },
  { name: 'Stalwarts',     growth: '10–12% anual',   icon: '🏛️', desc: 'Blue chips como Coca-Cola. Crecimiento predecible y consistente. Refugio en crisis.' },
  { name: 'Fast Growers',  growth: '20–25% anual',   icon: '🚀', desc: 'Pequeñas empresas agresivas. Los potenciales ten-baggers de Lynch. Mayor riesgo.' },
  { name: 'Cyclicals',     growth: 'Variable',        icon: '🔄', desc: 'Aerolíneas, autos, químicos. El timing lo es todo — comprar en el valle del ciclo.' },
  { name: 'Turnarounds',   growth: 'Recuperación',    icon: '↩️', desc: 'Empresas en crisis con un catalizador de recuperación claro. Alto potencial asimétrico.' },
  { name: 'Asset Plays',   growth: 'Oculto',          icon: '💎', desc: 'Activos subvalorados no reflejados en el precio de mercado. Paciencia requerida.' },
]

function fmt(v: number | null, suffix = '', decimals = 1): string {
  if (v == null) return '—'
  return `${v.toFixed(decimals)}${suffix}`
}

function fmtCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  return `$${(v / 1e6).toFixed(0)}M`
}

function scoreBadge(score: number) {
  if (score === 6) return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold font-mono bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
      ⭐ APTA 6/6
    </span>
  )
  if (score === 5) return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold font-mono bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
      ✓ 5/6
    </span>
  )
  if (score === 4) return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30">
      4/6
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono text-[#475569] border border-[#1e2035]">
      {score}/6
    </span>
  )
}

function Check({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-[#22c55e] font-bold">✓</span>
    : <span className="text-[#ef4444]">✗</span>
}

export function PeterLynchClient() {
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/peter-lynch/screen')
      .then((r) => r.json())
      .then((d: ScreenerResult[]) => setResults(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#07070b] px-4 py-6 text-[#F0EFE8] lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold font-mono tracking-tight text-[#F0EFE8]">
            METODOLOGÍA PETER LYNCH
          </h1>
          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30 font-mono text-[10px]">
            GARP — Growth at a Reasonable Price
          </Badge>
        </div>
        <p className="text-[#64748b] text-sm font-mono">
          &ldquo;Invierte en lo que conoces.&rdquo; — Universo: S&P 500 + NASDAQ 100
        </p>
      </div>

      {/* 6 Filters */}
      <section className="mb-8">
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          6 Filtros de Selección
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FILTERS.map((f, i) => (
            <div key={f.key} className="rounded-lg border border-[#1e2035] bg-[#0f0f17] p-3">
              <p className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[#374151] mb-1">
                {i + 1}. {f.label}
              </p>
              <p className="text-lg font-bold font-mono text-[#F59E0B] mb-1">{f.threshold}</p>
              <p className="text-[10px] text-[#475569] leading-tight">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screener Results */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151]">
            Screener — Empresas Ordenadas por Puntaje
          </p>
          {!loading && results.length > 0 && (
            <span className="text-[9px] font-mono text-[#475569]">{results.length} empresas analizadas</span>
          )}
        </div>

        {loading && (
          <div className="rounded-lg border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b border-[#1e2035]">
                <Skeleton className="h-4 w-16 bg-[#161622]" />
                <Skeleton className="h-4 w-32 bg-[#161622]" />
                <Skeleton className="h-4 w-48 flex-1 bg-[#161622]" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/5 p-4 text-sm text-[#ef4444] font-mono">
            Error al cargar datos: {error}
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="rounded-lg border border-[#1e2035] bg-[#0f0f17] overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1e2035]">
                  <th className="px-3 py-2.5 text-center text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold min-w-[160px]">Empresa</th>
                  <th className="px-3 py-2.5 text-left text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16">Ticker</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">P/E</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">Fwd P/E</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">D/E%</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-20 whitespace-nowrap">Crec.EPS</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">PEG</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-20 whitespace-nowrap">Mkt Cap</th>
                  <th className="px-3 py-2.5 text-center text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-24 whitespace-nowrap">Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, index) => (
                  <tr
                    key={r.ticker}
                    className={`border-b border-[#1e2035] transition-colors hover:bg-[#161622] ${r.score === 6 ? 'border-l-2 border-l-[#F59E0B] bg-[#161622]/50' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-center text-[#475569]">{index + 1}</td>
                    <td className="px-3 py-2.5 max-w-[180px] truncate text-[#94a3b8] text-[11px]">{r.name}</td>
                    <td className="px-3 py-2.5 text-[#F59E0B] font-bold">{r.ticker}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <Check ok={r.criteria.pe_historico} />
                      <span className="ml-1 text-[#94a3b8]">{fmt(r.pe_historico)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <Check ok={r.criteria.pe_proyectado} />
                      <span className="ml-1 text-[#94a3b8]">{fmt(r.pe_proyectado)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <Check ok={r.criteria.deuda_capital} />
                      <span className="ml-1 text-[#94a3b8]">{fmt(r.deuda_capital, '%', 0)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <Check ok={r.criteria.crecimiento_eps} />
                      <span className="ml-1 text-[#94a3b8]">{r.crecimiento_eps != null ? `${(r.crecimiento_eps * 100).toFixed(0)}%` : '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <Check ok={r.criteria.peg} />
                      <span className="ml-1 text-[#94a3b8]">{fmt(r.peg, '', 2)}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <Check ok={r.criteria.market_cap} />
                      <span className="ml-1 text-[#94a3b8]">{fmtCap(r.market_cap)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">{scoreBadge(r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6 Categories */}
      <section>
        <p className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151] mb-3">
          6 Categorías de Empresas según Lynch
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <div key={c.name} className="rounded-lg border border-[#1e2035] bg-[#0f0f17] p-4 flex gap-3">
              <span className="text-2xl mt-0.5 shrink-0">{c.icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold font-mono text-[#F0EFE8]">{c.name}</p>
                  <span className="text-[9px] font-mono text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded border border-[#F59E0B]/20">
                    {c.growth}
                  </span>
                </div>
                <p className="text-xs text-[#64748b] leading-relaxed">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
