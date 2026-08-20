import {
  LayoutDashboard,
  TrendingUp,
  Shield,
  BookOpen,
  BarChart2,
  Bot,
  FileText,
  ArrowRight,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import { BorderBeam } from '@/components/ui/border-beam'
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const STAT_CARDS = [
  {
    label: 'TICKERS ANALIZADOS',
    value: '—',
    icon: TrendingUp,
    href: '/inversion-causal',
    featured: true,
    unit: 'activos',
  },
  {
    label: 'PORTAFOLIOS ACTIVOS',
    value: '—',
    icon: LayoutDashboard,
    href: '/portafolios',
    featured: false,
    unit: 'portafolios',
  },
  {
    label: 'COBERTURA ACTIVA',
    value: '—',
    icon: Shield,
    href: '/estrategias',
    featured: false,
    unit: 'posiciones',
  },
  {
    label: 'TRACK RECORD MES',
    value: '—',
    icon: BookOpen,
    href: '/estrategias',
    featured: false,
    unit: 'rendimiento',
  },
] as const

const MODULE_CARDS = [
  {
    label: 'INV-CAUSAL',
    title: 'Inversión Causal',
    description: 'Análisis de hipótesis y catalizadores con señales cuantitativas',
    href: '/inversion-causal',
    icon: TrendingUp,
    status: 'ACTIVO',
  },
  {
    label: 'PORTF',
    title: 'Portafolios Híbridos',
    description: 'Construcción y ponderación de portafolios multi-factor',
    href: '/portafolios',
    icon: BarChart2,
    status: 'ACTIVO',
  },
  {
    label: 'AGT-PPO',
    title: 'Agente PPO',
    description: 'Monitoreo continuo y rebalanceo automatizado con RL',
    href: '/agente-ppo',
    icon: Bot,
    status: 'ACTIVO',
  },
  {
    label: 'COB',
    title: 'Coberturas',
    description: 'Opciones financieras, futuros y estrategias de cobertura',
    href: '/estrategias',
    icon: Shield,
    status: 'ACTIVO',
  },
  {
    label: 'INF',
    title: 'Informes',
    description: 'Generación de reportes institucionales y exportación',
    href: '/recomendaciones',
    icon: FileText,
    status: 'ACTIVO',
  },
] as const

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={12} className="text-[#F59E0B]" />
            <span className="text-[10px] font-mono font-semibold tracking-[0.15em] text-[#F59E0B] uppercase">
              Sistema Activo
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AnimatedGradientText
              colorFrom="#F59E0B"
              colorTo="#F0EFE8"
              speed={0.5}
            >
              OVERVIEW
            </AnimatedGradientText>
          </h1>
          <p className="mt-0.5 text-xs text-[#64748b] font-mono tracking-wide">
            Departamento de Coberturas — Sistema de Análisis de Riesgos
          </p>
        </div>
        <Badge
          variant="outline"
          className="hidden sm:flex items-center gap-1.5 border-[#1e2035] bg-[#0f0f17] text-[#64748b] text-[10px] font-mono"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          LIVE
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, href, featured, unit }) => (
          <Link
            key={label}
            href={href}
            className="group relative rounded-lg border border-[#1e2035] bg-[#0f0f17] p-4 overflow-hidden transition-colors hover:border-[#F59E0B]/30 hover:bg-[#161622]"
          >
            {featured && (
              <BorderBeam
                colorFrom="#F59E0B"
                colorTo="#D97706"
                size={60}
                duration={4}
              />
            )}
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono font-semibold tracking-[0.15em] text-[#374151] uppercase">
                {label}
              </span>
              <Icon
                size={14}
                className="text-[#374151] group-hover:text-[#F59E0B] transition-colors"
              />
            </div>
            {/* Value */}
            <p className="text-3xl font-bold font-mono text-[#F0EFE8] tabular-nums">
              {value}
            </p>
            <p className="mt-1 text-[10px] text-[#374151] font-mono uppercase tracking-wide">
              {unit}
            </p>
          </Link>
        ))}
      </div>

      <Separator className="bg-[#1e2035]" />

      {/* Modules section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-[#374151]">
            MÓDULOS DEL SISTEMA
          </span>
          <div className="flex-1 h-px bg-[#1e2035]" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CARDS.map(({ label, title, description, href, icon: Icon, status }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-lg border border-[#1e2035] bg-[#0f0f17] p-4 transition-all hover:border-[#F59E0B]/30 hover:bg-[#161622]"
            >
              {/* Panel header strip */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-[#161622] group-hover:bg-[#F59E0B]/10 transition-colors">
                    <Icon size={12} className="text-[#64748b] group-hover:text-[#F59E0B] transition-colors" />
                  </div>
                  <span className="text-[9px] font-mono font-semibold tracking-[0.15em] text-[#374151] uppercase">
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-[#22c55e]" />
                  <span className="text-[8px] font-mono text-[#374151]">{status}</span>
                </div>
              </div>

              <p className="font-semibold text-sm text-[#F0EFE8] group-hover:text-white transition-colors">
                {title}
              </p>
              <p className="mt-1 text-xs text-[#64748b] leading-relaxed flex-1">
                {description}
              </p>

              <div className="mt-3 flex items-center gap-1 text-[#374151] group-hover:text-[#F59E0B] transition-colors">
                <span className="text-[10px] font-mono uppercase tracking-wide">
                  Abrir
                </span>
                <ArrowRight size={10} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
