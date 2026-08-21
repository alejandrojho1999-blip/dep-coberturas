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
            <Activity size={12} className="text-text-primary" />
            <span className="text-[10px] font-mono font-semibold tracking-[0.15em] text-text-primary uppercase">
              Sistema Activo
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AnimatedGradientText
              colorFrom="#4d95d0"
              colorTo="#ffffff"
              speed={0.5}
            >
              OVERVIEW
            </AnimatedGradientText>
          </h1>
          <p className="mt-0.5 text-xs text-text-secondary font-mono tracking-wide">
            SynerGy — Agentes, Estrategias y Portafolios Algorítmicos
          </p>
        </div>
        <Badge
          variant="outline"
          className="hidden sm:flex items-center gap-1.5 border-border bg-surface text-text-secondary text-[10px] font-mono"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
          LIVE
        </Badge>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, href, featured, unit }) => (
          <Link
            key={label}
            href={href}
            className="group relative rounded-lg border border-border bg-surface p-4 overflow-hidden transition-colors hover:border-accent/30 hover:bg-surface-raised"
          >
            {featured && (
              <BorderBeam
                colorFrom="#4d95d0"
                colorTo="#003d66"
                size={60}
                duration={4}
              />
            )}
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-mono font-semibold tracking-[0.15em] text-text-muted uppercase">
                {label}
              </span>
              <Icon
                size={14}
                className="text-text-muted group-hover:text-text-primary transition-colors"
              />
            </div>
            {/* Value */}
            <p className="text-3xl font-bold font-mono text-text-primary tabular-nums">
              {value}
            </p>
            <p className="mt-1 text-[10px] text-text-muted font-mono uppercase tracking-wide">
              {unit}
            </p>
          </Link>
        ))}
      </div>

      <Separator className="bg-surface-raised" />

      {/* Modules section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-text-muted">
            MÓDULOS DEL SISTEMA
          </span>
          <div className="flex-1 h-px bg-surface-raised" />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CARDS.map(({ label, title, description, href, icon: Icon, status }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col rounded-lg border border-border bg-surface p-4 transition-all hover:border-accent/30 hover:bg-surface-raised"
            >
              {/* Panel header strip */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-surface-raised group-hover:bg-accent/10 transition-colors">
                    <Icon size={12} className="text-text-secondary group-hover:text-text-primary transition-colors" />
                  </div>
                  <span className="text-[9px] font-mono font-semibold tracking-[0.15em] text-text-muted uppercase">
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-positive" />
                  <span className="text-[8px] font-mono text-text-muted">{status}</span>
                </div>
              </div>

              <p className="font-semibold text-sm text-text-primary group-hover:text-white transition-colors">
                {title}
              </p>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed flex-1">
                {description}
              </p>

              <div className="mt-3 flex items-center gap-1 text-text-muted group-hover:text-text-primary transition-colors">
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
