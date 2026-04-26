'use client'

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2,
  Star, Shield, Zap, AlertCircle, ChevronUp, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MarketAnalysisResponse, AssetAnalysis } from '@/app/api/cfds/market-analysis/route'

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskProfile = 'conservador' | 'moderado' | 'agresivo'
type AssetCategory = 'Acciones' | 'Crypto' | 'Divisas' | 'Materiales' | 'Índices'

// ── Signal & bias config ──────────────────────────────────────────────────────

const SIGNAL_CFG = {
  COMPRA:  { label: 'COMPRA',  color: '#22c55e', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/20', arrow: '▲' },
  VENTA:   { label: 'VENTA',   color: '#ef4444', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20', arrow: '▼' },
  NEUTRAL: { label: 'NEUTRAL', color: '#64748b', bg: 'bg-[#374151]/10', border: 'border-[#374151]/20', arrow: '◆' },
}

const BIAS_CFG = {
  ALCISTA: { label: 'ALCISTA', color: '#22c55e', icon: TrendingUp },
  BAJISTA: { label: 'BAJISTA', color: '#ef4444', icon: TrendingDown },
  NEUTRAL: { label: 'NEUTRAL', color: '#64748b', icon: Minus },
}

const RISK_BADGE = {
  BAJO:     'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20',
  MEDIO:    'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
  MODERADO: 'text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20',
  ALTO:     'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20',
}

// ── Risk profile selector ─────────────────────────────────────────────────────

const PROFILES: { id: RiskProfile; label: string; desc: string; icon: typeof Shield }[] = [
  { id: 'conservador', label: 'Conservador', desc: 'Índices, Oro y Divisas principales', icon: Shield },
  { id: 'moderado',    label: 'Moderado',    desc: 'Acciones blue chip + algo de Crypto', icon: Star },
  { id: 'agresivo',    label: 'Agresivo',    desc: 'Acciones, Crypto y alta volatilidad', icon: Zap },
]

function ProfileCard({
  profile, selected, onSelect,
}: { profile: typeof PROFILES[0]; selected: boolean; onSelect: () => void }) {
  const Icon = profile.icon
  return (
    <button
      onClick={onSelect}
      className={[
        'flex-1 rounded-xl border p-4 text-left transition-all duration-150',
        selected
          ? 'border-[#F59E0B]/60 bg-[#F59E0B]/8'
          : 'border-[#1e2035] bg-[#0f0f17] hover:border-[#374151]',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={selected ? 'text-[#F59E0B]' : 'text-[#374151]'} />
        <span className={`text-xs font-mono font-bold ${selected ? 'text-[#F59E0B]' : 'text-[#64748b]'}`}>
          {profile.label}
        </span>
        {selected && (
          <span className="ml-auto text-[9px] font-mono bg-[#F59E0B]/20 text-[#F59E0B] px-1.5 py-0.5 rounded">
            ACTIVO
          </span>
        )}
      </div>
      <p className="text-[10px] text-[#374151] leading-relaxed">{profile.desc}</p>
    </button>
  )
}

// ── Asset card ────────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: AssetAnalysis }) {
  const sig = SIGNAL_CFG[asset.signal]
  const isUp = asset.changePercent24h >= 0
  const pct = Math.abs(asset.changePercent24h).toFixed(2)

  const priceStr = asset.price >= 1000
    ? asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : asset.price >= 1
    ? asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : asset.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })

  return (
    <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-mono font-bold text-[#F0EFE8]">
              {asset.ticker.replace('-USD', '').replace('=X', '').replace('=F', '').replace('^', '')}
            </span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${sig.bg} ${sig.border}`} style={{ color: sig.color }}>
              {sig.arrow} {sig.label}
            </span>
          </div>
          <p className="text-[10px] text-[#64748b]">{asset.name}</p>
        </div>
        <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${RISK_BADGE[asset.riskLevel]}`}>
          {asset.riskLevel}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-base font-mono font-bold tabular-nums text-[#F0EFE8]">${priceStr}</span>
        <span className={`flex items-center gap-0.5 text-[10px] font-mono font-semibold ${isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {isUp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {isUp ? '+' : '-'}{pct}% 24h
        </span>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-[#374151] uppercase tracking-wide">Confianza</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: sig.color }}>{asset.confidence}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-[#161622] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${asset.confidence}%`, backgroundColor: sig.color }}
          />
        </div>
      </div>

      {/* Reason */}
      <p className="text-[10px] text-[#64748b] leading-relaxed italic">{asset.reason}</p>
    </div>
  )
}

// ── Rankings list ─────────────────────────────────────────────────────────────

function RankingRow({ asset, rank }: { asset: AssetAnalysis; rank: number }) {
  const sig = SIGNAL_CFG[asset.signal]
  const shortTicker = asset.ticker.replace('-USD', '').replace('=X', '').replace('=F', '').replace('^', '')
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#1e2035] last:border-0">
      <span className="text-[10px] font-mono text-[#374151] w-4 text-right shrink-0">{rank}</span>
      <span className="text-xs font-mono font-bold text-[#F0EFE8] w-14 shrink-0">{shortTicker}</span>
      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${sig.bg}`} style={{ color: sig.color }}>
        {sig.arrow} {sig.label}
      </span>
      <div className="flex-1 flex items-center gap-1.5">
        <div className="flex-1 h-1 rounded-full bg-[#161622] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${asset.confidence}%`, backgroundColor: sig.color }} />
        </div>
        <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: sig.color }}>
          {asset.confidence}%
        </span>
      </div>
    </div>
  )
}

// ── Portfolio distribution bar ─────────────────────────────────────────────────

function PortfolioBar({ distribution }: { distribution: Record<string, number> }) {
  const CAT_COLORS: Record<string, string> = {
    Acciones:   '#F59E0B',
    Crypto:     '#8b5cf6',
    Divisas:    '#3b82f6',
    Materiales: '#22c55e',
    Índices:    '#64748b',
  }
  const entries = Object.entries(distribution).filter(([, v]) => v > 0)
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        {entries.map(([cat, pct]) => (
          <div
            key={cat}
            style={{ width: `${pct}%`, backgroundColor: CAT_COLORS[cat] ?? '#374151' }}
            title={`${cat}: ${pct}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {entries.map(([cat, pct]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] }} />
            <span className="text-[9px] font-mono text-[#64748b]">{cat} <span className="text-[#F0EFE8] font-bold">{pct}%</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-xl border border-[#1e2035] h-28 bg-[#0f0f17]" />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#1e2035] h-20 bg-[#0f0f17]" />
        <div className="rounded-xl border border-[#1e2035] h-20 bg-[#0f0f17]" />
      </div>
      <div className="rounded-xl border border-[#1e2035] h-64 bg-[#0f0f17]" />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CfdsTrading() {
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MarketAnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('Acciones')

  const CATEGORIES: AssetCategory[] = ['Acciones', 'Crypto', 'Divisas', 'Materiales', 'Índices']

  async function handleAnalyze() {
    if (!riskProfile) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/cfds/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskProfile }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string })?.error ?? `Error ${res.status}`)
      }
      const data = await res.json() as MarketAnalysisResponse
      setResult(data)
      setActiveCategory('Acciones')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const biasCfg = result ? BIAS_CFG[result.marketBias] : null
  const BiasIcon = biasCfg?.icon ?? Minus
  const categoryAssets = result?.byCategory[activeCategory] ?? []

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl border border-[#1e2035] bg-[#0f0f17] p-5 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F59E0B]/0 via-[#F59E0B]/40 to-[#F59E0B]/0" />
        <div className="flex items-center gap-2 mb-1.5">
          <TrendingUp size={12} className="text-[#F59E0B]" />
          <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#F59E0B] uppercase">
            Análisis de Mercado MAIA
          </span>
        </div>
        <h2 className="text-lg font-bold text-[#F0EFE8] tracking-tight">
          CFDs · Análisis Multi-Activo
        </h2>
        <p className="text-xs text-[#64748b] mt-1 max-w-lg leading-relaxed">
          Selecciona tu perfil de riesgo y analiza todos los mercados: acciones, crypto, divisas, materiales e índices con señales MAIA en tiempo real.
        </p>
      </div>

      {/* ── Risk profile selector ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
            PERFIL DE RIESGO
          </span>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {PROFILES.map(p => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={riskProfile === p.id}
                onSelect={() => { setRiskProfile(p.id); setResult(null); setError(null) }}
              />
            ))}
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!riskProfile || loading}
            className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-40 text-[#07070b] font-mono font-bold text-sm h-10 gap-2"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Analizando mercados…</>
            ) : (
              <><TrendingUp size={14} /> Analizar Mercados{riskProfile ? ` — Perfil ${riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1)}` : ''}</>
            )}
          </Button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 px-4 py-3 flex items-center gap-3">
          <AlertCircle size={14} className="text-[#ef4444] shrink-0" />
          <p className="text-xs font-mono text-[#ef4444]">{error}</p>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && <LoadingSkeleton />}

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {result && !loading && biasCfg && (
        <div className="space-y-5">
          {/* Market bias hero */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: `${biasCfg.color}30`, backgroundColor: `${biasCfg.color}06` }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-xl shrink-0"
                style={{ backgroundColor: `${biasCfg.color}15`, border: `1px solid ${biasCfg.color}30` }}
              >
                <BiasIcon size={24} style={{ color: biasCfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-[#374151] uppercase tracking-wide mb-1">Sesgo General del Mercado</p>
                <p className="text-xl font-mono font-bold" style={{ color: biasCfg.color }}>{biasCfg.label}</p>
                <p className="text-xs text-[#64748b] mt-1 leading-relaxed max-w-xl">{result.marketNarrative}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-mono text-[#374151]">{result.assetsAnalyzed} activos</p>
                <p className="text-[9px] font-mono text-[#374151]">
                  {new Date(result.analyzedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* Opportunity + Risk alert */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/5 px-4 py-3">
              <p className="text-[9px] font-mono font-bold text-[#22c55e] uppercase tracking-wide mb-1.5">
                Oportunidad Destacada
              </p>
              <p className="text-xs text-[#F0EFE8] leading-relaxed">{result.opportunity}</p>
            </div>
            <div className="rounded-xl border border-[#f97316]/20 bg-[#f97316]/5 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={10} className="text-[#f97316]" />
                <p className="text-[9px] font-mono font-bold text-[#f97316] uppercase tracking-wide">Alerta de Riesgo</p>
              </div>
              <p className="text-xs text-[#F0EFE8] leading-relaxed">{result.riskAlert}</p>
            </div>
          </div>

          {/* Portfolio distribution */}
          <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
                Distribución de Portafolio
              </span>
              <span className="text-[9px] font-mono text-[#F59E0B] capitalize">Perfil {result.riskProfile}</span>
            </div>
            <div className="p-4">
              <PortfolioBar distribution={result.portfolioDistribution} />
            </div>
          </div>

          {/* Rankings */}
          <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
            <div className="px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
                Rankings por Confianza
              </span>
            </div>
            <div className="px-4 py-1">
              {result.rankings.map((asset, i) => (
                <RankingRow key={asset.ticker} asset={asset} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Category tabs + asset grid */}
          <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-[#1e2035] overflow-x-auto">
              {CATEGORIES.map(cat => {
                const count = result.byCategory[cat]?.length ?? 0
                if (count === 0) return null
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={[
                      'px-4 py-2.5 text-[10px] font-mono font-bold whitespace-nowrap transition-colors border-b-2',
                      activeCategory === cat
                        ? 'text-[#F59E0B] border-[#F59E0B] bg-[#F59E0B]/5'
                        : 'text-[#374151] border-transparent hover:text-[#64748b]',
                    ].join(' ')}
                  >
                    {cat}
                    <span className="ml-1.5 text-[8px] opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>

            {/* Grid */}
            <div className="p-4">
              {categoryAssets.length === 0 ? (
                <p className="text-xs text-[#374151] text-center py-6">Sin activos en esta categoría</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {categoryAssets.map(asset => (
                    <AssetCard key={asset.ticker} asset={asset} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer disclaimer */}
          <div className="flex items-start gap-2 px-1">
            <AlertTriangle size={10} className="text-[#374151] shrink-0 mt-0.5" />
            <p className="text-[9px] font-mono text-[#374151] leading-relaxed">
              Análisis generado: {new Date(result.analyzedAt).toLocaleString('es-ES', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })} · Perfil: {result.riskProfile} · {result.assetsAnalyzed} activos analizados
              {result.assetsFailed > 0 ? ` (${result.assetsFailed} no disponibles)` : ''} ·
              Este análisis es informativo y educativo. No constituye asesoría financiera.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
