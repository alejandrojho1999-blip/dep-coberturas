'use client'

import { useState } from 'react'
import { Cpu } from 'lucide-react'
import AgentePeter from './AgentePeter'
import AgenteSmall from './AgenteSmall'
import AgenteGamma from './AgenteGamma'
import AgenteTheta from './AgenteTheta'
import { AGENT_COLORS } from '@/components/charts/chart-theme'

type Tab = 'peter' | 'small' | 'gamma' | 'theta'

// El color de cada agente vive en chart-theme para que pestañas y gráficos no
// se desincronicen.
const TABS: { key: Tab; label: string; accent: string }[] = [
  { key: 'peter', label: 'AGENTE PETER', accent: AGENT_COLORS.Peter },
  { key: 'small', label: 'AGENTE SMALL', accent: AGENT_COLORS.Small },
  { key: 'gamma', label: 'AGENTE GAMMA', accent: AGENT_COLORS.Gamma },
  { key: 'theta', label: 'AGENTE THETA', accent: AGENT_COLORS.Theta },
]

export default function AgentesClient() {
  const [tab, setTab] = useState<Tab>('peter')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Cpu size={20} className="text-on-accent" />
        </div>
        <div>
          <h1 className="font-brand text-lg font-extrabold text-text-primary">Agentes</h1>
          <p className="text-sm text-text-secondary">SynerGy — Agentes IA para Acciones y Opciones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-background p-1 w-fit">
        {TABS.map(({ key, label, accent }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={[
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold font-mono transition-all',
              tab === key
                ? 'bg-accent text-on-accent'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
            ].join(' ')}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: accent }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* Agent panel */}
      {tab === 'peter' ? <AgentePeter />
        : tab === 'small' ? <AgenteSmall />
        : tab === 'gamma' ? <AgenteGamma />
        : <AgenteTheta />}
    </div>
  )
}
