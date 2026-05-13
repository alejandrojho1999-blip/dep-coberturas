'use client'

import { useState } from 'react'
import { Cpu } from 'lucide-react'
import AgentePeter from './AgentePeter'
import AgenteSmall from './AgenteSmall'

type Tab = 'peter' | 'small'

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
          <p className="text-sm text-[#64748b]">Emporium Quality Funds — Agentes Autónomos de Inversión</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#1e1e2e] bg-[#0d0d14] p-1 w-fit">
        {([
          { key: 'peter', label: 'AGENTE PETER' },
          { key: 'small', label: 'AGENTE SMALL CAP' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="rounded-lg px-4 py-2 text-xs font-semibold font-mono transition-all"
            style={
              tab === key
                ? { background: 'rgba(0,255,136,0.15)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }
                : { color: '#64748b', border: '1px solid transparent' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Agent panel */}
      {tab === 'peter' ? <AgentePeter /> : <AgenteSmall />}
    </div>
  )
}
