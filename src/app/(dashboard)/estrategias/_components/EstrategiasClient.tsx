'use client'

import { Construction, LineChart } from 'lucide-react'

export default function EstrategiasClient() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}
        >
          <LineChart size={20} style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Estrategias</h1>
          <p className="text-sm text-text-secondary">
            SynerGy — Estrategias para Trading de Futuros
          </p>
        </div>
      </div>

      {/* Placeholder */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface px-6 py-20 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: 'rgba(0, 61, 102,0.1)' }}
        >
          <Construction size={22} style={{ color: 'var(--color-warning)' }} />
        </div>
        <div>
          <p className="text-sm font-medium text-text-secondary">Sección en construcción</p>
          <p className="mt-1 max-w-md text-xs text-text-muted">
            Aquí se implementarán las estrategias para trading de futuros.
          </p>
        </div>
      </div>
    </div>
  )
}
