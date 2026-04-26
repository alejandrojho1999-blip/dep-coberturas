import { Clock, CheckCircle2, Circle, BarChart2, RefreshCw, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const PLANNED_CONTRACTS = [
  { symbol: 'ES',  name: 'E-mini S&P 500',      exchange: 'CME' },
  { symbol: 'NQ',  name: 'E-mini NASDAQ 100',    exchange: 'CME' },
  { symbol: 'GC',  name: 'Gold Futures',         exchange: 'COMEX' },
  { symbol: 'CL',  name: 'WTI Crude Oil',        exchange: 'NYMEX' },
  { symbol: '6E',  name: 'Euro FX Futures',      exchange: 'CME' },
  { symbol: 'ZN',  name: '10-Year T-Note',       exchange: 'CBOT' },
]

const PLANNED_FEATURES = [
  { icon: BarChart2, label: 'Análisis de sesgo MAIA para futuros', ready: false },
  { icon: RefreshCw, label: 'Gestión de rollovers automáticos', ready: false },
  { icon: Zap,       label: 'Pricing intraday con datos tick',     ready: false },
  { icon: CheckCircle2, label: 'Cálculo de margen inicial y de mantenimiento', ready: false },
]

export default function FuturosPlaceholder() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="relative rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F59E0B]/0 via-[#F59E0B]/40 to-[#F59E0B]/0" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={12} className="text-[#374151]" />
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#374151] uppercase">
                En Desarrollo
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#F0EFE8] tracking-tight mb-2">
              FUTUROS — Trading de Contratos
            </h2>
            <p className="text-sm text-[#64748b] leading-relaxed max-w-lg">
              El módulo de trading de futuros está en desarrollo. Incluirá análisis de sesgo MAIA,
              gestión de rollovers, cálculo de márgenes y pricing intraday con datos de alta frecuencia.
            </p>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-[#374151] bg-[#161622] text-[#374151] text-[10px] font-mono"
          >
            PRÓXIMAMENTE
          </Badge>
        </div>
      </div>

      {/* Planned contracts */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-[#374151]">
            CONTRATOS PLANIFICADOS
          </span>
          <div className="flex-1 h-px bg-[#1e2035]" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLANNED_CONTRACTS.map(({ symbol, name, exchange }) => (
            <div
              key={symbol}
              className="flex items-center gap-3 rounded-lg border border-[#1e2035] bg-[#0f0f17] px-3 py-2.5"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded bg-[#161622] shrink-0">
                <span className="text-[10px] font-mono font-bold text-[#374151]">{symbol}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#64748b] truncate">{name}</p>
                <p className="text-[9px] font-mono text-[#374151]">{exchange}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-[#1e2035]" />

      {/* Planned features */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-[#374151]">
            FUNCIONALIDADES EN ROADMAP
          </span>
          <div className="flex-1 h-px bg-[#1e2035]" />
        </div>

        <div className="space-y-2">
          {PLANNED_FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-[#1e2035] bg-[#0f0f17]">
              <Circle size={14} className="text-[#374151] shrink-0" />
              <Icon size={14} className="text-[#374151] shrink-0" />
              <span className="text-sm text-[#64748b]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
