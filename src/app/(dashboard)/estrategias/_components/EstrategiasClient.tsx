import Link from 'next/link'
import { ArrowRight, Briefcase, LineChart } from 'lucide-react'
import { CATALOGO, MARCO_COMUN } from '@/lib/estrategias/catalogo'
import type { BacktestEstrategia } from '@/lib/estrategias/types'
import { fmtPct, fmtUsd } from '@/components/charts/chart-theme'
import { Chip, NotaPie, Panel, TablaScroll, Td, Th } from './ui'
import { Sparkline } from './Sparkline'

interface Props {
  backtests: Record<string, BacktestEstrategia | null>
}

/**
 * Índice de la sección: las seis estrategias, comparadas y enlazadas.
 *
 * El orden es por beneficio neto descendente, que es como las presenta el
 * expediente de cartera.
 */
export default function EstrategiasClient({ backtests }: Props) {
  const fichas = [...CATALOGO].sort((a, b) => {
    const na = backtests[a.slug]?.resumen.neto ?? 0
    const nb = backtests[b.slug]?.resumen.neto ?? 0
    return nb - na
  })

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <LineChart size={20} className="text-on-accent" />
        </div>
        <div className="min-w-0">
          <h1 className="font-brand text-lg font-extrabold text-text-primary">Estrategias</h1>
          <p className="text-sm text-text-secondary">
            SynerGy — Sistemas algorítmicos de futuros sobre el Nasdaq
          </p>
        </div>
      </div>

      {/* Marco común */}
      <section className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tono="acento">{MARCO_COMUN.instrumento}</Chip>
          <Chip>{MARCO_COMUN.contratos}</Chip>
          <Chip>{MARCO_COMUN.periodo}</Chip>
          <Chip>{MARCO_COMUN.duracion}</Chip>
          <Chip tono="aviso">{MARCO_COMUN.estado}</Chip>
        </div>
        <p className="mt-3 max-w-4xl text-xs leading-relaxed text-text-secondary">
          Seis estrategias validadas sobre {MARCO_COMUN.validadoSobre} con{' '}
          {MARCO_COMUN.costes}. Las seis operan <strong className="text-text-primary">solo largos</strong>:
          en los seis casos el lado corto se probó y no tenía ventaja, así que se eliminó del código en
          lugar de dejarlo desactivado en el panel.
        </p>
        <NotaPie>{MARCO_COMUN.escalado}</NotaPie>
      </section>

      {/* El hilo común, dicho antes que ninguna cifra */}
      <section className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3">
        <h2 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-warning">
          Lo que comparten las seis
        </h2>
        <p className="mt-2 max-w-4xl text-xs leading-relaxed text-text-secondary">
          Cinco de las seis son estadísticamente nulas antes de julio de 2020 y fuertes después. Ninguna
          supera un t-stat de 2 en el periodo antiguo. Eso no aparece en la correlación de resultados
          diarios, porque no es correlación de retornos:{' '}
          <strong className="text-text-primary">es correlación de supuestos</strong>. El ZigZag (1,4×) y
          el IBS (1,20×) son las menos dependientes; el RSI2 es el caso extremo, con un t-stat que pasa
          de −0,11 a 4,14.
        </p>
      </section>

      {/* Tabla comparativa */}
      <Panel
        titulo="Comparativa"
        descripcion="Cifras en MNQ con un contrato, calculadas sobre las operaciones reales de cada backtest."
      >
        <TablaScroll>
          <table className="w-full min-w-[54rem]">
            <thead>
              <tr className="border-b border-border-subtle">
                <Th>Estrategia</Th>
                <Th>Estilo</Th>
                <Th>Gráfico</Th>
                <Th alinear="right">Neto</Th>
                <Th alinear="right">Max DD</Th>
                <Th alinear="right">Net/DD</Th>
                <Th alinear="right">Calmar</Th>
                <Th alinear="right">t-stat</Th>
                <Th alinear="right">PF</Th>
                <Th alinear="right">Ops</Th>
                <Th alinear="right">Aciertos</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {fichas.map(f => {
                const r = backtests[f.slug]?.resumen
                return (
                  <tr key={f.slug} className="transition-colors hover:bg-surface-raised">
                    <Td>
                      <Link
                        href={`/estrategias/${f.slug}`}
                        className="font-medium text-text-primary underline-offset-2 hover:underline"
                      >
                        {f.nombre}
                      </Link>
                    </Td>
                    <Td className="text-text-secondary">{f.estilo}</Td>
                    <Td className="text-text-secondary">
                      {f.grafico} · {f.sesion}
                    </Td>
                    <Td alinear="right" mono className="text-positive">
                      {r ? fmtUsd(r.neto, 0) : '—'}
                    </Td>
                    <Td alinear="right" mono className="text-negative">
                      {r ? fmtUsd(r.drawdown, 0) : '—'}
                    </Td>
                    <Td alinear="right" mono className="text-text-primary">
                      {r?.netoSobreDrawdown?.toFixed(2) ?? '—'}
                    </Td>
                    <Td alinear="right" mono className="text-text-primary">
                      {r?.calmar?.toFixed(2) ?? '—'}
                    </Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {r?.tStat?.toFixed(2) ?? '—'}
                    </Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {r?.profitFactor?.toFixed(2) ?? '—'}
                    </Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {r?.operaciones ?? '—'}
                    </Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {r ? `${r.aciertos.toFixed(1)} %` : '—'}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TablaScroll>
      </Panel>

      {/* Tarjetas */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fichas.map(f => {
          const bt = backtests[f.slug]
          const r = bt?.resumen
          return (
            <Link
              key={f.slug}
              href={`/estrategias/${f.slug}`}
              className="group flex flex-col rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border hover:bg-surface-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-brand text-sm font-extrabold text-text-primary">{f.nombre}</h3>
                  <p className="mt-0.5 text-[11px] text-text-muted">{f.estilo}</p>
                </div>
                <ArrowRight
                  size={14}
                  className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
                />
              </div>

              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                {f.enUnaFrase}
              </p>

              {bt && (
                <div className="mt-3">
                  <Sparkline serie={bt.equity} />
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">Neto</p>
                  <p className="font-mono text-xs font-bold tabular-nums text-positive">
                    {r ? fmtUsd(r.neto, 0) : '—'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">Net/DD</p>
                  <p className="font-mono text-xs font-bold tabular-nums text-text-primary">
                    {r?.netoSobreDrawdown?.toFixed(2) ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">t-stat</p>
                  <p className="font-mono text-xs font-bold tabular-nums text-text-primary">
                    {r?.tStat?.toFixed(2) ?? '—'}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Puente a la cartera */}
      <Link
        href="/portafolios?tab=futuros"
        className="group flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface px-4 py-4 transition-colors hover:border-border hover:bg-surface-raised"
      >
        <div className="flex min-w-0 items-start gap-3">
          <Briefcase size={18} className="mt-0.5 shrink-0 text-text-secondary" />
          <div className="min-w-0">
            <p className="font-brand text-xs font-extrabold uppercase tracking-[0.12em] text-text-primary">
              Las seis funcionando juntas
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">
              Por separado, la suma de sus drawdowns es de {fmtUsd(-15_994, 0)}. Combinadas, el drawdown
              real del conjunto es de {fmtUsd(-4_099, 0)}: un {fmtPct(-74, 0).replace('-', '')} menos. El
              detalle de cuánto aporta cada una está en Portafolios.
            </p>
          </div>
        </div>
        <ArrowRight
          size={16}
          className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
        />
      </Link>
    </div>
  )
}
