'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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

const CAP_RANGES: Record<string, [number, number]> = {
  MEGA:  [200e9, Infinity],
  LARGE: [10e9,  200e9],
  MID:   [2e9,   10e9],
  SMALL: [0,     2e9],
}

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

const SELECT_CLS = 'rounded border border-[#1e2035] bg-[#0f0f17] px-3 py-1.5 text-xs font-mono text-[#F0EFE8] outline-none focus:border-[#F59E0B] transition-colors cursor-pointer'

export function PeterLynchClient() {
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch]     = useState('')
  const [showSugg, setShowSugg] = useState(false)
  const [sector, setSector]     = useState('ALL')
  const [capSize, setCapSize]   = useState('ALL')
  const wrapperRef              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/peter-lynch/screen')
      .then((r) => r.json())
      .then((d: ScreenerResult[]) => setResults(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const sectors = useMemo(() =>
    ['ALL', ...Array.from(new Set(results.map((r) => r.sector).filter((s) => s !== '—'))).sort()],
    [results]
  )

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return results
      .filter((r) => r.ticker.toLowerCase().startsWith(q) || r.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [results, search])

  const filtered = useMemo(() => results.filter((r) => {
    const q = search.trim().toLowerCase()
    if (q && !r.ticker.toLowerCase().startsWith(q) && !r.name.toLowerCase().includes(q)) return false
    if (sector !== 'ALL' && r.sector !== sector) return false
    if (capSize !== 'ALL') {
      const [lo, hi] = CAP_RANGES[capSize]
      if (r.market_cap == null || r.market_cap < lo || r.market_cap >= hi) return false
    }
    return true
  }), [results, search, sector, capSize])

  const handleSearchSelect = (r: ScreenerResult) => {
    setSearch(r.ticker)
    setShowSugg(false)
  }

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
            <span className="text-[9px] font-mono text-[#475569]">
              {filtered.length} / {results.length} empresas
            </span>
          )}
        </div>

        {/* Filter bar */}
        {!loading && !error && results.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search with autocomplete */}
            <div ref={wrapperRef} className="relative">
              <input
                type="text"
                placeholder="Buscar ticker o empresa..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value.toUpperCase())
                  setShowSugg(e.target.value.length > 0)
                }}
                onFocus={() => search.length > 0 && setShowSugg(true)}
                onKeyDown={(e) => e.key === 'Escape' && setShowSugg(false)}
                className="w-56 rounded border border-[#1e2035] bg-[#0f0f17] px-3 py-1.5 text-xs font-mono text-[#F0EFE8] outline-none focus:border-[#F59E0B] transition-colors"
              />
              {showSugg && suggestions.length > 0 && (
                <ul className="absolute top-full left-0 mt-1 w-full z-50 rounded border border-[#1e2035] bg-[#0f0f17] shadow-xl overflow-hidden">
                  {suggestions.map((s) => (
                    <li
                      key={s.ticker}
                      onMouseDown={() => handleSearchSelect(s)}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#161622] transition-colors"
                    >
                      <span className="text-[11px] font-bold font-mono text-[#F59E0B] w-16 shrink-0">{s.ticker}</span>
                      <span className="text-[10px] font-mono text-[#64748b] truncate">{s.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sector filter */}
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={SELECT_CLS}>
              {sectors.map((s) => (
                <option key={s} value={s}>{s === 'ALL' ? 'Todos los sectores' : s}</option>
              ))}
            </select>

            {/* Cap size filter */}
            <select value={capSize} onChange={(e) => setCapSize(e.target.value)} className={SELECT_CLS}>
              <option value="ALL">Todos los tamaños</option>
              <option value="MEGA">Mega Cap (&gt; $200B)</option>
              <option value="LARGE">Large Cap ($10B–$200B)</option>
              <option value="MID">Mid Cap ($2B–$10B)</option>
              <option value="SMALL">Small Cap (&lt; $2B)</option>
            </select>

            {(search || sector !== 'ALL' || capSize !== 'ALL') && (
              <button
                onClick={() => { setSearch(''); setSector('ALL'); setCapSize('ALL') }}
                className="text-[10px] font-mono text-[#475569] hover:text-[#F59E0B] transition-colors"
              >
                Limpiar filtros ✕
              </button>
            )}
          </div>
        )}

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
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-20 whitespace-nowrap">Precio</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">P/E</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">Fwd P/E</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">D/E</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-20 whitespace-nowrap">Crec.EPS</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-16 whitespace-nowrap">PEG</th>
                  <th className="px-3 py-2.5 text-right text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-20 whitespace-nowrap">Mkt Cap</th>
                  <th className="px-3 py-2.5 text-center text-[9px] tracking-[0.12em] uppercase text-[#374151] font-bold w-24 whitespace-nowrap">Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-[#475569] text-xs font-mono">
                      Sin resultados para los filtros aplicados
                    </td>
                  </tr>
                ) : filtered.map((r, index) => (
                  <tr
                    key={r.ticker}
                    className={`border-b border-[#1e2035] transition-colors hover:bg-[#161622] ${r.score === 6 ? 'border-l-2 border-l-[#F59E0B] bg-[#161622]/50' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-center text-[#475569]">{index + 1}</td>
                    <td className="px-3 py-2.5 max-w-[180px] truncate text-[#94a3b8] text-[11px]">{r.name}</td>
                    <td className="px-3 py-2.5 text-[#F59E0B] font-bold">{r.ticker}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-[#F0EFE8]">
                      {r.price != null ? `$${r.price.toFixed(2)}` : '—'}
                    </td>
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
                      <span className="ml-1 text-[#94a3b8]">{r.deuda_capital != null ? `${r.deuda_capital.toFixed(2)}x` : '—'}</span>
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
