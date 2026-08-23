'use client'

import { fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import { BENCHMARK } from '@/lib/portafolios/config'
import type { PortfolioMetrics } from '@/lib/portafolios/types'
import { KpiCard, KpiRow } from './KpiCard'

interface Props {
  /** Encabezado en versalitas del bloque, p. ej. «Cartera de opciones cortas». */
  titulo: string
  /** Línea bajo el capital: de dónde sale y a qué agente responde. */
  subCapital: string
  metrics: PortfolioMetrics
  /** Rendimiento del índice en el mismo periodo, o null si aún no hay histórico. */
  benchmarkPct: number | null
}

/**
 * Resumen de una cartera en vivo, el bloque que abre su pestaña.
 *
 * Cada pestaña muestra el suyo: acciones, opciones largas y opciones cortas
 * tienen capitales distintos y sumarlas en un consolidado escondía justo lo que
 * hay que mirar, que es cómo se comporta cada una con el capital que gestiona.
 *
 * Todas las cifras llegan calculadas de `computeMetrics` y `computeCurveMetrics`.
 */
export function ResumenCartera({ titulo, subCapital, metrics, benchmarkPct }: Props) {
  const diferencia = benchmarkPct != null ? metrics.rendimientoPct - benchmarkPct : null

  return (
    <section className="rounded-xl border border-border bg-surface-raised p-px">
      <div className="rounded-t-xl bg-surface px-4 py-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-primary">
          {titulo}
        </h2>
      </div>
      <KpiRow>
        <KpiCard
          label="Capital gestionado"
          value={fmtUsd(metrics.capital, 0)}
          sub={subCapital}
          acento="var(--color-text-primary)"
        />
        <KpiCard
          label="Valor actual"
          value={fmtUsd(metrics.valorTotal, 0)}
          sub="capital + resultados"
          acento="var(--color-text-primary)"
        />
        <KpiCard
          label="Resultado global"
          value={fmtUsd(metrics.pnlTotal, 0)}
          sub={fmtPct(metrics.rendimientoPct)}
          signo={metrics.pnlTotal}
        />
        <KpiCard
          label={`vs ${BENCHMARK}`}
          value={diferencia != null ? fmtPct(diferencia) : '—'}
          sub={benchmarkPct != null ? `${BENCHMARK} ${fmtPct(benchmarkPct)}` : 'sin histórico'}
          signo={diferencia}
        />
        <KpiCard
          label="Operaciones"
          value={`${metrics.posicionesAbiertas + metrics.posicionesCerradas}`}
          sub={`${metrics.posicionesAbiertas} abiertas · ${metrics.posicionesCerradas} cerradas`}
          acento="var(--color-text-primary)"
        />
      </KpiRow>
    </section>
  )
}
