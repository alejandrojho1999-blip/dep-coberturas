'use client'

import { useState } from 'react'
import SignalsTable from './SignalsTable'
import PortfolioOptimizer from './PortfolioOptimizer'
import PpoAgent from './PpoAgent'

const TABS = [
  { id: 'signals',   label: 'M1 — Señales Causales' },
  { id: 'portfolio', label: 'M2 — Portfolio' },
  { id: 'ppo',       label: 'M3 — PPO Agent' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ErgoQuantClient() {
  const [active, setActive] = useState<TabId>('signals')

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(0, 61, 102,0.08)', border: '1px solid rgba(0, 61, 102,0.2)' }}
        >
          ⚛
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary font-mono">ERGOS QUANT</h1>
          <p className="text-xs text-text-muted">Sistema de Inversión Causal — powered by ERGO-Quant</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={[
              'px-4 py-2 text-xs font-semibold font-mono tracking-wide transition-colors',
              active === tab.id
                ? 'border-b-2 border-accent text-positive'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === 'signals'   && <SignalsTable />}
      {active === 'portfolio' && <PortfolioOptimizer />}
      {active === 'ppo'       && <PpoAgent />}
    </div>
  )
}
