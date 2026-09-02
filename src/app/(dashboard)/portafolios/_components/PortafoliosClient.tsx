'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Briefcase, Coins, Loader2, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import type { PieSlice } from '@/components/charts/PortfolioPieChart'
import { fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import {
  BENCHMARK,
  CAPITAL_ACCIONES,
  CAPITAL_OPCIONES_CORTAS,
  CAPITAL_OPCIONES_LARGAS,
  OPTION_LONG_CATEGORIES,
  OPTION_SHORT_CATEGORIES,
  TICKET_ACCIONES,
} from '@/lib/portafolios/config'
import { accionesPorTicker, buildOptionPositions, buildStockPositions } from '@/lib/portafolios/positions'
import {
  alignSeries, buildBenchmarkCurve, buildOptionEquityCurve, buildStockEquityCurve, ejeTemporal, primeraEntrada,
} from '@/lib/portafolios/equity'
import { buildClosedTrades, computeCurveMetrics, computeMetrics } from '@/lib/portafolios/metrics'
import type { PortfolioPosition } from '@/lib/portafolios/types'
import { KpiCard, KpiRow } from './KpiCard'
import { PortfolioSection } from './PortfolioSection'
import { QuantPortfolioSection } from './QuantPortfolioSection'
import { ResumenCartera } from './ResumenCartera'
import { CARTERA_META } from '@/lib/estrategias/cartera'
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

const NOTA_PASTEL_LARGAS =
  'La porción mide la prima pagada por cada contrato, que es todo lo que una compra puede llegar a ' +
  'perder. Al cerrarse el contrato, la posición desaparece de este gráfico y pasa al track record.'

const NOTA_PASTEL_CORTAS =
  'La porción mide el colateral que respalda la obligación: el efectivo del strike en un put asegurado ' +
  'y el valor de las acciones en una call cubierta. Es la convención conservadora —un bróker exigiría ' +
  'margen, bastante menos— y por eso una sola venta pesa como decenas de compras.'

type Tab = 'acciones' | 'largas' | 'cortas' | 'futuros'

/** Supuestos de cada cartera en vivo. Los de futuros van aparte: usan el backtest. */
const SUPUESTOS_EN_VIVO: Record<Exclude<Tab, 'futuros'>, string[]> = {
  acciones: [
    `Capital asignado: ${fmtUsd(CAPITAL_ACCIONES, 0)} a los agentes Peter y Small.`,
    `${fmtUsd(TICKET_ACCIONES, 0)} por recomendación, en cantidad fraccional al precio de entrada del agente.`,
    `Benchmark: ${BENCHMARK}, normalizado al mismo capital para que las curvas arranquen del mismo punto.`,
    'Cifras brutas: no se descuentan comisiones de rendimiento ni costes de transacción.',
    'Las posiciones se derivan en vivo de las recomendaciones: al vender un agente, la posición sale de los gráficos y entra en el track record.',
  ],
  largas: [
    `Capital asignado: ${fmtUsd(CAPITAL_OPCIONES_LARGAS, 0)} al agente Gamma, que compra calls y puts.`,
    '1 contrato por señal, equivalente a 100 acciones del subyacente.',
    'Capital comprometido: la prima pagada. Una compra no puede perder más que eso.',
    `Benchmark: ${BENCHMARK}, normalizado al mismo capital para que las curvas arranquen del mismo punto.`,
    'Cifras brutas: no se descuentan comisiones de rendimiento ni costes de transacción.',
    'Las posiciones se derivan en vivo de las recomendaciones: al cerrarse un contrato, sale de los gráficos y entra en el track record.',
  ],
  cortas: [
    `Capital asignado: ${fmtUsd(CAPITAL_OPCIONES_CORTAS, 0)} al agente Theta, que vende puts asegurados y calls cubiertas.`,
    '1 contrato por señal, equivalente a 100 acciones del subyacente.',
    'Capital comprometido: el colateral completo — el efectivo del strike en un put asegurado, el valor de las acciones en una call cubierta.',
    'Triplica el capital de las largas porque ese colateral inmoviliza decenas de miles por contrato. Es la convención conservadora: un bróker exigiría margen, bastante menos.',
    `Benchmark: ${BENCHMARK}, normalizado al mismo capital para que las curvas arranquen del mismo punto.`,
    'Cifras brutas: no se descuentan comisiones de rendimiento ni costes de transacción.',
  ],
}

// El punto de color de cada pestaña es el mismo acento que usa el bloque que
// abre, para que la pestaña y su contenido no se lean como cosas distintas.
// Largas y cortas heredan los colores que los gráficos ya dan a Gamma y Theta.
//
// Van en hexadecimal literal porque las secciones componen con ellos el fondo y
// el borde del icono añadiendo la opacidad al final del color, y eso solo
// funciona sobre un literal: con `var(--color-*)` el navegador descarta la regla
// y el recuadro se queda sin fondo.
const ACENTO_ACCIONES = '#10b981'
const ACENTO_LARGAS = '#8b8ff0'
const ACENTO_CORTAS = '#e0a458'
const ACENTO_FUTUROS = '#003d66'

const TABS: { key: Tab; label: string; accent: string }[] = [
  { key: 'acciones', label: 'ACCIONES', accent: ACENTO_ACCIONES },
  { key: 'largas', label: 'OPCIONES LARGAS', accent: ACENTO_LARGAS },
  { key: 'cortas', label: 'OPCIONES CORTAS', accent: ACENTO_CORTAS },
  { key: 'futuros', label: 'FUTUROS', accent: ACENTO_FUTUROS },
]

/** Enlaces anteriores al reparto de las opciones en dos carteras. */
const ALIAS_TAB: Record<string, Tab> = { opciones: 'largas' }

function resolverTab(valor: string | null): Tab {
  if (valor == null) return 'acciones'
  const conocida = TABS.find(t => t.key === valor)
  return conocida?.key ?? ALIAS_TAB[valor] ?? 'acciones'
}

export default function PortafoliosClient({ cartera }: { cartera: BacktestCartera | null }) {
  const { recs, livePrices, primas, closes, cargando, error, actualizado, refrescar } = useLivePortfolio()

  // Quien llega desde `/estrategias` pide directamente el portafolio de futuros.
  // El parámetro solo se lee al montar —cambiar de pestaña no toca la URL—, y
  // frente al hash tiene la ventaja de que el servidor lo ve, así que no hay
  // desajuste de hidratación.
  const tabInicial = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>(() => resolverTab(tabInicial))

  const acciones = useMemo(
    () => buildStockPositions(recs, livePrices, closes),
    [recs, livePrices, closes]
  )
  // Lo que se posee de verdad de cada ticker, para poder decir si una call
  // cubierta lo está. Sale del portafolio de acciones, que es la única cartera
  // de títulos que conoce la aplicación.
  const titulos = useMemo(() => accionesPorTicker(acciones.positions), [acciones.positions])

  // Gamma y Theta van por separado: una compra arriesga la prima y una venta
  // inmoviliza el colateral, así que comparten pantalla pero no cartera.
  const largas = useMemo(
    () => buildOptionPositions(recs, primas, OPTION_LONG_CATEGORIES, titulos),
    [recs, primas, titulos]
  )
  const cortas = useMemo(
    () => buildOptionPositions(recs, primas, OPTION_SHORT_CATEGORIES, titulos),
    [recs, primas, titulos]
  )

  const metricsAcciones = useMemo(
    () => computeMetrics(acciones.positions, CAPITAL_ACCIONES),
    [acciones.positions]
  )
  const metricsLargas = useMemo(
    () => computeMetrics(largas.positions, CAPITAL_OPCIONES_LARGAS),
    [largas.positions]
  )
  const metricsCortas = useMemo(
    () => computeMetrics(cortas.positions, CAPITAL_OPCIONES_CORTAS),
    [cortas.positions]
  )

  // Eje temporal común: las sesiones del benchmark desde la primera entrada de
  // cualquiera de las carteras, para que las curvas sean comparables entre sí.
  const eje = useMemo(() => {
    const inicio = primeraEntrada([
      ...acciones.positions.map(p => p.fechaEntrada),
      ...largas.positions.map(p => p.fechaEntrada),
      ...cortas.positions.map(p => p.fechaEntrada),
    ])
    if (!inicio) return []
    return ejeTemporal(closes[BENCHMARK] ?? [], inicio)
  }, [acciones.positions, largas.positions, cortas.positions, closes])

  const serieAcciones = useMemo(() => alignSeries(
    buildStockEquityCurve(acciones.positions, closes, CAPITAL_ACCIONES, eje),
    buildBenchmarkCurve(closes[BENCHMARK] ?? [], CAPITAL_ACCIONES, eje),
  ), [acciones.positions, closes, eje])

  const serieLargas = useMemo(() => alignSeries(
    buildOptionEquityCurve(largas.positions, CAPITAL_OPCIONES_LARGAS, eje),
    buildBenchmarkCurve(closes[BENCHMARK] ?? [], CAPITAL_OPCIONES_LARGAS, eje),
  ), [largas.positions, closes, eje])

  const serieCortas = useMemo(() => alignSeries(
    buildOptionEquityCurve(cortas.positions, CAPITAL_OPCIONES_CORTAS, eje),
    buildBenchmarkCurve(closes[BENCHMARK] ?? [], CAPITAL_OPCIONES_CORTAS, eje),
  ), [cortas.positions, closes, eje])

  const curvaAcciones = useMemo(() => computeCurveMetrics(serieAcciones), [serieAcciones])
  const curvaLargas = useMemo(() => computeCurveMetrics(serieLargas), [serieLargas])
  const curvaCortas = useMemo(() => computeCurveMetrics(serieCortas), [serieCortas])

  const tradesAcciones = useMemo(() => buildClosedTrades(acciones.positions), [acciones.positions])
  const tradesLargas = useMemo(() => buildClosedTrades(largas.positions), [largas.positions])
  const tradesCortas = useMemo(() => buildClosedTrades(cortas.positions), [cortas.positions])

  const slices = (positions: PortfolioPosition[]): PieSlice[] => positions
    .filter(p => p.abierta)
    .map(p => ({
      nombre: p.ticker,
      valor: p.valorActual ?? p.capitalComprometido,
      detalle: `${p.agente} · ${fmtPct(p.pnlPct)}`,
    }))

  // ── Resumen de cada pestaña ────────────────────────────────────────────
  // No hay consolidado: los capitales son distintos y sumarlos escondía justo lo
  // que hay que mirar, que es cómo se comporta cada cartera con el suyo.
  const resumen = {
    acciones: {
      titulo: 'Cartera de acciones',
      subCapital: `agentes Peter y Small · ${fmtUsd(TICKET_ACCIONES, 0)} por recomendación`,
      metrics: metricsAcciones,
      benchmarkPct: curvaAcciones.rendimientoBenchmark,
    },
    largas: {
      titulo: 'Cartera de opciones largas',
      subCapital: 'agente Gamma · compra de calls y puts',
      metrics: metricsLargas,
      benchmarkPct: curvaLargas.rendimientoBenchmark,
    },
    cortas: {
      titulo: 'Cartera de opciones cortas',
      subCapital: 'agente Theta · venta de puts asegurados y calls cubiertas',
      metrics: metricsCortas,
      benchmarkPct: curvaCortas.rendimientoBenchmark,
    },
  }

  // ── Futuros ────────────────────────────────────────────────────────────
  // La cartera cuantitativa no se suma a las otras: es un backtest sobre una
  // cuenta propia, así que su pestaña estrena su propio resumen.
  const rFut = cartera?.resumen ?? null

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

      {/* Resumen de la pestaña activa: cada cartera gestiona su propio capital. */}
      {tab === 'futuros' ? (
        rFut && (
          <section className="rounded-xl border border-border bg-surface-raised p-px">
            <div className="rounded-t-xl bg-surface px-4 py-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-primary">
                Cartera de futuros · backtest {CARTERA_META.periodo}
              </h2>
            </div>
            <KpiRow>
              <KpiCard
                label="Capital gestionado"
                value={fmtUsd(CARTERA_META.cuenta, 0)}
                sub="cuenta del backtest · MNQ"
                acento="var(--color-text-primary)"
              />
              <KpiCard
                label="Valor actual"
                value={fmtUsd(CARTERA_META.cuenta + rFut.neto, 0)}
                sub="capital + resultados"
                acento="var(--color-text-primary)"
              />
              <KpiCard
                label="Resultado global"
                value={fmtUsd(rFut.neto, 0)}
                sub={fmtPct((rFut.neto / CARTERA_META.cuenta) * 100)}
                signo={rFut.neto}
              />
              <KpiCard
                label="Rentabilidad anual"
                value={fmtUsd(rFut.porAnio, 0)}
                sub={`${((rFut.porAnio / CARTERA_META.cuenta) * 100).toFixed(1)} % de la cuenta`}
                signo={rFut.porAnio}
              />
              <KpiCard
                label="Operaciones"
                value={`${rFut.operaciones}`}
                sub={`${rFut.estrategias} estrategias · ${CARTERA_META.periodo}`}
                acento="var(--color-text-primary)"
              />
            </KpiRow>
          </section>
        )
      ) : (
        <ResumenCartera {...resumen[tab]} />
      )}

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
          acento={ACENTO_ACCIONES}
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
      ) : tab === 'largas' ? (
        <PortfolioSection
          titulo="Portafolio algorítmico de opciones largas"
          subtitulo="Agente Gamma · compra de calls y puts · 1 contrato por señal (100 acciones)"
          icono={Zap}
          acento={ACENTO_LARGAS}
          metrics={metricsLargas}
          curva={curvaLargas}
          serie={serieLargas}
          positions={largas.positions}
          trades={tradesLargas}
          slices={slices(largas.positions)}
          excluidas={largas.excluidas}
          etiquetaPrecio="Prima"
          notaCurva={NOTA_CURVA_OPCIONES}
          escalonada
          notaPastel={NOTA_PASTEL_LARGAS}
        />
      ) : (
        <PortfolioSection
          titulo="Portafolio algorítmico de opciones cortas"
          subtitulo="Agente Theta · venta de puts asegurados y calls cubiertas · 1 contrato por señal"
          icono={Coins}
          acento={ACENTO_CORTAS}
          metrics={metricsCortas}
          curva={curvaCortas}
          serie={serieCortas}
          positions={cortas.positions}
          trades={tradesCortas}
          slices={slices(cortas.positions)}
          excluidas={cortas.excluidas}
          etiquetaPrecio="Prima"
          notaCurva={NOTA_CURVA_OPCIONES}
          escalonada
          notaPastel={NOTA_PASTEL_CORTAS}
        />
      )}

      {/* Supuestos: la cartera es derivada, conviene dejar las reglas a la vista.
          Como el resumen de arriba, cada pestaña trae los suyos. */}
      {tab === 'futuros' ? (
        rFut && (
          <section className="rounded-lg border border-border bg-surface px-4 py-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Supuestos de la cartera de futuros
            </h3>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-text-secondary">
              <li>· Cuenta de referencia: {fmtUsd(CARTERA_META.cuenta, 0)}, con un contrato por sistema ({rFut.estrategias} sobre MNQ).</li>
              <li>· Drawdown medido: {fmtUsd(rFut.drawdown, 0)}, el {((Math.abs(rFut.drawdown) / CARTERA_META.cuenta) * 100).toFixed(1)} % de la cuenta. Escala de forma lineal con el número de contratos.</li>
              <li>· {CARTERA_META.estado}, {CARTERA_META.periodo}: no hay operativa real ni capital asignado.</li>
              <li>· Sin benchmark: el resultado no se compara con {BENCHMARK}, como sí hacen las otras pestañas.</li>
              <li>· Método, costes y fuente: en «Trazabilidad de la cartera», al final de esta pestaña.</li>
            </ul>
          </section>
        )
      ) : (
        <section className="rounded-lg border border-border bg-surface px-4 py-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
            Supuestos de {resumen[tab].titulo.toLowerCase()}
          </h3>
          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-text-secondary">
            {SUPUESTOS_EN_VIVO[tab].map(linea => (
              <li key={linea}>· {linea}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
