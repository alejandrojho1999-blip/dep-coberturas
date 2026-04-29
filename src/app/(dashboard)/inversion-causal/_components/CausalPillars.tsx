'use client'

import { useState } from 'react'
import type { CausalConfig } from '@/lib/causal/types'

interface Props {
  config: CausalConfig
  onCardClick?: (pillarId: string) => void
}

interface Pillar {
  id: string
  label: string
  icon: string
  borderColor: string
  accentColor: string
  glowColor: string
  badgeBg: string
  badgeText: string
  vars: string[]
  subtitle?: string
}

export default function CausalPillars({ config, onCardClick }: Props) {
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set())
  const colliders = Object.keys(config.excluded ?? {})

  const pillars: Pillar[] = [
    {
      id: 'treatment',
      label: 'Tratamiento',
      icon: '⚡',
      borderColor: 'border-[#3b82f6]/60',
      accentColor: 'text-[#3b82f6]',
      glowColor: 'shadow-[#3b82f6]/10',
      badgeBg: 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/20',
      badgeText: 'Cuasi-Exógeno',
      vars: [config.treatment],
      subtitle: 'Variable causal',
    },
    {
      id: 'outcome',
      label: 'Resultado',
      icon: '📈',
      borderColor: 'border-[#00ff88]/60',
      accentColor: 'text-[#00ff88]',
      glowColor: 'shadow-[#00ff88]/10',
      badgeBg: 'bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/20',
      badgeText: `t+${config.horizon}Q`,
      vars: [config.outcome],
      subtitle: `${config.horizon} trimestres`,
    },
    {
      id: 'confounders',
      label: 'Confusores',
      icon: '🌀',
      borderColor: 'border-[#f59e0b]/60',
      accentColor: 'text-[#f59e0b]',
      glowColor: 'shadow-[#f59e0b]/10',
      badgeBg: 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20',
      badgeText: `${config.confounders.length} var${config.confounders.length !== 1 ? 's' : ''}`,
      vars: config.confounders.length > 0 ? config.confounders : ['—'],
      subtitle: 'Controlar',
    },
    {
      id: 'colliders',
      label: 'Colisionadores',
      icon: '⛔',
      borderColor: 'border-[#ef4444]/60',
      accentColor: 'text-[#ef4444]',
      glowColor: 'shadow-[#ef4444]/10',
      badgeBg: 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/20',
      badgeText: `${colliders.length} excl.`,
      vars: colliders.length > 0 ? colliders : ['—'],
      subtitle: 'Excluir del ajuste',
    },
  ]

  function toggleExpanded(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedPillars((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const PREVIEW_LIMIT = 3

  return (
    <div className="grid grid-cols-2 gap-3 p-4 border-b border-[#1e1e2e] lg:grid-cols-4">
      {pillars.map((pillar) => {
        const isExpanded = expandedPillars.has(pillar.id)
        const visibleVars = isExpanded ? pillar.vars : pillar.vars.slice(0, PREVIEW_LIMIT)
        const hiddenCount = pillar.vars.length - PREVIEW_LIMIT
        const isClickable = Boolean(onCardClick)

        return (
          <div
            key={pillar.id}
            onClick={() => onCardClick?.(pillar.id)}
            className={`group relative rounded-xl border ${pillar.borderColor} bg-[#0a0a0f] p-4 space-y-3 shadow-lg ${pillar.glowColor} transition-all duration-150 ${
              isClickable
                ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:brightness-110 active:scale-[0.98]'
                : ''
            }`}
          >
            {/* Edit hint — visible on hover */}
            {isClickable && (
              <span
                className="absolute top-2.5 right-2.5 text-[10px] opacity-0 group-hover:opacity-50 transition-opacity select-none"
                aria-hidden
              >
                ✏️
              </span>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-lg leading-none">{pillar.icon}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide ${pillar.badgeBg}`}>
                {pillar.badgeText}
              </span>
            </div>

            {/* Label & subtitle */}
            <div>
              <div className={`text-xs font-bold uppercase tracking-widest ${pillar.accentColor}`}>
                {pillar.label}
              </div>
              {pillar.subtitle && (
                <div className="text-[10px] text-[#475569] mt-0.5">{pillar.subtitle}</div>
              )}
            </div>

            {/* Variables */}
            <div className="space-y-1.5">
              {visibleVars.map((v) => (
                <div
                  key={v}
                  className={`text-xs font-mono px-2 py-1 rounded-md truncate ${
                    v === '—' ? 'text-[#334155]' : pillar.accentColor
                  }`}
                >
                  {v === '—' ? <span className="text-[#334155]">—</span> : <span>{v}</span>}
                </div>
              ))}

              {/* "+N más" expandible */}
              {!isExpanded && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => toggleExpanded(pillar.id, e)}
                  className={`text-[10px] pl-2 hover:underline cursor-pointer transition-colors ${pillar.accentColor} opacity-60 hover:opacity-100`}
                >
                  +{hiddenCount} más
                </button>
              )}
              {isExpanded && pillar.vars.length > PREVIEW_LIMIT && (
                <button
                  type="button"
                  onClick={(e) => toggleExpanded(pillar.id, e)}
                  className="text-[10px] pl-2 text-[#475569] hover:text-[#e2e8f0] cursor-pointer transition-colors"
                >
                  Colapsar
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
