'use client'

import { useState } from 'react'
import { Cpu } from 'lucide-react'
import AgentePeter from './AgentePeter'
import AgenteSmall from './AgenteSmall'
import AgenteGamma from './AgenteGamma'
import AgenteTheta from './AgenteTheta'

type Tab = 'peter' | 'small' | 'gamma' | 'theta'

const TABS: { key: Tab; label: string; accent: string }[] = [
  { key: 'peter', label: 'AGENTE PETER',    accent: '#00ff88' },
  { key: 'small', label: 'AGENTE SMALL', accent: '#00ff88' },
  { key: 'gamma', label: 'AGENTE GAMMA',    accent: '#a78bfa' },
  { key: 'theta', label: 'AGENTE THETA',    accent: '#fb923c' },
]

export default function AgentesClient() {
  const [tab, setTab] = useState<Tab>('peter')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}
        >
          <Cpu size={20} style={{ color: '#00ff88' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">Agentes</h1>
          <p className="text-sm text-[#64748b]">Emporium Quality Funds — Agentes IA para Acciones y Opciones</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[#1e1e2e] bg-[#0d0d14] p-1 w-fit">
        {TABS.map(({ key, label, accent }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="rounded-lg px-4 py-2 text-xs font-semibold font-mono transition-all"
            style={
              tab === key
                ? { background: `${accent}26`, color: accent, border: `1px solid ${accent}4d` }
                : { color: '#64748b', border: '1px solid transparent' }
            }
          >
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
