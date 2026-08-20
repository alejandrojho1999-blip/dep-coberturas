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
          <LineChart size={20} style={{ color: '#38bdf8' }} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">Estrategias</h1>
          <p className="text-sm text-[#64748b]">
            Emporium Quality Funds — Estrategias para Trading de Futuros
          </p>
        </div>
      </div>

      {/* Placeholder */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-[#1e2035] bg-[#0f0f17] px-6 py-20 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: 'rgba(245,158,11,0.1)' }}
        >
          <Construction size={22} style={{ color: '#F59E0B' }} />
        </div>
        <div>
          <p className="text-sm font-medium text-[#94a3b8]">Sección en construcción</p>
          <p className="mt-1 max-w-md text-xs text-[#475569]">
            Aquí se implementarán las estrategias para trading de futuros.
          </p>
        </div>
      </div>
    </div>
  )
}
