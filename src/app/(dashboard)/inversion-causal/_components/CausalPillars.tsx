'use client'

import type { CausalConfig } from '@/lib/causal/types'

interface Props {
  config: CausalConfig
}

interface Pillar {
  id: string
  label: string
  icon: string
  border: string
  iconBg: string
  badge: string
  badgeText: string
  vars: string[]
  subtitle?: string
}

export default function CausalPillars({ config }: Props) {
  const colliders = Object.keys(config.excluded ?? {})

  const pillars: Pillar[] = [
    {
      id: 'treatment',
      label: 'Tratamiento',
      icon: '⚡',
      border: 'border-[#3b82f6]',
      iconBg: 'bg-[#3b82f6]/10 text-[#3b82f6]',
      badge: 'bg-[#3b82f6]/20 text-[#3b82f6]',
      badgeText: 'Exógeno',
      vars: [config.treatment],
    },
    {
      id: 'outcome',
      label: 'Resultados',
      icon: '📈',
      border: 'border-[#00ff88]',
      iconBg: 'bg-[#00ff88]/10 text-[#00ff88]',
      badge: 'bg-[#00ff88]/20 text-[#00ff88]',
      badgeText: `t+${config.horizon}Q`,
      vars: [config.outcome],
      subtitle: `Horizonte: ${config.horizon} trimestres`,
    },
    {
      id: 'confounders',
      label: 'Confusores',
      icon: '🌀',
      border: 'border-[#f59e0b]',
      iconBg: 'bg-[#f59e0b]/10 text-[#f59e0b]',
      badge: 'bg-[#f59e0b]/20 text-[#f59e0b]',
      badgeText: 'Controlar',
      vars: config.confounders,
    },
    {
      id: 'colliders',
      label: 'Colisionadores',
      icon: '⛔',
      border: 'border-[#ef4444]',
      iconBg: 'bg-[#ef4444]/10 text-[#ef4444]',
      badge: 'bg-[#ef4444]/20 text-[#ef4444]',
      badgeText: 'Excluir',
      vars: colliders.length > 0 ? colliders : ['—'],
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 p-4 border-b border-[#1e1e2e] sm:grid-cols-2 lg:grid-cols-4">
      {pillars.map((pillar) => (
        <div
          key={pillar.id}
          className={`rounded-xl border ${pillar.border} bg-[#0a0a0f] p-3 space-y-2`}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className={`text-base w-7 h-7 flex items-center justify-center rounded-lg ${pillar.iconBg}`}>
              {pillar.icon}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pillar.badge}`}>
              {pillar.badgeText}
            </span>
          </div>

          {/* Title */}
          <div>
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
              {pillar.label}
            </div>
            {pillar.subtitle && (
              <div className="text-xs text-[#64748b] mt-0.5">{pillar.subtitle}</div>
            )}
          </div>

          {/* Variables */}
          <div className="space-y-1">
            {pillar.vars.slice(0, 5).map((v) => (
              <div key={v} className="text-xs font-mono text-[#e2e8f0] truncate">
                {v}
              </div>
            ))}
            {pillar.vars.length > 5 && (
              <div className="text-xs text-[#64748b]">+{pillar.vars.length - 5} más</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
