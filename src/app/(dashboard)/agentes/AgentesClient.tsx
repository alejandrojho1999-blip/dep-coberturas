'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cpu, FlaskConical } from 'lucide-react'
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

export default function AgentesClient(
  { puedeEjecutar = false }: { puedeEjecutar?: boolean }
) {
  const [tab, setTab] = useState<Tab>('peter')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Cpu size={20} className="text-on-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-brand text-lg font-extrabold text-text-primary">Agentes</h1>
          <p className="text-sm text-text-secondary">SynerGy — Agentes IA para Acciones y Opciones</p>
        </div>
        {/* El backtest vive en su propia pantalla: son cuatro variantes con sus
            contrastes, y meterlo en una pestaña de agente invitaría a leer el
            resultado de uno como si valiera para los cuatro. */}
        <Link
          href="/agentes/backtest"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <FlaskConical size={13} /> Backtest
        </Link>
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
      {tab === 'peter' ? <AgentePeter puedeEjecutar={puedeEjecutar} />
        : tab === 'small' ? <AgenteSmall puedeEjecutar={puedeEjecutar} />
        : tab === 'gamma' ? <AgenteGamma puedeEjecutar={puedeEjecutar} />
        : <AgenteTheta puedeEjecutar={puedeEjecutar} />}
    </div>
  )
}
