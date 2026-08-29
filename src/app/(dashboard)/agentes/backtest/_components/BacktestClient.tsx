'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, FlaskConical, AlertTriangle } from 'lucide-react'
import { AGENT_COLORS } from '@/components/charts/chart-theme'
import {
  ETIQUETA_CAPA, ETIQUETA_CRITERIO, ETIQUETA_ROBUSTEZ,
  type CorteMetricas, type ResumenPublicado, type VariantePublicada,
} from '@/lib/backtest/publicado'
import { CurvaBacktest } from './CurvaBacktest'

/* ── Formato ─────────────────────────────────────────────────────────────── */

const pct = (x: number | null, d = 2) => (x == null ? '—' : `${(x * 100).toFixed(d)} %`)
const num = (x: number | null, d = 2) => (x == null ? '—' : x.toFixed(d))
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })

/** Verde si suma, rojo si resta, neutro si es exactamente cero. */
function tono(x: number): string {
  if (x > 0) return 'var(--color-positive)'
  if (x < 0) return 'var(--color-negative)'
  return 'var(--color-text-secondary)'
}

/* ── Piezas de presentación ──────────────────────────────────────────────── */

function Panel({ titulo, descripcion, children }: {
  titulo: string
  descripcion?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface">
      <header className="border-b border-border-subtle px-4 py-3">
        <h2 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-primary">
          {titulo}
        </h2>
        {descripcion && (
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">{descripcion}</p>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Kpi({ etiqueta, valor, nota, color }: {
  etiqueta: string
  valor: string
  nota?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">{etiqueta}</p>
      <p className="mt-1 font-mono text-lg font-bold leading-none" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {valor}
      </p>
      {nota && <p className="mt-1 text-[10px] leading-tight text-text-muted">{nota}</p>}
    </div>
  )
}

/** Tabla compacta con scroll horizontal propio: nunca desborda la página. */
function Tabla({ cabeceras, children, min = 520 }: {
  cabeceras: string[]
  children: ReactNode
  min?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: min }}>
        <thead>
          <tr className="border-b border-border-subtle">
            {cabeceras.map((c, i) => (
              <th
                key={c}
                className={`px-2 py-2 font-medium text-text-secondary ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Celda({ children, alineada = 'right', mono = true }: {
  children: ReactNode
  alineada?: 'left' | 'right'
  mono?: boolean
}) {
  return (
    <td
      className={`px-2 py-2 ${alineada === 'right' ? 'text-right' : 'text-left'} ${mono ? 'font-mono' : ''} text-text-primary`}
    >
      {children}
    </td>
  )
}

/** Tres columnas de la misma variante: CAGR, Sharpe e IR. */
function FilaCorte({ nombre, corte, referencia }: {
  nombre: string
  corte: CorteMetricas
  /** CAGR contra el que se compara, para colorear la diferencia. */
  referencia?: number
}) {
  const delta = referencia == null ? null : corte.cagr - referencia
  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="px-2 py-2 text-text-primary">{nombre}</td>
      <Celda>{pct(corte.cagr)}</Celda>
      {delta != null && (
        <Celda>
          <span style={{ color: tono(delta) }}>{delta > 0 ? '+' : ''}{pct(delta)}</span>
        </Celda>
      )}
      <Celda>{num(corte.sharpe)}</Celda>
      <Celda>
        <span style={{ color: tono(corte.informationRatio) }}>{num(corte.informationRatio)}</span>
      </Celda>
    </tr>
  )
}

/* ── Página ──────────────────────────────────────────────────────────────── */

const COLOR_VARIANTE: Record<string, string> = {
  peter: AGENT_COLORS.Peter,
  'peter-lynch': AGENT_COLORS.Peter,
  small: AGENT_COLORS.Small,
  'small-lynch': AGENT_COLORS.Small,
}

/** Nombre corto de cada variante para las pestañas y la tabla comparativa. */
function nombreVariante(v: VariantePublicada): string {
  return `${v.agente} · ${v.capas === 'lynch' ? 'solo Lynch' : 'cascada'}`
}

export default function BacktestClient({ resumen }: { resumen: ResumenPublicado }) {
  const [id, setId] = useState(resumen.variantes[0]?.id ?? '')
  const v = resumen.variantes.find(x => x.id === id) ?? resumen.variantes[0]
  const color = COLOR_VARIANTE[v.id] ?? AGENT_COLORS.Peter

  const excesoCagr = v.base.cagr - v.benchmark.cagr

  return (
    <div className="space-y-6">

      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <FlaskConical size={20} className="text-on-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-brand text-lg font-extrabold text-text-primary">Backtest de los agentes de acciones</h1>
          <p className="text-sm text-text-secondary">
            Peter y Small, con y sin las capas técnicas, contra su índice de referencia
          </p>
        </div>
        <Link
          href="/agentes"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <ArrowLeft size={13} /> Agentes
        </Link>
      </div>

      {/* Aviso de ventana. Va antes que cualquier cifra: leer el CAGR sin saber
          que hay 28 meses de un solo régimen es leerlo mal. */}
      <div
        className="flex gap-2.5 rounded-xl p-3.5"
        style={{ border: '1px solid rgba(245, 165, 36, 0.25)', background: 'rgba(245, 165, 36, 0.06)' }}
      >
        <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
        <div className="space-y-1.5 text-xs leading-relaxed text-text-secondary">
          <p>
            <strong className="text-text-primary">La ventana es de {resumen.ventana.nMeses} meses</strong>{' '}
            ({fecha(resumen.ventana.desde)} → {fecha(resumen.ventana.hasta)}), no de los cuatro años
            que abarcan los precios. El criterio de crecimiento necesita dos ejercicios anuales
            publicados y la fuente gratuita solo da cuatro, de los cuales el más antiguo llega sin
            beneficio neto: antes de esa fecha el screener no puede decidir nada, y una cartera
            vacía no es un resultado.
          </p>
          <p>
            Con esa muestra, ninguna variante alcanza significación estadística convencional. Los
            números de abajo sirven para <strong className="text-text-primary">comparar variantes entre sí</strong>,
            que es una pregunta que la muestra sí responde, no para afirmar que un agente bate al
            mercado.
          </p>
        </div>
      </div>

      {/* Selector de variante */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-background p-1 w-fit">
        {resumen.variantes.map(x => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            className={[
              'flex items-center gap-2 rounded-lg px-3.5 py-2 font-mono text-xs font-semibold transition-all',
              x.id === v.id
                ? 'bg-accent text-on-accent'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
            ].join(' ')}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: COLOR_VARIANTE[x.id] }}
            />
            {nombreVariante(x).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Resultado de la variante seleccionada */}
      <Panel
        titulo={`Resultado · ${nombreVariante(v)}`}
        descripcion={
          <>
            {v.capasDescripcion}. Medido contra <strong className="text-text-primary">{v.benchmark.ticker}</strong>
            {v.mercadoAmplio && <> y situado frente a {v.mercadoAmplio.ticker} como coste de oportunidad</>}.
            Rebalanceo mensual, {v.base.nOperaciones.toLocaleString('es-ES')} operaciones,{' '}
            {num(v.base.posicionesMedias, 1)} posiciones de media.
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            etiqueta="CAGR"
            valor={pct(v.base.cagr)}
            nota={`${v.benchmark.ticker} ${pct(v.benchmark.cagr)}`}
            color={color}
          />
          <Kpi
            etiqueta="Exceso anual"
            valor={`${excesoCagr > 0 ? '+' : ''}${pct(excesoCagr)}`}
            nota="sobre su índice"
            color={tono(excesoCagr)}
          />
          <Kpi etiqueta="Sharpe" valor={num(v.base.sharpe)} nota={`${v.benchmark.ticker} ${num(v.benchmark.sharpe)}`} />
          <Kpi
            etiqueta="Information ratio"
            valor={num(v.base.informationRatio)}
            nota="exceso / tracking error"
            color={tono(v.base.informationRatio)}
          />
          <Kpi etiqueta="Caída máxima" valor={pct(v.base.maxDrawdown)} nota={`${v.benchmark.ticker} ${pct(v.benchmark.maxDrawdown)}`} />
          <Kpi
            etiqueta="t-stat"
            valor={num(v.base.tStat)}
            nota={`p = ${num(v.base.pValor, 3)} · umbral 2,0`}
            color={Math.abs(v.base.tStat) >= 2 ? 'var(--color-positive)' : 'var(--color-warning)'}
          />
        </div>

        <div className="mt-4">
          <CurvaBacktest
            cartera={v.curvas.cartera}
            benchmark={v.curvas.benchmark}
            mercadoAmplio={v.curvas.mercadoAmplio}
            nombreCartera={nombreVariante(v)}
            tickerBenchmark={v.benchmark.ticker}
            tickerMercadoAmplio={v.mercadoAmplio?.ticker}
            color={color}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi etiqueta="Retorno acumulado" valor={pct(v.base.retornoTotal)} nota={`${v.benchmark.ticker} ${pct(v.benchmark.retornoTotal)}`} />
          <Kpi etiqueta="Volatilidad anual" valor={pct(v.base.volatilidadAnual)} nota={`${v.benchmark.ticker} ${pct(v.benchmark.volatilidadAnual)}`} />
          <Kpi etiqueta="Alfa anual" valor={pct(v.base.alphaAnual)} nota={`beta ${num(v.base.beta)}`} color={tono(v.base.alphaAnual)} />
          <Kpi etiqueta="Aciertos" valor={pct(v.base.hitRate, 1)} nota="operaciones cerradas en positivo" />
        </div>
      </Panel>

      {/* Comparativa de las cuatro variantes */}
      <Panel
        titulo="Las cuatro variantes, lado a lado"
        descripcion={
          <>
            Cada agente se corrió dos veces: con la cascada completa y con el screener Lynch
            solo. El benchmark lo fija la clase de activo —Peter contra SPY, Small contra IJR—
            porque medir una cartera de pequeña capitalización contra el S&amp;P 500 mide el
            segmento, no la selección.
          </>
        }
      >
        <Tabla
          cabeceras={['Variante', 'Índice', 'CAGR', 'Índice', 'Sharpe', 'IR', 't-stat', 'Percentil control']}
          min={640}
        >
          {resumen.variantes.map(x => (
            <tr
              key={x.id}
              className={`border-b border-border-subtle last:border-0 ${x.id === v.id ? 'bg-surface-raised' : ''}`}
            >
              <td className="px-2 py-2">
                <button
                  onClick={() => setId(x.id)}
                  className="flex items-center gap-2 text-left text-text-primary hover:underline"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLOR_VARIANTE[x.id] }} />
                  {nombreVariante(x)}
                </button>
              </td>
              <Celda>{x.benchmark.ticker}</Celda>
              <Celda>{pct(x.base.cagr)}</Celda>
              <Celda><span className="text-text-secondary">{pct(x.benchmark.cagr)}</span></Celda>
              <Celda>{num(x.base.sharpe)}</Celda>
              <Celda><span style={{ color: tono(x.base.informationRatio) }}>{num(x.base.informationRatio)}</span></Celda>
              <Celda>{num(x.base.tStat)}</Celda>
              <Celda>{num(x.control.percentil, 1)}</Celda>
            </tr>
          ))}
        </Tabla>
        <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
          El percentil de control compara la cartera real contra {resumen.variantes[0].control.nCarteras}{' '}
          carteras aleatorias emparejadas por sector y decil de tamaño. Emparejarlas importa: sin
          eso mediría exposición sectorial en vez de calidad del filtro.
        </p>
      </Panel>

      {/* Atribución */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Qué aporta cada capa"
          descripcion="El embudo de producción encadena screener fundamental, proyección y momentum. Corriendo cada capa por separado se ve cuál sostiene el resultado."
        >
          <Tabla cabeceras={['Capa', 'CAGR', 'Sharpe', 'IR']} min={360}>
            {Object.entries(v.porCapa).map(([k, corte]) => (
              <FilaCorte key={k} nombre={ETIQUETA_CAPA[k] ?? k} corte={corte} />
            ))}
          </Tabla>
          {v.capas !== 'lynch+tecnico' && (
            <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
              La fila de la cascada completa se publica solo en la corrida que la simula. Cámbiate
              a la variante «cascada» de este agente para verla.
            </p>
          )}
        </Panel>

        <Panel
          titulo="Qué aporta cada criterio"
          descripcion="Se retira un criterio del screener y se vuelve a correr todo. Si quitarlo mejora el resultado, ese criterio está restando."
        >
          <Tabla cabeceras={['Sin este criterio', 'CAGR', 'Δ CAGR', 'Sharpe', 'IR']} min={420}>
            {Object.entries(v.leaveOneOut).map(([k, corte]) => (
              <FilaCorte
                key={k}
                nombre={ETIQUETA_CRITERIO[k.replace('sin_', '')] ?? k}
                corte={corte}
                referencia={v.base.cagr}
              />
            ))}
          </Tabla>
        </Panel>
      </div>

      {/* Tramos anuales */}
      <Panel
        titulo="Año a año"
        descripcion="Un resultado que solo vive en un año es un año bueno, no una ventaja. Los tramos sin datos utilizables se declaran vacíos en vez de pintarse como cero."
      >
        <Tabla cabeceras={['Tramo', 'Meses', 'Retorno acumulado', 'Exceso medio mensual']} min={440}>
          {v.subperiodos.map(s => (
            <tr key={s.nombre} className="border-b border-border-subtle last:border-0">
              <td className="px-2 py-2 text-text-primary">{s.nombre}</td>
              <Celda>{s.nPeriodos || '—'}</Celda>
              <Celda>
                {s.retornoAcumulado == null
                  ? <span className="text-text-muted">sin datos</span>
                  : pct(s.retornoAcumulado)}
              </Celda>
              <Celda>
                {s.retornoActivoMedio == null
                  ? <span className="text-text-muted">—</span>
                  : <span style={{ color: tono(s.retornoActivoMedio) }}>{pct(s.retornoActivoMedio)}</span>}
              </Celda>
            </tr>
          ))}
        </Tabla>
      </Panel>

      {/* Robustez y contrastes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Robustez"
          descripcion="El mismo backtest con una decisión metodológica cambiada cada vez. Un resultado que solo sobrevive a una de ellas no es un resultado."
        >
          <Tabla cabeceras={['Variante', 'CAGR', 'Δ CAGR', 'Sharpe', 'IR']} min={420}>
            {Object.entries(v.robustez).map(([k, corte]) => (
              <FilaCorte key={k} nombre={ETIQUETA_ROBUSTEZ[k] ?? k} corte={corte} referencia={v.base.cagr} />
            ))}
          </Tabla>
        </Panel>

        <Panel
          titulo="Contrastes estadísticos"
          descripcion="Qué probabilidad hay de ver este resultado sin que exista ninguna ventaja real."
        >
          <dl className="divide-y divide-border-subtle">
            {[
              {
                etiqueta: 't-stat del exceso',
                valor: num(v.ventaja.tStat),
                nota: `p = ${num(v.ventaja.pValor, 3)}. El umbral convencional es 2,0; por debajo, el exceso no se distingue del azar.`,
              },
              {
                etiqueta: 'Bootstrap por bloques',
                valor: `p = ${num(v.ventaja.bootstrapPValor, 3)}`,
                nota: 'Remuestreo en bloques, que conserva la autocorrelación mensual que un remuestreo simple destruiría.',
              },
              {
                etiqueta: 'Deflated Sharpe',
                valor: num(v.ventaja.deflatedSharpeProbabilidad),
                nota: `Corregido por las ${v.ventaja.nConfiguracionesProbadas} configuraciones probadas. Solo por azar, la mejor de ellas ya daría un Sharpe de ${num(v.ventaja.sharpeEsperadoPorAzar)}.`,
              },
              {
                etiqueta: 'Test de control',
                valor: `percentil ${num(v.control.percentil, 1)}`,
                nota: `CAGR de la cartera real ${pct(v.control.cagrBase)} frente a ${pct(v.control.cagrControlMediano)} de la mediana de ${v.control.nCarteras} carteras aleatorias emparejadas.`,
              },
            ].map(f => (
              <div key={f.etiqueta} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted sm:pt-1">
                  {f.etiqueta}
                </dt>
                <dd className="min-w-0">
                  <p className="font-mono text-sm text-text-primary">{f.valor}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">{f.nota}</p>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {/* Muestra y paridad */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="La muestra"
          descripcion="De dónde salen los datos y qué se sabe de lo que falta."
        >
          <Tabla cabeceras={['Concepto', 'Valor']} min={320}>
            {[
              ['Tickers del universo', v.muestra.tickersDeclarados.toLocaleString('es-ES')],
              ['Con precios utilizables', v.muestra.tickersConDatos.toLocaleString('es-ES')],
              ['Sin precios (cota de sesgo de supervivencia)', `${v.muestra.tickersSinPrecios} · ${num(v.muestra.sesgoSupervivenciaPct, 1)} %`],
              ['Ejercicios anuales por ticker (mediana)', String(v.muestra.medianaEjerciciosConDatos)],
              ['Rebalanceos', String(v.muestra.nRebalanceos)],
              ['Meses iniciales en liquidez', String(v.muestra.mesesInicialesEnLiquidez)],
              ['Ventana', `${v.muestra.desde} → ${v.muestra.hasta}`],
            ].map(([k, val]) => (
              <tr key={k} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2 text-text-secondary">{k}</td>
                <Celda>{val}</Celda>
              </tr>
            ))}
          </Tabla>
        </Panel>

        {v.paridad && (
          <Panel
            titulo="Paridad con el screener en vivo"
            descripcion="Cuánto se parece el panel reconstruido a lo que el screener de producción decide hoy, criterio a criterio. Es el control de calidad de la reconstrucción, no un resultado de inversión."
          >
            <Tabla cabeceras={['Criterio', 'Acuerdo']} min={320}>
              {Object.entries(v.paridad.acuerdoPorCriterio).map(([k, acuerdo]) => (
                <tr key={k} className="border-b border-border-subtle last:border-0">
                  <td className="px-2 py-2 text-text-secondary">{ETIQUETA_CRITERIO[k] ?? k}</td>
                  <Celda>
                    <span style={{ color: acuerdo >= 0.85 ? 'var(--color-positive)' : 'var(--color-warning)' }}>
                      {pct(acuerdo, 1)}
                    </span>
                  </Celda>
                </tr>
              ))}
            </Tabla>
            <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
              {v.paridad.comparados} tickers comparados, solapamiento de selección{' '}
              {pct(v.paridad.jaccard, 1)}. Los dos criterios que peor concuerdan —P/E proyectado y
              PEG— son los que dependen de una estimación de crecimiento: el backtest la extrapola
              de lo ya publicado porque no existe histórico de consenso, y esa diferencia se declara
              en vez de disimularse.
            </p>
          </Panel>
        )}
      </div>

      {/* Conclusiones */}
      <Panel titulo="Qué se concluye" descripcion="Y qué no.">
        <ul className="space-y-3">
          {[
            {
              titulo: 'Quitar las capas técnicas mejora las cuatro métricas',
              detalle: 'CAGR, Sharpe, information ratio y t-stat suben en ambos agentes al dejar solo el screener Lynch. Es la comparación más limpia del estudio: dos configuraciones, no veinte, así que no hay margen para el sobreajuste de barrido.',
              positivo: true,
            },
            {
              titulo: 'Small solo-Lynch bate a su índice y a las carteras de control',
              detalle: 'Information ratio positivo contra IJR y percentil 99,5 frente a carteras aleatorias emparejadas por sector y tamaño. El screener sí selecciona en pequeña capitalización.',
              positivo: true,
            },
            {
              titulo: 'En gran capitalización el screener no selecciona',
              detalle: 'Peter queda por debajo del SPY en las dos configuraciones y su percentil de control ronda la mediana. El mismo filtro que funciona en small caps no distingue nada en el S&P 500.',
              positivo: false,
            },
            {
              titulo: 'Nada de esto tiene significación estadística',
              detalle: 'Con 28 meses el mejor t-stat es 0,82, muy por debajo del umbral de 2,0. Es un indicio consistente, no una demostración: el resultado se confirma con datos point-in-time de varios ciclos o con un forward-test en vivo, no alargando la interpretación de esta muestra.',
              positivo: false,
            },
            {
              titulo: 'Los umbrales no se recalibran con esto',
              detalle: 'El barrido de sensibilidad da una superficie errática, con óptimos aislados rodeados de valles. Esa es la firma del ruido. Ajustar los cortes sobre 28 meses de un solo régimen sería sobreajuste, así que las capas técnicas quedan bajo sospecha pero no se retiran de producción.',
              positivo: false,
            },
          ].map(c => (
            <li key={c.titulo} className="flex gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: c.positivo ? 'var(--color-positive)' : 'var(--color-warning)' }}
              />
              <span className="text-xs leading-relaxed text-text-secondary">
                <strong className="text-text-primary">{c.titulo}.</strong> {c.detalle}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="text-[10px] text-text-muted">
        Cifras de la ejecución del {new Date(v.generado).toLocaleDateString('es-ES', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}, publicadas con <span className="font-mono">npm run backtest:publicar</span>. No se
        recalcula nada en esta pantalla: cada número sale tal cual del backtest.
      </p>
    </div>
  )
}
