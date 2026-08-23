'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { EquityChart } from '@/components/charts/EquityChart'
import { PnlBarChart } from '@/components/charts/PnlBarChart'
import { PortfolioPieChart, type PieSlice } from '@/components/charts/PortfolioPieChart'
import { fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import { BENCHMARK } from '@/lib/portafolios/config'
import type { ClosedTrade, CurveMetrics, EquitySeriesPoint, PortfolioMetrics, PortfolioPosition } from '@/lib/portafolios/types'
import { KpiCard, KpiRow } from './KpiCard'
import { PositionsTable } from './PositionsTable'
import { TrackRecordTable } from './TrackRecordTable'

interface Props {
  titulo: string
  subtitulo: string
  icono: LucideIcon
  /**
   * Acento de la sección, en hexadecimal literal: el marcado compone el fondo
   * y el borde del icono añadiendo la opacidad al final (`1a`, `33`), y eso no
   * funciona con `var(--color-*)` —el navegador descarta la regla entera—.
   */
  acento: string
  metrics: PortfolioMetrics
  curva: CurveMetrics
  serie: EquitySeriesPoint[]
  positions: PortfolioPosition[]
  trades: ClosedTrade[]
  slices: PieSlice[]
  excluidas: Array<{ ticker: string; motivo: string }>
  /** Etiqueta de las columnas de precio en el track record. */
  etiquetaPrecio?: string
  /** Nota al pie de la curva, para explicar cómo está construida. */
  notaCurva?: string
  escalonada?: boolean
  /** Explicación de qué representa cada porción del pastel. */
  notaPastel?: string
}

/**
 * Bloque completo de un portafolio: composición, curva contra el benchmark,
 * métricas, posiciones vivas y track record. Los dos portafolios comparten
 * estructura para que las cifras se lean en el mismo sitio en ambos.
 */
export function PortfolioSection({
  titulo, subtitulo, icono: Icono, acento, metrics, curva, serie,
  positions, trades, slices, excluidas, etiquetaPrecio, notaCurva, escalonada, notaPastel,
}: Props) {
  const [conCaja, setConCaja] = useState(false)

  const barras = positions
    .filter(p => p.pnl != null)
    .map(p => ({
      nombre: p.ticker,
      pnl: p.pnl!,
      detalle: `${p.agente} · ${p.abierta ? 'abierta' : 'cerrada'} · ${fmtPct(p.pnlPct)}`,
    }))

  return (
    <section className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center gap-3 border-l-2 pl-3" style={{ borderColor: acento }}>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${acento}1a`, border: `1px solid ${acento}33` }}
        >
          <Icono size={17} style={{ color: acento }} />
        </div>
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-text-primary">{titulo}</h2>
          <p className="text-xs text-text-secondary">{subtitulo}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="rounded-lg border border-border bg-surface-raised p-px">
        <KpiRow>
          <KpiCard
            label="Valor del portafolio"
            value={fmtUsd(metrics.valorTotal, 0)}
            sub={`Capital asignado ${fmtUsd(metrics.capital, 0)}`}
            acento={acento}
          />
          <KpiCard
            label="Resultado total"
            value={fmtUsd(metrics.pnlTotal, 0)}
            sub={fmtPct(metrics.rendimientoPct)}
            signo={metrics.pnlTotal}
          />
          <KpiCard
            label={`vs ${BENCHMARK}`}
            value={curva.rendimientoBenchmark != null
              ? fmtPct(metrics.rendimientoPct - curva.rendimientoBenchmark)
              : '—'}
            sub={curva.rendimientoBenchmark != null ? `${BENCHMARK} ${fmtPct(curva.rendimientoBenchmark)}` : 'sin histórico'}
            signo={curva.rendimientoBenchmark != null ? metrics.rendimientoPct - curva.rendimientoBenchmark : null}
            ayuda="Diferencia entre el rendimiento del portafolio y el del índice en el mismo periodo."
          />
          <KpiCard
            label="Realizado"
            value={fmtUsd(metrics.pnlRealizado, 0)}
            sub={`${metrics.posicionesCerradas} cerradas`}
            signo={metrics.pnlRealizado}
            ayuda="Resultado ya materializado en operaciones cerradas."
          />
          <KpiCard
            label="No realizado"
            value={fmtUsd(metrics.pnlNoRealizado, 0)}
            sub={`${metrics.posicionesAbiertas} abiertas`}
            signo={metrics.pnlNoRealizado}
            ayuda="Resultado latente de las posiciones que siguen vivas."
          />
          <KpiCard
            label="Win rate"
            value={metrics.winRate != null ? `${metrics.winRate.toFixed(0)}%` : '—'}
            sub={`${metrics.ganadoras}G / ${metrics.perdedoras}P`}
            acento={acento}
            ayuda="Porcentaje de operaciones cerradas con ganancia."
          />
          <KpiCard
            label="Profit factor"
            value={metrics.profitFactor != null ? metrics.profitFactor.toFixed(2) : '—'}
            sub="ganancias / pérdidas"
            acento={acento}
            ayuda="Suma de las ganancias dividida por la suma de las pérdidas. Por encima de 1 la estrategia gana dinero."
          />
          <KpiCard
            label="Max drawdown"
            value={`−${curva.maxDrawdown.toFixed(2)}%`}
            sub="peor caída desde máximos"
            acento="var(--color-negative)"
            ayuda="La mayor pérdida que habría sufrido quien entrase en el peor momento."
          />
          <KpiCard
            label="Sharpe"
            value={curva.sharpe != null ? curva.sharpe.toFixed(2) : '—'}
            sub={curva.sortino != null ? `Sortino ${curva.sortino.toFixed(2)}` : 'sin historia suficiente'}
            acento={acento}
            ayuda="Rentabilidad por unidad de riesgo, anualizada, sobre la tasa libre de riesgo."
          />
          <KpiCard
            label="Volatilidad"
            value={curva.volatilidadAnualizada != null ? `${curva.volatilidadAnualizada.toFixed(1)}%` : '—'}
            sub={curva.beta != null ? `Beta ${curva.beta.toFixed(2)}` : 'anualizada'}
            acento={acento}
            ayuda="Desviación típica anualizada de los retornos diarios."
          />
          <KpiCard
            label="Alfa anual"
            value={curva.alpha != null ? fmtPct(curva.alpha, 1) : '—'}
            sub={curva.informationRatio != null ? `IR ${curva.informationRatio.toFixed(2)}` : `vs ${BENCHMARK}`}
            signo={curva.alpha}
            ayuda="Rendimiento que no se explica por el movimiento del índice."
          />
          <KpiCard
            label="Capital libre"
            value={fmtUsd(metrics.caja, 0)}
            sub={`${fmtUsd(metrics.invertido, 0)} desplegados`}
            acento={acento}
            ayuda="Capital sin desplegar, incluido el producto de las ventas."
          />
          <KpiCard
            label="Días en cartera"
            value={metrics.diasMediosEnCartera != null ? metrics.diasMediosEnCartera.toFixed(0) : '—'}
            sub="media de las cerradas"
            acento={acento}
          />
          <KpiCard
            label="Mejor posición"
            value={metrics.mejor ? metrics.mejor.ticker : '—'}
            sub={metrics.mejor ? fmtUsd(metrics.mejor.pnl, 0) : undefined}
            signo={metrics.mejor?.pnl ?? null}
          />
          <KpiCard
            label="Peor posición"
            value={metrics.peor ? metrics.peor.ticker : '—'}
            sub={metrics.peor ? fmtUsd(metrics.peor.pnl, 0) : undefined}
            signo={metrics.peor?.pnl ?? null}
          />
        </KpiRow>
      </div>

      {/* Composición y curva */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Composición del portafolio
            </h3>
            {/* Con el capital libre dentro, unas pocas posiciones de tamaño fijo
                dejan el pastel casi entero en gris. Por defecto se reparte solo
                lo desplegado, y el interruptor devuelve la vista sobre el total. */}
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-[10px] text-text-secondary">
              <input
                type="checkbox"
                checked={conCaja}
                onChange={e => setConCaja(e.target.checked)}
                className="h-3 w-3 accent-accent"
              />
              Incluir capital libre
            </label>
          </div>
          <PortfolioPieChart
            slices={slices}
            caja={conCaja ? Math.max(0, metrics.caja) : 0}
            centro={fmtUsd(metrics.invertido, 0)}
            centroSub="DESPLEGADO"
          />
          {notaPastel && <p className="mt-3 text-[10px] leading-relaxed text-text-muted">{notaPastel}</p>}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
            Curva de resultados vs {BENCHMARK}
          </h3>
          <EquityChart
            serie={serie}
            benchmark={BENCHMARK}
            color={acento}
            nota={notaCurva}
            escalonada={escalonada}
          />
        </div>
      </div>

      {/* Resultado por posición */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
          Resultado por posición
        </h3>
        <PnlBarChart barras={barras} />
      </div>

      {/* Exclusiones */}
      {excluidas.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-muted bg-accent-muted px-3 py-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-text-primary" />
          <p className="text-[11px] leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">
              {excluidas.length} recomendación(es) fuera del portafolio.
            </span>{' '}
            No se pueden valorar con datos fiables y contarlas distorsionaría el track record:{' '}
            {excluidas.map(e => `${e.ticker} (${e.motivo})`).join(', ')}.
          </p>
        </div>
      )}

      {/* Tablas */}
      <div className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
          Posiciones abiertas
        </h3>
        <PositionsTable positions={positions} total={metrics.invertido + metrics.pnlNoRealizado} />
      </div>

      <div className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
          Track record · operaciones cerradas
        </h3>
        <TrackRecordTable trades={trades} etiquetaPrecio={etiquetaPrecio} />
      </div>
    </section>
  )
}
