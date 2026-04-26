import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { CfdAnalysisResponse, CfdFactor } from '@/app/api/cfds/analysis/route'

// ── Signal helpers ─────────────────────────────────────────────────────────────

const SIGNAL_CONFIG = {
  bullish: {
    label: 'Alcista',
    color: '#22c55e',
    icon: TrendingUp,
    bg: 'bg-[#22c55e]/10',
    border: 'border-[#22c55e]/20',
  },
  bearish: {
    label: 'Bajista',
    color: '#ef4444',
    icon: TrendingDown,
    bg: 'bg-[#ef4444]/10',
    border: 'border-[#ef4444]/20',
  },
  neutral: {
    label: 'Neutral',
    color: '#64748b',
    icon: Minus,
    bg: 'bg-[#374151]/10',
    border: 'border-[#374151]/20',
  },
}

const BIAS_CONFIG = {
  LARGO: { label: 'LARGO', color: '#22c55e', icon: TrendingUp, arrow: '↑' },
  CORTO: { label: 'CORTO', color: '#ef4444', icon: TrendingDown, arrow: '↓' },
  NEUTRAL: { label: 'NEUTRAL', color: '#64748b', icon: Minus, arrow: '→' },
}

function FactorRow({ factor }: { factor: CfdFactor }) {
  const cfg = SIGNAL_CONFIG[factor.signal]
  const Icon = cfg.icon
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-start py-2.5 border-b border-[#1e2035] last:border-0">
      <div>
        <p className="text-xs font-mono font-semibold text-[#F0EFE8]">{factor.name}</p>
        <p className="text-[10px] text-[#64748b] mt-0.5 leading-relaxed">{factor.description}</p>
      </div>
      <span className="text-xs font-mono tabular-nums text-[#F0EFE8] text-right pt-0.5 whitespace-nowrap">
        {factor.value}
      </span>
      <div className={`flex items-center gap-1 rounded px-2 py-0.5 ${cfg.bg} shrink-0`}>
        <Icon size={10} style={{ color: cfg.color }} />
        <span className="text-[9px] font-mono font-bold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

// ── Confidence bar ─────────────────────────────────────────────────────────────

function ConfidenceBar({ confidence, bias }: { confidence: number; bias: keyof typeof BIAS_CONFIG }) {
  const color = BIAS_CONFIG[bias].color
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-[#374151] uppercase tracking-wide">Confianza</span>
        <span className="text-sm font-mono font-bold tabular-nums" style={{ color }}>
          {confidence}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#161622] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${confidence}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  data: CfdAnalysisResponse
}

export default function MaiaBiasPanel({ data }: Props) {
  const biasCfg = BIAS_CONFIG[data.bias]
  const BiasIcon = biasCfg.icon

  const priceFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(data.price)

  const analyzedTime = new Date(data.analyzedAt).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  return (
    <div className="space-y-4">
      {/* ── Bias header card ──────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: `${biasCfg.color}30`,
          backgroundColor: `${biasCfg.color}06`,
        }}
      >
        <div className="flex items-start gap-4">
          {/* Big bias indicator */}
          <div
            className="flex items-center justify-center w-14 h-14 rounded-xl shrink-0"
            style={{ backgroundColor: `${biasCfg.color}15`, border: `1px solid ${biasCfg.color}30` }}
          >
            <BiasIcon size={24} style={{ color: biasCfg.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
                SESGO MAIA
              </span>
              <Badge
                variant="outline"
                className="text-[9px] font-mono font-bold px-2 py-0"
                style={{ color: biasCfg.color, borderColor: `${biasCfg.color}40` }}
              >
                {biasCfg.label} {biasCfg.arrow}
              </Badge>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-bold font-mono tabular-nums text-[#F0EFE8]">
                {data.name}
              </span>
              <span className="text-sm font-mono tabular-nums text-[#F0EFE8]">
                {priceFormatted}
                <span className="text-[10px] text-[#64748b] ml-1">{data.currency}</span>
              </span>
            </div>

            <div className="mt-2">
              <ConfidenceBar confidence={data.confidence} bias={data.bias} />
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[9px] font-mono text-[#374151]">Análisis</p>
            <p className="text-[10px] font-mono text-[#64748b]">{analyzedTime}</p>
          </div>
        </div>
      </div>

      {/* ── Factor breakdown ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
            FACTORES TÉCNICOS
          </span>
          <div className="flex items-center gap-1.5">
            {(['bullish', 'neutral', 'bearish'] as const).map(s => {
              const count = data.factors.filter(f => f.signal === s).length
              const cfg = SIGNAL_CONFIG[s]
              return count > 0 ? (
                <span
                  key={s}
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${cfg.bg}`}
                  style={{ color: cfg.color }}
                >
                  {count} {cfg.label}
                </span>
              ) : null
            })}
          </div>
        </div>

        <div className="px-4">
          {data.factors.map(factor => (
            <FactorRow key={factor.name} factor={factor} />
          ))}
        </div>
      </div>

      {/* ── Why this bias — el corazón del panel ─────────────────────────────── */}
      <div className="rounded-xl border border-[#F59E0B]/20 bg-[#0f0f17] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F59E0B]/20 bg-[#F59E0B]/5">
          <MessageSquare size={12} className="text-[#F59E0B]" />
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#F59E0B] uppercase">
            ¿POR QUÉ ESTE SESGO? — Razonamiento del Análisis
          </span>
        </div>

        <div className="p-4 border-l-2 border-[#F59E0B]">
          <p className="text-sm text-[#F0EFE8] leading-relaxed">
            {data.narrative}
          </p>
        </div>
      </div>

      {/* ── Trade setup ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1e2035] bg-[#161622]">
          <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
            PARÁMETROS DE TRADE SUGERIDOS
          </span>
        </div>

        <div className="grid grid-cols-2 gap-0 sm:grid-cols-4">
          {[
            { label: 'ENTRADA', value: data.tradeSetup.entry.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }), color: '#F0EFE8' },
            { label: 'STOP LOSS', value: `${data.tradeSetup.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (−${data.tradeSetup.slPct}%)`, color: '#ef4444' },
            { label: 'TAKE PROFIT', value: `${data.tradeSetup.takeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (+${data.tradeSetup.tpPct}%)`, color: '#22c55e' },
            { label: 'RATIO R/B', value: `1:${data.tradeSetup.riskReward}`, color: '#F59E0B' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 border-b border-r border-[#1e2035] last:border-r-0">
              <p className="text-[9px] font-mono text-[#374151] uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-mono font-semibold tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 flex items-center gap-1.5">
          <AlertTriangle size={10} className="text-[#374151] shrink-0" />
          <p className="text-[9px] font-mono text-[#374151]">
            Los niveles de SL/TP son referenciales (±1.5%/±2.5% del precio de entrada). Ajusta según tu gestión de riesgo.
          </p>
        </div>
      </div>

      <Separator className="bg-[#1e2035]" />
    </div>
  )
}
