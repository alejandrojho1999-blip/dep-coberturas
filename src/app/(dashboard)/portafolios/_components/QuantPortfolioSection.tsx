'use client'

import Link from 'next/link'
import { ArrowRight, Cpu, ShieldCheck } from 'lucide-react'
import { DrawdownChart } from '@/components/charts/DrawdownChart'
import { PnlBarChart } from '@/components/charts/PnlBarChart'
import { PortfolioPieChart } from '@/components/charts/PortfolioPieChart'
import { StrategyEquityChart } from '@/components/charts/StrategyEquityChart'
import { fmtUsd } from '@/components/charts/chart-theme'
import {
  APORTE_MARGINAL,
  CARTERA_META,
  CORRELACIONES,
  DEPENDENCIA_REGIMEN,
  DESCARTADOS,
  DIMENSIONAMIENTO,
  ESCENARIOS_ANUALES,
  LECCION_DESCARTES,
  REGLAS_OPERATIVAS,
  RIESGO_ESTRUCTURAL,
} from '@/lib/estrategias/cartera'
import type { BacktestCartera, BloqueRegimenCartera } from '@/lib/estrategias/types'
import { KpiCard, KpiRow } from './KpiCard'

/**
 * Resultado de las seis estrategias cuantitativas funcionando juntas.
 *
 * Va como tercera sección de /portafolios, y es deliberadamente distinta de las
 * dos de arriba: aquellas son carteras en vivo derivadas de las recomendaciones
 * de los agentes; ésta es un backtest histórico de futuros. No se suman.
 *
 * Los datos llegan por props desde el servidor. No se piden con fetch porque
 * `public/estrategias/` cae dentro del guard de rutas protegidas del proxy y la
 * petición acabaría redirigida a /login.
 */
/**
 * Acento de la sección, el mismo que luce el punto de su pestaña.
 *
 * Va en hexadecimal y no como `var(--color-accent)` porque el marcado compone
 * el fondo y el borde del icono añadiendo la opacidad al final (`1a`, `33`), y
 * eso solo funciona sobre un color literal.
 */
const ACENTO = '#003d66'

export function QuantPortfolioSection({ datos }: { datos: BacktestCartera | null }) {
  const error = datos === null
  const r = datos?.resumen

  return (
    <section id="cartera-cuantitativa" className="scroll-mt-4 space-y-4">
      {/* ── Cabecera ─────────────────────────────────────────────────
          Mismo marcado que `PortfolioSection` —barra de acento, icono y
          título en versalitas— para que las tres pestañas se lean igual al
          pasar de una a otra. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 pl-3" style={{ borderColor: ACENTO }}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${ACENTO}1a`, border: `1px solid ${ACENTO}33` }}
          >
            <Cpu size={17} style={{ color: ACENTO }} />
          </div>
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.12em] text-text-primary">
              {CARTERA_META.titulo}
            </h2>
            <p className="text-xs text-text-secondary">{CARTERA_META.subtitulo}</p>
          </div>
        </div>
        {/* El distintivo de backtest se queda: es lo que distingue esta pestaña
            de las otras dos, que sí son carteras en vivo. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-warning">
            Backtest {CARTERA_META.periodo}
          </span>
          <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary">
            Cuenta {fmtUsd(CARTERA_META.cuenta, 0)}
          </span>
          <Link
            href="/estrategias"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
          >
            Ver las seis
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-xs text-text-muted">
          No se pudieron cargar los datos de la cartera. Ejecuta{' '}
          <code className="font-mono text-text-secondary">node scripts/build-estrategias.mjs</code>.
        </div>
      )}

      {datos && r && (
        <>
          {/* ── KPIs ─────────────────────────────────────────────── */}
          <KpiRow>
            {/* El beneficio neto vive en el resumen de la pestaña, arriba. */}
            <KpiCard
              label="Estrategias"
              value={`${r.estrategias}`}
              sub="sistemas sobre MNQ · 1 contrato"
            />
            <KpiCard
              label="Max drawdown"
              value={fmtUsd(r.drawdown, 0)}
              sub={`${((Math.abs(r.drawdown) / CARTERA_META.cuenta) * 100).toFixed(1)} % de la cuenta`}
              acento="var(--color-negative)"
            />
            <KpiCard
              label="Net / DD"
              value={r.netoSobreDrawdown.toFixed(2)}
              sub="mejor que cualquier bot solo"
            />
            <KpiCard
              label="Calmar"
              value={r.calmar?.toFixed(2) ?? '—'}
              sub={`${fmtUsd(r.porAnio, 0)} al año / ${fmtUsd(Math.abs(r.drawdown), 0)} de caída`}
              ayuda="Beneficio de un año medio dividido por el peor drawdown. A diferencia del Net/DD, que crece solo por alargar el backtest, esta cifra está normalizada por tiempo y sí se puede comparar con la de otros gestores."
            />
            <KpiCard
              label="t-stat del conjunto"
              value={r.tStat?.toFixed(2) ?? '—'}
              sub="sobre el PnL diario"
              ayuda="Calculado sobre los resultados diarios de la serie combinada."
            />
            <KpiCard
              label="Meses positivos"
              value={`${r.mesesPositivos} %`}
              sub={`${r.mesesEnPositivo} de ${r.mesesTotales}`}
            />
          </KpiRow>

          {/* ── La diversificación, que es el argumento ──────────── */}
          <div className="rounded-xl border border-positive/30 bg-positive/[0.05] px-4 py-4">
            <h3 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-positive">
              La diversificación, medida
            </h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-2.5">
                <BarraComparativa
                  etiqueta="Suma de los drawdowns individuales"
                  valor={r.sumaDrawdownsIndividuales}
                  maximo={Math.abs(r.sumaDrawdownsIndividuales)}
                  tono="negativo"
                />
                <BarraComparativa
                  etiqueta="Drawdown real del conjunto"
                  valor={r.drawdown}
                  maximo={Math.abs(r.sumaDrawdownsIndividuales)}
                  tono="positivo"
                />
              </div>
              <div className="flex shrink-0 flex-col justify-center rounded-lg border border-positive/30 bg-surface px-5 py-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
                  Reducción
                </p>
                <p className="font-mono text-2xl font-bold tabular-nums text-positive">
                  −{r.reduccionDrawdown} %
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
              Si las seis estrategias sufrieran a la vez, el conjunto habría caído{' '}
              {fmtUsd(r.sumaDrawdownsIndividuales, 0)}. La caída real medida sobre la serie combinada es
              de {fmtUsd(r.drawdown, 0)}. No es una estimación: la curva se construye sumando el
              resultado diario de las {r.operaciones.toLocaleString('es-ES')} operaciones y el drawdown
              se mide sobre ella.
            </p>
          </div>

          {/* ── Curva combinada ─────────────────────────────────── */}
          <Bloque
            titulo="Curva del conjunto"
            descripcion="La combinada en trazo grueso, las seis individuales de fondo. La línea vertical marca el corte de régimen de julio de 2020."
          >
            <StrategyEquityChart
              serie={datos.equity}
              secundarias={datos.curvasIndividuales}
              corteRegimen={datos.regimen.corte}
              nombre="Cartera"
              altura={340}
            />
          </Bloque>

          {/* ── Drawdown ────────────────────────────────────────── */}
          <Bloque
            titulo="Drawdown del conjunto"
            descripcion="El peor momento de todo el registro pertenece al régimen antiguo: el peor caso medido es exactamente el escenario «desaparece el factor común»."
          >
            <DrawdownChart
              serie={datos.drawdown}
              maximo={r.drawdown}
              fechaMaximo={r.fechaDrawdown}
              altura={220}
            />
          </Bloque>

          {/* ── Composición y año a año ─────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Bloque titulo="De dónde sale el beneficio" descripcion="Reparto del neto por estrategia.">
              <PortfolioPieChart
                slices={datos.componentes.map(c => ({
                  nombre: c.nombre,
                  valor: c.neto,
                  detalle: `${c.porcentajeDelNeto} % del neto · Net/DD ${c.netoSobreDrawdown?.toFixed(2) ?? '—'}`,
                }))}
                centro={fmtUsd(r.neto, 0)}
                centroSub="neto total"
                altura={260}
              />
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                El reparto está equilibrado: ninguna aporta más del{' '}
                {Math.max(...datos.componentes.map(c => c.porcentajeDelNeto))} % ni menos del{' '}
                {Math.min(...datos.componentes.map(c => c.porcentajeDelNeto))} %.
              </p>
            </Bloque>

            <Bloque titulo="Resultado por año" descripcion="Año natural del conjunto.">
              <PnlBarChart
                barras={datos.anual.map(a => ({ nombre: a.anio, pnl: a.pnl }))}
                altura={260}
              />
            </Bloque>
          </div>

          {/* ── Aporte de cada estrategia ───────────────────────── */}
          <div className="rounded-xl border border-border-subtle bg-surface">
            <header className="border-b border-border-subtle px-4 py-3">
              <h3 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-primary">
                Cuánto aporta cada estrategia
              </h3>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-text-secondary">
                Cuatro lecturas distintas de la misma pregunta. La primera es la obvia; las tres
                siguientes son las que de verdad deciden si una pieza se queda.
              </p>
            </header>

            <div className="space-y-6 p-4">
              {/* a) Contribución directa */}
              <SubBloque
                letra="a"
                titulo="Contribución directa"
                descripcion="Lo que aporta cada una medida en solitario."
              >
                <Tabla minimo="48rem">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <Th>Estrategia</Th>
                      <Th alinear="right">Neto</Th>
                      <Th alinear="right">Max DD</Th>
                      <Th alinear="right">Net/DD</Th>
                      <Th alinear="right">Calmar</Th>
                      <Th alinear="right">Ops</Th>
                      <Th alinear="right">% del neto</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {datos.componentes.map(c => (
                      <tr key={c.slug} className="transition-colors hover:bg-surface-raised">
                        <Td>
                          <Link
                            href={`/estrategias/${c.slug}`}
                            className="text-text-primary underline-offset-2 hover:underline"
                          >
                            {c.nombre}
                          </Link>
                        </Td>
                        <Td alinear="right" mono className="text-positive">
                          {fmtUsd(c.neto, 0)}
                        </Td>
                        <Td alinear="right" mono className="text-negative">
                          {fmtUsd(c.drawdown, 0)}
                        </Td>
                        <Td alinear="right" mono className="text-text-secondary">
                          {c.netoSobreDrawdown?.toFixed(2) ?? '—'}
                        </Td>
                        <Td alinear="right" mono className="text-text-secondary">
                          {c.calmar?.toFixed(2) ?? '—'}
                        </Td>
                        <Td alinear="right" mono className="text-text-secondary">
                          {c.operaciones.toLocaleString('es-ES')}
                        </Td>
                        <Td alinear="right" mono className="text-text-primary">
                          {c.porcentajeDelNeto} %
                        </Td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-medium">
                      <Td className="text-text-primary">Suma de los drawdowns</Td>
                      <Td alinear="right" mono className="text-text-muted">
                        —
                      </Td>
                      <Td alinear="right" mono className="text-negative">
                        {fmtUsd(r.sumaDrawdownsIndividuales, 0)}
                      </Td>
                      <Td alinear="right" mono className="text-text-muted">
                        —
                      </Td>
                      <Td alinear="right" mono className="text-text-muted">
                        —
                      </Td>
                      <Td alinear="right" mono className="text-text-muted">
                        —
                      </Td>
                      <Td alinear="right" mono className="text-text-muted">
                        —
                      </Td>
                    </tr>
                    <tr className="bg-accent-muted font-bold">
                      <Td className="text-text-primary">Cartera</Td>
                      <Td alinear="right" mono className="text-positive">
                        {fmtUsd(r.neto, 0)}
                      </Td>
                      <Td alinear="right" mono className="text-positive">
                        {fmtUsd(r.drawdown, 0)}
                      </Td>
                      <Td alinear="right" mono className="text-text-primary">
                        {r.netoSobreDrawdown.toFixed(2)}
                      </Td>
                      <Td alinear="right" mono className="text-text-primary">
                        {r.calmar?.toFixed(2) ?? '—'}
                      </Td>
                      <Td alinear="right" mono className="text-text-primary">
                        {r.operaciones.toLocaleString('es-ES')}
                      </Td>
                      <Td alinear="right" mono className="text-text-primary">
                        100 %
                      </Td>
                    </tr>
                  </tbody>
                </Tabla>
              </SubBloque>

              {/* b) Aporte marginal */}
              <SubBloque
                letra="b"
                titulo="Aporte marginal: cuánto cuesta quitarla"
                descripcion="La medida honesta. No cuánto gana una estrategia, sino cuánto se pierde sin ella."
              >
                <Tabla minimo="34rem">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <Th>Si se quita</Th>
                      <Th alinear="right">Net/DD resultante</Th>
                      <Th alinear="right">Coste</Th>
                      <Th>Peso</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {APORTE_MARGINAL.map(a => (
                      <tr key={a.slug} className="transition-colors hover:bg-surface-raised">
                        <Td>
                          <Link
                            href={`/estrategias/${a.slug}`}
                            className="text-text-primary underline-offset-2 hover:underline"
                          >
                            {a.nombre}
                          </Link>
                        </Td>
                        <Td alinear="right" mono className="text-text-secondary">
                          {a.sinElla.toFixed(2)}
                        </Td>
                        <Td alinear="right" mono className="font-bold text-negative">
                          {a.coste.toFixed(2)}
                        </Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-raised">
                              <span
                                className="block h-full rounded-full bg-negative"
                                style={{ width: `${(Math.abs(a.coste) / 9.5) * 100}%` }}
                              />
                            </span>
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
                <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
                  Ninguna es prescindible: quitar la más floja cuesta casi dos puntos de Net/DD. Y el
                  orden <strong className="text-text-primary">no coincide</strong> con el de
                  contribución directa — el ZigZag aporta el 20 % del neto pero es solo el cuarto en
                  aporte marginal, mientras que el Weekend Effect aporta menos y cuesta más. Esa
                  discrepancia es exactamente el argumento de por qué se mide una cartera y no seis
                  sistemas sueltos.
                </p>
              </SubBloque>

              {/* c) Correlaciones */}
              <SubBloque
                letra="c"
                titulo="Correlación media contra correlación en los peores días"
                descripcion="Una cartera no la protege la correlación promedio, sino la correlación condicionada al momento en que todo va mal."
              >
                <Tabla minimo="30rem">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <Th>Par</Th>
                      <Th alinear="right">Media</Th>
                      <Th alinear="right">En el 10 % de peores días</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {CORRELACIONES.map(c => (
                      <tr key={c.par}>
                        <Td className="text-text-primary">{c.par}</Td>
                        <Td
                          alinear="right"
                          mono
                          className={c.media > 0.4 ? 'text-warning' : 'text-text-secondary'}
                        >
                          {c.media > 0 ? '+' : ''}
                          {c.media}
                        </Td>
                        <Td
                          alinear="right"
                          mono
                          className={
                            c.peoresDias == null
                              ? 'text-text-muted'
                              : 'font-bold text-positive'
                          }
                        >
                          {c.peoresDias ?? '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
                <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
                  El ZigZag correlaciona <strong className="text-text-primary">positivamente</strong> de
                  media con Momentum (+0,58) y Weekend (+0,46), lo que parecería redundante. Pero en los
                  días malos el signo se invierte en los tres pares: gana cuando los demás pierden. El
                  ZigZag y el RSI2 son las dos únicas piezas con protección de cola real.
                </p>
              </SubBloque>

              {/* d) Dependencia de régimen */}
              <SubBloque
                letra="d"
                titulo="Dependencia de régimen: el riesgo compartido"
                descripcion="Cuanto más bajo el cociente, menos depende la estrategia del cambio de mercado posterior a julio de 2020."
              >
                <Tabla minimo="38rem">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <Th>Estrategia</Th>
                      <Th alinear="right">t pre-2020</Th>
                      <Th alinear="right">t post-2020</Th>
                      <Th alinear="right">Ratio</Th>
                      <Th alinear="right">Neto pre-2020</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {DEPENDENCIA_REGIMEN.map(d => (
                      <tr key={d.slug} className="transition-colors hover:bg-surface-raised">
                        <Td>
                          <Link
                            href={`/estrategias/${d.slug}`}
                            className="text-text-primary underline-offset-2 hover:underline"
                          >
                            {d.nombre}
                          </Link>
                        </Td>
                        <Td
                          alinear="right"
                          mono
                          className={
                            d.tAnterior == null
                              ? 'text-text-muted'
                              : d.tAnterior < 0
                                ? 'text-negative'
                                : 'text-text-secondary'
                          }
                        >
                          {d.tAnterior ?? '—'}
                        </Td>
                        <Td alinear="right" mono className="text-text-secondary">
                          {d.tPosterior ?? '—'}
                        </Td>
                        <Td
                          alinear="right"
                          mono
                          className={
                            d.ratio === '∞' || parseFloat(d.ratio) > 3
                              ? 'font-bold text-warning'
                              : 'font-bold text-positive'
                          }
                        >
                          {d.ratio}
                        </Td>
                        <Td
                          alinear="right"
                          mono
                          className={
                            d.netoAnterior == null
                              ? 'text-text-muted'
                              : d.netoAnterior < 0
                                ? 'text-negative'
                                : 'text-text-secondary'
                          }
                        >
                          {d.netoAnterior != null ? fmtUsd(d.netoAnterior, 0) : '—'}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              </SubBloque>
            </div>
          </div>

          {/* ── Riesgo estructural ──────────────────────────────── */}
          <div className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-4">
            <h3 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-warning">
              {RIESGO_ESTRUCTURAL.titulo}
            </h3>
            <p className="mt-2 max-w-4xl text-xs leading-relaxed text-text-secondary">
              {RIESGO_ESTRUCTURAL.cuerpo}
            </p>

            {datos.regimen.anterior && datos.regimen.posterior && (
              <div className="mt-4">
                <Tabla minimo="36rem">
                  <thead>
                    <tr className="border-b border-warning/20">
                      <Th>Periodo</Th>
                      <Th alinear="right">Neto</Th>
                      <Th alinear="right">Max DD</Th>
                      <Th alinear="right">Net/DD</Th>
                      <Th alinear="right">Calmar</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warning/10">
                    <FilaRegimen etiqueta="2015 – junio 2020" bloque={datos.regimen.anterior} />
                    <FilaRegimen etiqueta="julio 2020 – hoy" bloque={datos.regimen.posterior} />
                    <FilaRegimen
                      etiqueta="Todo el histórico"
                      bloque={{
                        neto: r.neto,
                        drawdown: r.drawdown,
                        netoSobreDrawdown: r.netoSobreDrawdown,
                        calmar: r.calmar,
                      }}
                      destacada
                    />
                  </tbody>
                </Tabla>
              </div>
            )}

            <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
              {RIESGO_ESTRUCTURAL.cierre}
            </p>
          </div>

          {/* ── Dimensionamiento ────────────────────────────────── */}
          <Bloque
            titulo="Dimensionamiento"
            descripcion="El drawdown escala linealmente con el número de contratos. La cifra de la primera fila ya asume el peor escenario medido."
          >
            <Tabla minimo="42rem">
              <thead>
                <tr className="border-b border-border-subtle">
                  <Th>Tamaño</Th>
                  <Th alinear="right">DD esperado</Th>
                  <Th alinear="right">% de la cuenta</Th>
                  <Th alinear="right">$/año régimen malo</Th>
                  <Th alinear="right">$/año histórico</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {DIMENSIONAMIENTO.map(d => (
                  <tr key={d.contratos} className={d.recomendado ? 'bg-accent-muted' : undefined}>
                    <Td className={d.recomendado ? 'font-bold text-text-primary' : 'text-text-primary'}>
                      {d.contratos} contrato{d.contratos > 1 ? 's' : ''} por bot
                      {d.recomendado && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded border border-positive/40 bg-positive/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-positive">
                          <ShieldCheck size={9} />
                          Recomendado
                        </span>
                      )}
                    </Td>
                    <Td alinear="right" mono className="text-negative">
                      {fmtUsd(d.drawdown, 0)}
                    </Td>
                    <Td
                      alinear="right"
                      mono
                      className={d.porcentajeCuenta > 20 ? 'text-warning' : 'text-text-secondary'}
                    >
                      {d.porcentajeCuenta} %
                    </Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {fmtUsd(d.regimenMalo, 0)}
                    </Td>
                    <Td alinear="right" mono className="text-text-primary">
                      {fmtUsd(d.historico, 0)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {ESCENARIOS_ANUALES.map(e => (
                <div
                  key={e.escenario}
                  className={`rounded-lg border px-3 py-2.5 ${
                    'recomendado' in e && e.recomendado
                      ? 'border-accent bg-accent-muted'
                      : 'border-border-subtle bg-surface-raised'
                  }`}
                >
                  <p className="text-[10px] leading-tight text-text-muted">{e.escenario}</p>
                  <p className="mt-1 font-mono text-base font-bold tabular-nums text-text-primary">
                    {fmtUsd(e.dolares, 0)}
                  </p>
                  <p className="text-[10px] text-text-muted">{e.porcentaje} % sobre la cuenta</p>
                  {/* El Calmar del escenario se deriva del drawdown medido, no
                      se guarda: así nunca puede quedar desincronizado. */}
                  <p className="text-[10px] text-text-muted">
                    Calmar {(e.dolares / Math.abs(r.drawdown)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
              Se planifica con la media histórica: incluye ambos mundos y es lo más honesto que se puede
              decir sin saber cuál viene. Pero hay que estar preparado para que sean{' '}
              {fmtUsd(2118, 0)} durante varios años seguidos.
            </p>
          </Bloque>

          {/* ── Reglas operativas ───────────────────────────────── */}
          <Bloque
            titulo="Reglas operativas"
            descripcion="Condiciones bajo las que este resultado es alcanzable. No son recomendaciones genéricas."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {REGLAS_OPERATIVAS.map(regla => (
                <div key={regla.titulo} className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-3">
                  <p className="font-brand text-xs font-bold text-text-primary">{regla.titulo}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{regla.detalle}</p>
                </div>
              ))}
            </div>
          </Bloque>

          {/* ── Descartados ─────────────────────────────────────── */}
          <Bloque
            titulo="Lo que se probó y no entró"
            descripcion="Seis ideas sometidas a la misma metodología, con criterios fijados antes de mirar resultados. Las seis fallaron."
          >
            <Tabla minimo="46rem">
              <thead>
                <tr className="border-b border-border-subtle">
                  <Th>Idea</Th>
                  <Th alinear="right">Ops</Th>
                  <Th alinear="right">PF</Th>
                  <Th alinear="right">Probability</Th>
                  <Th>Motivo del descarte</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {DESCARTADOS.map(d => (
                  <tr key={d.idea}>
                    <Td className="text-text-primary">{d.idea}</Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {d.operaciones.toLocaleString('es-ES')}
                    </Td>
                    <Td alinear="right" mono className="text-text-secondary">
                      {d.profitFactor?.toFixed(2) ?? '—'}
                    </Td>
                    <Td
                      alinear="right"
                      mono
                      className={d.probability > 20 ? 'text-negative' : 'text-warning'}
                    >
                      {d.probability} %
                    </Td>
                    <Td className="whitespace-normal text-text-secondary">
                      <span className="block max-w-xl">{d.motivo}</span>
                      {'matiz' in d && d.matiz && (
                        <span className="mt-1 block max-w-xl text-[11px] text-text-muted">{d.matiz}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
            <p className="mt-3 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
              {LECCION_DESCARTES}
            </p>
          </Bloque>

          {/* ── Trazabilidad ────────────────────────────────────── */}
          <section className="rounded-lg border border-border-subtle bg-surface px-4 py-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Trazabilidad de la cartera
            </h3>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-text-secondary">
              <li>
                · La curva combinada no es una estimación: se construye sumando el resultado diario real
                de las {r.operaciones.toLocaleString('es-ES')} operaciones de los seis backtests,
                atribuido por fecha de salida.
              </li>
              <li>· El drawdown se mide sobre la serie combinada, no se estima.</li>
              <li>
                · Periodo: {r.desde} a {r.hasta}. Comisión NinjaTrader Brokerage y deslizamiento de 2
                ticks. Cifras escaladas a MNQ dividiendo por 10.
              </li>
              <li>
                · Fuente: expediente <em>Portafolio de bots</em>, {CARTERA_META.fecha}.{' '}
                {CARTERA_META.autor}.
              </li>
              <li className="pt-1 text-text-muted">
                Los resultados presentados son de simulación histórica y no garantizan comportamiento
                futuro. Documento interno; no constituye asesoramiento financiero.
              </li>
            </ul>
          </section>
        </>
      )}
    </section>
  )
}

// ───────────────────────────── auxiliares ──────────────────────────────

function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface">
      <header className="border-b border-border-subtle px-4 py-3">
        <h3 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-primary">
          {titulo}
        </h3>
        {descripcion && (
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-text-secondary">{descripcion}</p>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function SubBloque({
  letra,
  titulo,
  descripcion,
  children,
}: {
  letra: string
  titulo: string
  descripcion: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent font-mono text-[10px] font-bold text-on-accent">
          {letra}
        </span>
        <div className="min-w-0">
          <p className="font-brand text-xs font-bold text-text-primary">{titulo}</p>
          <p className="mt-0.5 max-w-4xl text-[11px] leading-relaxed text-text-secondary">
            {descripcion}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Tabla({ children, minimo }: { children: React.ReactNode; minimo: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full" style={{ minWidth: minimo }}>
        {children}
      </table>
    </div>
  )
}

const ALINEACION = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

function Th({
  children,
  alinear = 'left',
}: {
  children: React.ReactNode
  alinear?: keyof typeof ALINEACION
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted ${ALINEACION[alinear]}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  alinear = 'left',
  mono = false,
  className = '',
}: {
  children: React.ReactNode
  alinear?: keyof typeof ALINEACION
  mono?: boolean
  className?: string
}) {
  return (
    <td
      className={`px-3 py-2 text-xs ${ALINEACION[alinear]} ${mono ? 'whitespace-nowrap font-mono tabular-nums' : 'whitespace-nowrap'} ${className}`}
    >
      {children}
    </td>
  )
}

function FilaRegimen({
  etiqueta,
  bloque,
  destacada,
}: {
  etiqueta: string
  bloque: BloqueRegimenCartera
  destacada?: boolean
}) {
  return (
    <tr className={destacada ? 'font-bold' : undefined}>
      <Td className="text-text-primary">{etiqueta}</Td>
      <Td alinear="right" mono className={bloque.neto >= 0 ? 'text-positive' : 'text-negative'}>
        {fmtUsd(bloque.neto, 0)}
      </Td>
      <Td alinear="right" mono className="text-negative">
        {fmtUsd(bloque.drawdown, 0)}
      </Td>
      <Td alinear="right" mono className="text-text-primary">
        {bloque.netoSobreDrawdown?.toFixed(2) ?? '—'}
      </Td>
      <Td alinear="right" mono className="text-text-primary">
        {bloque.calmar?.toFixed(2) ?? '—'}
      </Td>
    </tr>
  )
}

function BarraComparativa({
  etiqueta,
  valor,
  maximo,
  tono,
}: {
  etiqueta: string
  valor: number
  maximo: number
  tono: 'positivo' | 'negativo'
}) {
  const ancho = Math.min(100, (Math.abs(valor) / maximo) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-text-secondary">{etiqueta}</span>
        <span
          className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
            tono === 'positivo' ? 'text-positive' : 'text-negative'
          }`}
        >
          {fmtUsd(valor, 0)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full ${tono === 'positivo' ? 'bg-positive' : 'bg-negative'}`}
          style={{ width: `${ancho}%` }}
        />
      </div>
    </div>
  )
}
