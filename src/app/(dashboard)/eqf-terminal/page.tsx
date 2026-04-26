'use client'

import {
  BarChart2,
  Bot,
  Database,
  TrendingUp,
  CheckCircle2,
  Clock,
  RefreshCw,
  Download,
  ExternalLink,
  Terminal,
  Cpu,
  Globe,
  Zap,
} from 'lucide-react'
import { BorderBeam } from '@/components/ui/border-beam'
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const CAPABILITIES = [
  {
    id: 'ANALYTICS',
    label: 'ANALYTICS',
    title: 'Análisis CFA-Level',
    icon: BarChart2,
    color: '#3b82f6',
    items: [
      'Modelos DCF y valoración fundamental',
      'Value at Risk (VaR) y métricas de riesgo',
      'Ratio Sharpe, Sortino, Calmar',
      'Optimización de portafolio Modern Portfolio Theory',
      'Análisis de factor y backtesting',
    ],
  },
  {
    id: 'AI-AGENTS',
    label: 'AI AGENTS',
    title: '37 Agentes de IA',
    icon: Bot,
    color: '#F59E0B',
    items: [
      'Personas: Buffett, Graham, Lynch',
      'Agentes macroeconómicos y geopolíticos',
      'Soporte multi-LLM (GPT-4, Claude, Gemini)',
      'Investigación automatizada de activos',
      'Análisis de sentimiento de mercado',
    ],
  },
  {
    id: 'DATA',
    label: 'DATA CONNECTORS',
    title: '100+ Fuentes de Datos',
    icon: Database,
    color: '#22c55e',
    items: [
      'Yahoo Finance, FRED, Polygon.io',
      'Kraken, Binance (WebSocket en tiempo real)',
      '16 integraciones de brokers',
      'APIs gubernamentales y DBnomics',
      'Datos satelitales e inteligencia geopolítica',
    ],
  },
  {
    id: 'DERIVATIVES',
    label: 'DERIVATIVES',
    title: 'Suite QuantLib',
    icon: TrendingUp,
    color: '#ef4444',
    items: [
      '18 módulos cuantitativos',
      'Pricing de opciones (Black-Scholes, Heston)',
      'Futuros y forwards',
      'Estrategias de cobertura delta/gamma',
      'Motor de paper trading integrado',
    ],
  },
] as const

const TIMELINE = [
  {
    phase: 'FASE 1',
    title: 'Instalación Desktop',
    description: 'Aplicación nativa C++20 disponible para Windows, macOS y Linux. Instalación standalone, sin dependencias de servidor.',
    status: 'completed' as const,
    eta: 'Disponible ahora',
  },
  {
    phase: 'FASE 2',
    title: 'Programmatic API',
    description: 'API REST/WebSocket para integrar datos y funcionalidades de FinceptTerminal en aplicaciones externas como este sistema.',
    status: 'in-progress' as const,
    eta: 'Q3 2026 (roadmap oficial)',
  },
  {
    phase: 'FASE 3',
    title: 'Integración Nativa EQF',
    description: 'Conexión directa entre el sistema de Coberturas y FinceptTerminal: datos en tiempo real, señales y análisis unificados.',
    status: 'pending' as const,
    eta: 'Pendiente — requiere Fase 2',
  },
]

const STATUS_ICON = {
  completed: <CheckCircle2 size={16} className="text-[#22c55e] shrink-0 mt-0.5" />,
  'in-progress': <RefreshCw size={16} className="text-[#F59E0B] shrink-0 mt-0.5 animate-spin" />,
  pending: <Clock size={16} className="text-[#374151] shrink-0 mt-0.5" />,
}

const TECH_BADGES = [
  { icon: Cpu, label: 'C++20' },
  { icon: Terminal, label: 'Qt6 UI' },
  { icon: Globe, label: 'Python Analytics' },
  { icon: Zap, label: 'Single Binary' },
]

export default function EqfTerminalPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Hero panel */}
      <div className="relative rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6 overflow-hidden">
        <BorderBeam colorFrom="#F59E0B" colorTo="#D97706" size={80} duration={5} />

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Terminal size={14} className="text-[#F59E0B]" />
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-[#F59E0B] uppercase">
                Integración externa
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight leading-none mb-3">
              <AnimatedGradientText colorFrom="#F59E0B" colorTo="#F0EFE8" speed={0.4}>
                EQF TERMINAL
              </AnimatedGradientText>
            </h1>

            <p className="text-sm text-[#64748b] leading-relaxed max-w-lg">
              Plataforma institucional de análisis financiero basada en{' '}
              <span className="text-[#F0EFE8] font-medium">FinceptTerminal</span>{' '}
              de Fincept Corporation. Terminal Bloomberg-class con CFA-level analytics,
              37 agentes de IA y 100+ fuentes de datos.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              {TECH_BADGES.map(({ icon: Icon, label }) => (
                <Badge
                  key={label}
                  variant="outline"
                  className="flex items-center gap-1 border-[#1e2035] bg-[#161622] text-[#64748b] text-[10px] font-mono"
                >
                  <Icon size={10} />
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <Badge
            variant="outline"
            className="shrink-0 border-[#F59E0B]/30 bg-[#F59E0B]/5 text-[#F59E0B] text-[10px] font-mono"
          >
            BETA
          </Badge>
        </div>
      </div>

      {/* Capabilities grid */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-[#374151]">
            CAPACIDADES
          </span>
          <div className="flex-1 h-px bg-[#1e2035]" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAPABILITIES.map(({ id, label, title, icon: Icon, color, items }) => (
            <div
              key={id}
              className="rounded-lg border border-[#1e2035] bg-[#0f0f17] overflow-hidden"
            >
              {/* Panel header strip */}
              <div
                className="flex items-center gap-2 px-4 py-2 border-b border-[#1e2035]"
                style={{ borderTopColor: color, borderTopWidth: 2 }}
              >
                <Icon size={12} style={{ color }} />
                <span
                  className="text-[9px] font-mono font-bold tracking-[0.15em] uppercase"
                  style={{ color }}
                >
                  {label}
                </span>
              </div>

              <div className="p-4">
                <p className="font-semibold text-sm text-[#F0EFE8] mb-3">{title}</p>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-[#1e2035] shrink-0" />
                      <span className="text-xs text-[#64748b] leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-[#1e2035]" />

      {/* Integration timeline */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-[#374151]">
            HOJA DE RUTA DE INTEGRACIÓN
          </span>
          <div className="flex-1 h-px bg-[#1e2035]" />
        </div>

        <div className="space-y-3">
          {TIMELINE.map(({ phase, title, description, status, eta }) => (
            <div
              key={phase}
              className={`rounded-lg border p-4 flex gap-3 transition-colors ${
                status === 'completed'
                  ? 'border-[#22c55e]/20 bg-[#22c55e]/3'
                  : status === 'in-progress'
                  ? 'border-[#F59E0B]/20 bg-[#F59E0B]/3'
                  : 'border-[#1e2035] bg-[#0f0f17]'
              }`}
            >
              {STATUS_ICON[status]}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-mono font-bold tracking-[0.15em] text-[#374151] uppercase">
                    {phase}
                  </span>
                  <span className="font-semibold text-sm text-[#F0EFE8]">{title}</span>
                  <span
                    className={`ml-auto text-[9px] font-mono shrink-0 ${
                      status === 'completed'
                        ? 'text-[#22c55e]'
                        : status === 'in-progress'
                        ? 'text-[#F59E0B]'
                        : 'text-[#374151]'
                    }`}
                  >
                    {eta}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#64748b] leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-[#1e2035]" />

      {/* Download CTA */}
      <div className="rounded-xl border border-[#1e2035] bg-[#0f0f17] p-6">
        <div className="flex items-center gap-3 mb-2">
          <Download size={14} className="text-[#F59E0B]" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-[#F59E0B]">
            DESCARGAR TERMINAL
          </span>
        </div>
        <p className="text-sm text-[#64748b] mb-4 max-w-md">
          Instala FinceptTerminal en tu sistema para acceder a la suite completa de análisis institucional.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal/releases"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShimmerButton
              shimmerColor="#F59E0B"
              background="rgba(245,158,11,0.12)"
              borderRadius="6px"
              className="text-[#F59E0B] text-xs font-mono font-semibold tracking-wide px-4 py-2 border-[#F59E0B]/30"
            >
              <Download size={12} className="mr-2" />
              Descargar Releases
            </ShimmerButton>
          </a>

          <a
            href="https://github.com/Fincept-Corporation/FinceptTerminal"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-[#1e2035] text-xs font-mono text-[#64748b] transition-colors hover:border-[#F59E0B]/30 hover:text-[#F0EFE8]"
          >
            <ExternalLink size={12} />
            Ver Repositorio
          </a>
        </div>

        <p className="mt-3 text-[10px] text-[#374151] font-mono">
          Compatibilidad: Windows 10+ · macOS 12+ · Ubuntu 22.04+
        </p>
      </div>
    </div>
  )
}
