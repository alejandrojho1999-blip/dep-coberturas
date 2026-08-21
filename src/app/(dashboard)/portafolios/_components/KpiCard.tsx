'use client'

import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  /** Línea secundaria bajo el valor. */
  sub?: string
  /** Colorea el valor según el signo: verde positivo, rojo negativo. */
  signo?: number | null
  /** Explicación al pasar el ratón, para las métricas menos obvias. */
  ayuda?: string
  acento?: string
}

/**
 * Tarjeta de métrica. Hasta ahora cada pantalla escribía la suya inline; esta
 * es la versión compartida, con el estilo del optimizador de ERGOS.
 */
export function KpiCard({ label, value, sub, signo, ayuda, acento }: Props) {
  const color = signo == null || signo === 0
    ? (acento ?? '#e2e8f0')
    : (signo > 0 ? '#22c55e' : '#ef4444')

  return (
    <div className="bg-[#0f0f17] px-4 py-3" title={ayuda}>
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#475569]">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[#475569]">{sub}</p>}
    </div>
  )
}

/** Rejilla de tarjetas con separación por bordes, no por márgenes. */
export function KpiRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-[#1e2035] p-px sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  )
}
