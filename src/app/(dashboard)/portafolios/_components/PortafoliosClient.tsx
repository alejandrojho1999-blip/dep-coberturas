'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Briefcase, Loader2, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import type { PieSlice } from '@/components/charts/PortfolioPieChart'
import { fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import { BENCHMARK, CAPITAL_ACCIONES, CAPITAL_OPCIONES, TICKET_ACCIONES } from '@/lib/portafolios/config'
import { buildOptionPositions, buildStockPositions } from '@/lib/portafolios/positions'
import {
  alignSeries, buildBenchmarkCurve, buildOptionEquityCurve, buildStockEquityCurve, ejeTemporal, primeraEntrada,
} from '@/lib/portafolios/equity'
import { buildClosedTrades, computeCurveMetrics, computeMetrics } from '@/lib/portafolios/metrics'
import type { PortfolioPosition } from '@/lib/portafolios/types'
import { KpiCard, KpiRow } from './KpiCard'
import { PortfolioSection } from './PortfolioSection'
import { QuantPortfolioSection } from './QuantPortfolioSection'
import type { BacktestCartera } from '@/lib/estrategias/types'
import { useLivePortfolio } from './useLivePortfolio'

const NOTA_CURVA_ACCIONES =
  'Curva reconstruida día a día con los cierres reales de cada acción desde su fecha de recomendación. ' +
  'El capital sin desplegar permanece en caja y el importe de cada venta vuelve a ella.'

const NOTA_CURVA_OPCIONES =
  'Curva escalonada: Yahoo no publica histórico de primas, así que la línea solo se mueve cuando un ' +
  'contrato se liquida con su resultado real. El último tramo incorpora el valor de mercado de hoy de ' +
  'las posiciones abiertas.'

const NOTA_PASTEL_ACCIONES =
  `Cada posición se abre con ${fmtUsd(TICKET_ACCIONES, 0)} y la porción refleja su valor de mercado actual. ` +
  'Al vender el agente una posición, desaparece de este gráfico y pasa al track record.'

const NOTA_PASTEL_OPCIONES =
  'La porción mide el capital que cada contrato inmoviliza: la prima pagada en las compras de Gamma, ' +
  'y el colateral que respalda la obligación en las ventas de Theta (efectivo del strike en un put ' +
  'asegurado, valor de las acciones en una call cubierta).'

type Tab = 'acciones' | 'opciones' | 'futuros'

// El punto de color de cada pestaña es el mismo acento que usa el bloque que
// abre, para que la pestaña y su contenido no se lean como cosas distintas.
const TABS: { key: Tab; label: string; accent: string }[] = [
  { key: 'acciones', label: 'ACCIONES', accent: 'var(--color-positive)' },
  { key: 'opciones', label: 'OPCIONES', accent: 'var(--color-info)' },
  { key: 'futuros', label: 'PORTAFOLIO DE FUTUROS', accent: 'var(--color-accent)' },
]

function esTab(valor: string | null): valor is Tab {
  return TABS.some(t => t.key === valor)
}

export default function PortafoliosClient({ cartera }: { cartera: BacktestCartera | null }) {
  const { recs, livePrices, primas, closes, cargando, error, actualizado, refrescar } = useLivePortfolio()

  // Quien llega desde `/estrategias` pide directamente el portafolio de futuros.
  // El parámetro solo se lee al montar —cambiar de pestaña no toca la URL—, y
  // frente al hash tiene la ventaja de que el servidor lo ve, así que no hay
  // desajuste de hidratación.
  const tabInicial = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>(esTab(tabInicial) ? tabInicial : 'acciones')

  const acciones = useMemo(
    () => buildStockPositions(recs, livePrices, closes),
    [recs, livePrices, closes]
  )
  const opciones = useMemo(() => buildOptionPositions(recs, primas), [recs, primas])

  const metricsAcciones = useMemo(
    () => computeMetrics(acciones.positions, CAPITAL_ACCIONES),
    [acciones.positions]
  )
  const metricsOpciones = useMemo(
    () => computeMetrics(opciones.positions, CAPITAL_OPCIONES),
    [opciones.positions]
  )

  // Eje temporal común: las sesiones del benchmark desde la primera entrada de
  // cualquiera de los dos portafolios, para que las dos curvas sean comparables.
  const eje = useMemo(() => {
    const inicio = primeraEntrada([
      ...acciones.positions.map(p => p.fechaEntrada),
      ...opciones.positions.map(p => p.fechaEntrada),
    ])
    if (!inicio) return []
    return ejeTemporal(closes[BENCHMARK] ?? [], inicio)
  }, [acciones.positions, opciones.positions, closes])

  const serieAcciones = useMemo(() => alignSeries(
    buildStockEquityCurve(acciones.positions, closes, CAPITAL_ACCIONES, eje),
    buildBenchmarkCurve(closes[BENCHMARK] ?? [], CAPITAL_ACCIONES, eje),
  ), [acciones.positions, closes, eje])

  const serieOpciones = useMemo(() => alignSeries(
    buildOptionEquityCurve(opciones.positions, CAPITAL_OPCIONES, eje),
    buildBenchmarkCurve(closes[BENCHMARK] ?? [], CAPITAL_OPCIONES, eje),
  ), [opciones.positions, closes, eje])

  const curvaAcciones = useMemo(() => computeCurveMetrics(serieAcciones), [serieAcciones])
  const curvaOpciones = useMemo(() => computeCurveMetrics(serieOpciones), [serieOpciones])

  const tradesAcciones = useMemo(() => buildClosedTrades(acciones.positions), [acciones.positions])
  const tradesOpciones = useMemo(() => buildClosedTrades(opciones.positions), [opciones.positions])

  const slices = (positions: PortfolioPosition[]): PieSlice[] => positions
    .filter(p => p.abierta)
    .map(p => ({
      nombre: p.ticker,
      valor: p.valorActual ?? p.capitalComprometido,
      detalle: `${p.agente} · ${fmtPct(p.pnlPct)}`,
    }))

  // ── Consolidado ────────────────────────────────────────────────────────
  const capitalTotal = CAPITAL_ACCIONES + CAPITAL_OPCIONES
  const pnlTotal = metricsAcciones.pnlTotal + metricsOpciones.pnlTotal
  const valorTotal = metricsAcciones.valorTotal + metricsOpciones.valorTotal
  const rendimientoTotal = (pnlTotal / capitalTotal) * 100
  const benchmarkPct = curvaAcciones.rendimientoBenchmark ?? curvaOpciones.rendimientoBenchmark
  const abiertasTotal = metricsAcciones.posicionesAbiertas + metricsOpciones.posicionesAbiertas
  const cerradasTotal = metricsAcciones.posicionesCerradas + metricsOpciones.posicionesCerradas

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'rgba(0, 61, 102,0.1)', border: '1px solid rgba(0, 61, 102,0.2)' }}
          >
            <Briefcase size={20} style={{ color: 'var(--color-text-primary)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Portafolios</h1>
            <p className="text-sm text-text-secondary">
              SynerGy — Portafolios Algorítmicos de Acciones, Opciones y Futuros
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actualizado && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Actualizado {actualizado.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={refrescar}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent-muted hover:text-text-primary"
          >
            {cargando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refrescar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-negative-soft bg-negative-soft px-4 py-3 text-xs text-negative">
          No se pudieron cargar las recomendaciones: {error}
        </div>
      )}

      {/* Consolidado */}
      <section className="rounded-xl border border-border bg-surface-raised p-px">
        <div className="rounded-t-xl bg-surface px-4 py-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-primary">
            Consolidado · ambos portafolios
          </h2>
        </div>
        <KpiRow>
          <KpiCard
            label="Capital gestionado"
            value={fmtUsd(capitalTotal, 0)}
            sub={`${fmtUsd(CAPITAL_ACCIONES, 0)} acciones + ${fmtUsd(CAPITAL_OPCIONES, 0)} opciones`}
            acento="var(--color-text-primary)"
          />
          <KpiCard label="Valor actual" value={fmtUsd(valorTotal, 0)} sub="capital + resultados" acento="var(--color-text-primary)" />
          <KpiCard label="Resultado global" value={fmtUsd(pnlTotal, 0)} sub={fmtPct(rendimientoTotal)} signo={pnlTotal} />
          <KpiCard
            label={`vs ${BENCHMARK}`}
            value={benchmarkPct != null ? fmtPct(rendimientoTotal - benchmarkPct) : '—'}
            sub={benchmarkPct != null ? `${BENCHMARK} ${fmtPct(benchmarkPct)}` : 'sin histórico'}
            signo={benchmarkPct != null ? rendimientoTotal - benchmarkPct : null}
          />
          <KpiCard
            label="Operaciones"
            value={`${abiertasTotal + cerradasTotal}`}
            sub={`${abiertasTotal} abiertas · ${cerradasTotal} cerradas`}
            acento="var(--color-text-primary)"
          />
        </KpiRow>
      </section>

      {/* Pestañas: mismo patrón que la sección Agentes */}
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

      {/* El bloque de futuros es estático y no depende de useLivePortfolio, así
          que se muestra aunque falle la carga de recomendaciones. */}
      {tab === 'futuros' ? (
        <QuantPortfolioSection datos={cartera} />
      ) : cargando && recs.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface py-20 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" />
          Cargando recomendaciones de los agentes…
        </div>
      ) : tab === 'acciones' ? (
        <PortfolioSection
          titulo="Portafolio algorítmico de acciones"
          subtitulo={`Agentes Peter y Small · ${fmtUsd(TICKET_ACCIONES, 0)} por recomendación`}
          icono={TrendingUp}
          acento="var(--color-positive)"
          metrics={metricsAcciones}
          curva={curvaAcciones}
          serie={serieAcciones}
          positions={acciones.positions}
          trades={tradesAcciones}
          slices={slices(acciones.positions)}
          excluidas={acciones.excluidas}
          etiquetaPrecio="Precio"
          notaCurva={NOTA_CURVA_ACCIONES}
          notaPastel={NOTA_PASTEL_ACCIONES}
        />
      ) : (
        <PortfolioSection
          titulo="Portafolio algorítmico de opciones"
          subtitulo="Agentes Gamma y Theta · 1 contrato por señal (100 acciones)"
          icono={Zap}
          acento="var(--color-info)"
          metrics={metricsOpciones}
          curva={curvaOpciones}
          serie={serieOpciones}
          positions={opciones.positions}
          trades={tradesOpciones}
          slices={slices(opciones.positions)}
          excluidas={opciones.excluidas}
          etiquetaPrecio="Prima"
          notaCurva={NOTA_CURVA_OPCIONES}
          escalonada
          notaPastel={NOTA_PASTEL_OPCIONES}
        />
      )}

      {/* Supuestos: la cartera es derivada, conviene dejar las reglas a la vista */}
      <section className="rounded-lg border border-border bg-surface px-4 py-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
          Supuestos de los portafolios
        </h3>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-text-secondary">
          <li>· Capital asignado: {fmtUsd(CAPITAL_ACCIONES, 0)} a acciones y {fmtUsd(CAPITAL_OPCIONES, 0)} a opciones.</li>
          <li>· Acciones: {fmtUsd(TICKET_ACCIONES, 0)} por recomendación, en cantidad fraccional al precio de entrada del agente.</li>
          <li>· Opciones: 1 contrato por señal, equivalente a 100 acciones del subyacente.</li>
          <li>· Benchmark: {BENCHMARK}, normalizado al mismo capital para que las curvas arranquen del mismo punto.</li>
          <li>· Cifras brutas: no se descuentan comisiones de rendimiento ni costes de transacción.</li>
          <li>· Las posiciones se derivan en vivo de las recomendaciones: al vender un agente, la posición sale de los gráficos y entra en el track record.</li>
        </ul>
      </section>
    </div>
  )
}
