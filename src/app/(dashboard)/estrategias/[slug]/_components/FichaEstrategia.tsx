import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Image as ImageIcon, Sheet, Table2 } from 'lucide-react'
import { DistributionChart } from '@/components/charts/DistributionChart'
import { DrawdownChart } from '@/components/charts/DrawdownChart'
import { PnlBarChart } from '@/components/charts/PnlBarChart'
import { StrategyEquityChart } from '@/components/charts/StrategyEquityChart'
import { fmtUsd } from '@/components/charts/chart-theme'
import { MARCO_COMUN } from '@/lib/estrategias/catalogo'
import type { BacktestEstrategia, FichaEstrategia as Ficha } from '@/lib/estrategias/types'
import type { DocumentosDisponibles } from '@/lib/estrategias/datos'
import { KpiCard, KpiRow } from '@/app/(dashboard)/portafolios/_components/KpiCard'
import { Chip, ListaPuntos, NotaPie, Panel, TablaDatos, TablaScroll, Td, Th } from '../../_components/ui'
import { VisorCodigo } from './VisorCodigo'

interface Props {
  ficha: Ficha
  backtest: BacktestEstrategia | null
  codigo: string | null
  /** Qué piezas del expediente están en el repo. Las que faltan no se enlazan. */
  documentos: DocumentosDisponibles
}

const DOC = '/estrategias/docs'
const IMG = '/estrategias/img'

export function FichaEstrategia({ ficha, backtest, codigo, documentos }: Props) {
  const r = backtest?.resumen
  const reg = backtest?.regimen

  return (
    <div className="space-y-6">
      <Link
        href="/estrategias"
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={13} />
        Todas las estrategias
      </Link>

      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <header className="space-y-3">
        <div>
          <h1 className="font-brand text-2xl font-extrabold text-text-primary">{ficha.nombre}</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">{ficha.subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tono="acento">{ficha.instrumento}</Chip>
          <Chip>{ficha.grafico}</Chip>
          <Chip>Sesión {ficha.sesion}</Chip>
          <Chip>{ficha.direccion}</Chip>
          <Chip>{ficha.contratos} contrato</Chip>
          <Chip>{ficha.estilo}</Chip>
          <Chip tono="aviso">Fase E · simulado desde {formatearFecha(ficha.desdeFaseE)}</Chip>
        </div>
        <p className="max-w-4xl text-sm leading-relaxed text-text-primary">{ficha.enUnaFrase}</p>
      </header>

      {/* ── KPIs ─────────────────────────────────────────────────── */}
      {r && (
        <KpiRow>
          <KpiCard
            label="Beneficio neto"
            value={fmtUsd(r.neto, 0)}
            sub={`${r.operaciones} operaciones`}
            acento="var(--color-positive)"
          />
          <KpiCard
            label="Max drawdown"
            value={fmtUsd(r.drawdown, 0)}
            sub={r.fechaDrawdown ? `fondo el ${formatearFecha(r.fechaDrawdown)}` : undefined}
            acento="var(--color-negative)"
          />
          <KpiCard
            label="Net / DD"
            value={r.netoSobreDrawdown?.toFixed(2) ?? '—'}
            sub="beneficio por dólar de caída"
            ayuda="Cuántas veces cabe el peor drawdown dentro del beneficio total."
          />
          <KpiCard
            label="Calmar"
            value={r.calmar?.toFixed(2) ?? '—'}
            sub={`${fmtUsd(r.netoPorAnio, 0)} al año`}
            ayuda="Beneficio de un año medio dividido por el peor drawdown. El Net/DD crece solo por alargar el backtest; el Calmar está normalizado por tiempo y sí se puede comparar entre estrategias."
          />
          <KpiCard
            label="t-stat"
            value={r.tStat?.toFixed(2) ?? '—'}
            sub="significancia del edge"
            ayuda="Por encima de 2 se considera estadísticamente significativo."
          />
          <KpiCard
            label="Profit factor"
            value={r.profitFactor?.toFixed(2) ?? '—'}
            sub={`${r.aciertos.toFixed(1)} % de aciertos`}
          />
        </KpiRow>
      )}

      {r && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniDato etiqueta="Por operación" valor={fmtUsd(r.porOperacion)} />
          <MiniDato etiqueta="Mediana" valor={fmtUsd(r.medianaOperacion ?? 0)} />
          <MiniDato etiqueta="Mejor operación" valor={fmtUsd(r.mejor, 0)} tono="positivo" />
          <MiniDato etiqueta="Peor operación" valor={fmtUsd(r.peor, 0)} tono="negativo" />
        </div>
      )}

      {/* ── Cómo opera ───────────────────────────────────────────── */}
      <Panel titulo="Cómo opera" descripcion="La mecánica completa, tal como está implementada en producción.">
        <TablaDatos filas={ficha.comoOpera} />
      </Panel>

      {/* ── Curva ────────────────────────────────────────────────── */}
      {backtest && (
        <Panel
          titulo="Resultado acumulado"
          descripcion="Curva construida sumando el resultado real de cada operación, atribuido a su fecha de salida. La línea vertical marca el corte de régimen de julio de 2020."
        >
          <StrategyEquityChart
            serie={backtest.equity}
            corteRegimen={reg?.corte}
            nombre={ficha.nombre}
            altura={320}
          />
          <NotaPie>
            {r?.desde && r?.hasta
              ? `Del ${formatearFecha(r.desde)} al ${formatearFecha(r.hasta)}. `
              : ''}
            Cifras en MNQ con {ficha.contratos} contrato, {MARCO_COMUN.costes}.
          </NotaPie>
        </Panel>
      )}

      {/* ── Drawdown ─────────────────────────────────────────────── */}
      {backtest && (
        <Panel
          titulo="Drawdown"
          descripcion="Distancia al máximo previo en cada momento. Es la medida de lo que habría que soportar para obtener el resultado de arriba."
        >
          <DrawdownChart
            serie={backtest.drawdown}
            maximo={r?.drawdown}
            fechaMaximo={r?.fechaDrawdown}
          />
        </Panel>
      )}

      {/* ── Año a año ────────────────────────────────────────────── */}
      {backtest && backtest.anual.length > 0 && (
        <Panel titulo="Resultado por año" descripcion="Año natural, atribuido por fecha de salida.">
          <PnlBarChart
            barras={backtest.anual.map(a => ({
              nombre: a.anio,
              pnl: a.pnl,
              detalle: `${a.operaciones} operaciones · ${a.ganadoras} ganadoras`,
            }))}
          />
        </Panel>
      )}

      {/* ── Régimen ──────────────────────────────────────────────── */}
      {reg?.anterior && reg.posterior && (
        <Panel
          titulo="Dependencia de régimen"
          descripcion="El mismo código, sin cambiar una línea, medido antes y después de julio de 2020."
        >
          <TablaScroll>
            <table className="w-full min-w-[36rem]">
              <thead>
                <tr className="border-b border-border-subtle">
                  <Th>Periodo</Th>
                  <Th alinear="right">Operaciones</Th>
                  <Th alinear="right">Neto</Th>
                  <Th alinear="right">Por operación</Th>
                  <Th alinear="right">Profit factor</Th>
                  <Th alinear="right">t-stat</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {[
                  ['2015 – junio 2020', reg.anterior],
                  ['julio 2020 – hoy', reg.posterior],
                ].map(([etiqueta, b]) => {
                  const bloque = b as NonNullable<typeof reg.anterior>
                  return (
                    <tr key={String(etiqueta)}>
                      <Td className="text-text-primary">{String(etiqueta)}</Td>
                      <Td alinear="right" mono className="text-text-secondary">
                        {bloque.operaciones}
                      </Td>
                      <Td
                        alinear="right"
                        mono
                        className={bloque.neto >= 0 ? 'text-positive' : 'text-negative'}
                      >
                        {fmtUsd(bloque.neto, 0)}
                      </Td>
                      <Td alinear="right" mono className="text-text-secondary">
                        {fmtUsd(bloque.porOperacion)}
                      </Td>
                      <Td alinear="right" mono className="text-text-secondary">
                        {bloque.profitFactor?.toFixed(2) ?? '—'}
                      </Td>
                      <Td alinear="right" mono className="font-bold text-text-primary">
                        {bloque.tStat?.toFixed(2) ?? '—'}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TablaScroll>
          <NotaPie>
            Ratio de dependencia según el expediente de cartera:{' '}
            <strong className="text-text-primary">{ficha.aporteCartera.ratioRegimen}</strong>. Cuanto más
            bajo, menos depende la estrategia del cambio de mercado posterior a 2020. No es correlación
            de retornos: es correlación de supuestos, y no aparece en ninguna matriz de correlación
            diaria.
          </NotaPie>
        </Panel>
      )}

      {/* ── Distribución y concentración ─────────────────────────── */}
      {backtest && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            titulo="Distribución de resultados"
            descripcion="Operaciones agrupadas por resultado. Los extremos se acumulan en los cubos de cola."
          >
            <DistributionChart cubos={backtest.distribucion} />
          </Panel>

          <Panel
            titulo="Concentración"
            descripcion="Cuánto del beneficio depende de las mejores operaciones. Es lo que distingue una ventaja repetible de una cola derecha afortunada."
          >
            <TablaScroll>
              <table className="w-full min-w-[26rem]">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <Th>Selección</Th>
                    <Th alinear="right">Suma</Th>
                    <Th alinear="right">% del neto</Th>
                    <Th alinear="right">Resto</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {backtest.concentracion.map(t => (
                    <tr key={t.top}>
                      <Td className="text-text-primary">Top {t.top}</Td>
                      <Td alinear="right" mono className="text-text-secondary">
                        {fmtUsd(t.suma, 0)}
                      </Td>
                      <Td
                        alinear="right"
                        mono
                        className={
                          (t.porcentajeDelNeto ?? 0) > 80 ? 'font-bold text-warning' : 'text-text-primary'
                        }
                      >
                        {t.porcentajeDelNeto != null ? `${t.porcentajeDelNeto} %` : '—'}
                      </Td>
                      <Td
                        alinear="right"
                        mono
                        className={t.resto >= 0 ? 'text-text-secondary' : 'text-negative'}
                      >
                        {fmtUsd(t.resto, 0)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </Panel>
        </div>
      )}

      {/* ── Aporte a la cartera ──────────────────────────────────── */}
      <Panel
        titulo="Aporte a la cartera"
        descripcion="Qué cambia en el conjunto de seis estrategias cuando esta entra o sale."
        accion={
          <Link
            href="/portafolios?tab=futuros"
            className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
          >
            Ver cartera
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniDato
            etiqueta="Net/DD sin ella"
            valor={ficha.aporteCartera.netoSobreDrawdownSinElla.toFixed(2)}
            nota="el conjunto cae a esta cifra"
          />
          <MiniDato
            etiqueta="Coste de quitarla"
            valor={ficha.aporteCartera.coste.toFixed(2)}
            tono="negativo"
            nota="puntos de Net/DD"
          />
          <MiniDato
            etiqueta="Ratio de régimen"
            valor={ficha.aporteCartera.ratioRegimen}
            nota="cuanto más bajo, mejor"
          />
        </div>

        {ficha.aporteCartera.correlaciones && ficha.aporteCartera.correlaciones.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
              Correlación media contra correlación en el 10 % de peores días
            </p>
            <TablaScroll>
              <table className="w-full min-w-[30rem]">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <Th>Con</Th>
                    <Th alinear="right">Media</Th>
                    <Th alinear="right">Peores días</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {ficha.aporteCartera.correlaciones.map(c => (
                    <tr key={c.con}>
                      <Td className="text-text-primary">{c.con}</Td>
                      <Td alinear="right" mono className="text-text-secondary">
                        {c.media > 0 ? '+' : ''}
                        {c.media.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
                      </Td>
                      <Td
                        alinear="right"
                        mono
                        className={
                          c.peoresDias == null
                            ? 'text-text-muted'
                            : c.peoresDias < 0
                              ? 'font-bold text-positive'
                              : 'text-warning'
                        }
                      >
                        {c.peoresDias != null ? c.peoresDias.toFixed(2) : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaScroll>
          </div>
        )}

        {ficha.aporteCartera.nota && <NotaPie>{ficha.aporteCartera.nota}</NotaPie>}
      </Panel>

      {/* ── Lo que sostiene / lo que no cumple ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="Lo que sostiene la tesis">
          <ListaPuntos puntos={ficha.loQueSostiene} />
        </Panel>

        <section className="rounded-xl border border-warning/30 bg-warning/[0.05]">
          <header className="border-b border-warning/20 px-4 py-3">
            <h2 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-warning">
              Lo que no cumple
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Los criterios que esta estrategia incumple, declarados en su propia tesis.
            </p>
          </header>
          <div className="p-4">
            <ListaPuntos puntos={ficha.loQueNoCumple} tono="aviso" />
          </div>
        </section>
      </div>

      {/* ── Riesgo ───────────────────────────────────────────────── */}
      <Panel titulo="Riesgo y gobernanza">
        <TablaDatos filas={ficha.riesgos} />
        {ficha.graduacion && (
          <div className="mt-4 rounded-lg border border-border bg-surface-raised px-3 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
              Condición de graduación a capital real
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{ficha.graduacion}</p>
          </div>
        )}
      </Panel>

      {/* ── Diagramas propios ────────────────────────────────────── */}
      {ficha.diagramas && ficha.diagramas.length > 0 && (
        <Panel titulo="Cómo se leen sus filtros">
          <div className="grid gap-4 md:grid-cols-2">
            {ficha.diagramas.map(d => (
              <figure key={d.archivo} className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-border bg-white">
                  <Image
                    src={`${IMG}/${d.archivo}`}
                    alt={d.titulo}
                    width={900}
                    height={600}
                    className="h-auto w-full"
                  />
                </div>
                <figcaption>
                  <p className="font-brand text-xs font-bold text-text-primary">{d.titulo}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{d.descripcion}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Producción ───────────────────────────────────────────── */}
      <Panel
        titulo="Configuración de producción"
        descripcion="Los parámetros exactos con los que corre el bot. Nada de esto es orientativo."
      >
        <TablaDatos filas={ficha.configProduccion} />
      </Panel>

      {/* ── Código ───────────────────────────────────────────────── */}
      {codigo && (
        <Panel
          titulo="Código de producción"
          descripcion="El archivo de NinjaTrader tal como corre. Su cabecera documenta las decisiones y los descartes con sus cifras."
        >
          <VisorCodigo codigo={codigo} nombre={`${ficha.slug}.cs`} />
        </Panel>
      )}

      {/* ── Infografía ───────────────────────────────────────────── */}
      {documentos.infografia && (
      <Panel titulo="Infografía" descripcion="La tesis resumida en una página.">
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <Image
            src={`${IMG}/${ficha.slug}-infografia.png`}
            alt={`Infografía de ${ficha.nombre}`}
            width={1400}
            height={2000}
            className="h-auto w-full"
          />
        </div>
      </Panel>
      )}

      {/* ── Expediente ───────────────────────────────────────────── */}
      <Panel
        titulo="Expediente"
        descripcion="Los documentos originales de esta estrategia, tal como están en el archivo."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {documentos.tesis && (
            <Documento
              href={`${DOC}/${ficha.slug}-tesis.pdf`}
              icono={<FileText size={15} />}
              titulo="Tesis de inversión"
              detalle="PDF · documento completo"
            />
          )}
          {documentos.wfo && (
            <Documento
              href={`${DOC}/${ficha.slug}-wfo.xlsx`}
              icono={<Sheet size={15} />}
              titulo="Registro de validación"
              detalle="Excel · barridos de parámetros y análisis por régimen"
            />
          )}
          {documentos.trades && (
            <Documento
              href={`${DOC}/${ficha.slug}-trades.csv`}
              icono={<Table2 size={15} />}
              titulo="Operaciones del backtest"
              detalle={`CSV · ${r?.operaciones ?? '—'} operaciones exportadas del Strategy Analyzer`}
            />
          )}
          {documentos.infografia && (
            <Documento
              href={`${IMG}/${ficha.slug}-infografia.png`}
              icono={<ImageIcon size={15} />}
              titulo="Infografía"
              detalle="PNG · resumen visual"
            />
          )}
        </div>
      </Panel>

      {/* ── Trazabilidad ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
          Trazabilidad
        </h3>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-text-secondary">
          <li>
            · Datos: {r?.operaciones ?? '—'} operaciones exportadas del Strategy Analyzer sobre{' '}
            {MARCO_COMUN.validadoSobre}, {ficha.grafico}, sesión {ficha.sesion}, con{' '}
            {MARCO_COMUN.costes}.
          </li>
          <li>· Periodo: {MARCO_COMUN.periodo}.</li>
          <li>· {MARCO_COMUN.escalado}</li>
          <li>
            · Las cifras de esta página se calculan a partir de las operaciones y se contrastan contra
            las publicadas en la tesis.
            {backtest?.verificacion.avisos.length === 0 && ' Todas cuadran.'}
          </li>
          {ficha.discrepancias?.map((d, i) => (
            <li key={i}>· {d}</li>
          ))}
          <li className="pt-1 text-text-muted">
            Los resultados presentados son de simulación histórica y no garantizan comportamiento
            futuro. Documento interno; no constituye asesoramiento financiero.
          </li>
        </ul>
      </section>
    </div>
  )
}

// ───────────────────────────── auxiliares ──────────────────────────────

function MiniDato({
  etiqueta,
  valor,
  nota,
  tono = 'neutro',
}: {
  etiqueta: string
  valor: string
  nota?: string
  tono?: 'neutro' | 'positivo' | 'negativo'
}) {
  const colores = {
    neutro: 'text-text-primary',
    positivo: 'text-positive',
    negativo: 'text-negative',
  } as const
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">{etiqueta}</p>
      <p className={`mt-1 font-mono text-sm font-bold tabular-nums ${colores[tono]}`}>{valor}</p>
      {nota && <p className="mt-0.5 text-[10px] text-text-muted">{nota}</p>}
    </div>
  )
}

function Documento({
  href,
  icono,
  titulo,
  detalle,
}: {
  href: string
  icono: React.ReactNode
  titulo: string
  detalle: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-3 transition-colors hover:border-border"
    >
      <span className="shrink-0 text-text-secondary transition-colors group-hover:text-text-primary">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-text-primary">{titulo}</span>
        <span className="block truncate text-[10px] text-text-muted">{detalle}</span>
      </span>
      <Download
        size={13}
        className="shrink-0 text-text-muted transition-colors group-hover:text-text-primary"
      />
    </a>
  )
}

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const nombreMes = meses[Number(mes) - 1] ?? mes
  return `${Number(dia)} de ${nombreMes} de ${anio}`
}
