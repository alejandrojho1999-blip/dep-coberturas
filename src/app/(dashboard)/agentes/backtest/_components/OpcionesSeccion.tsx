'use client'

import { useState, type ReactNode } from 'react'
import { AlertTriangle, Target, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { AGENT_COLORS } from '@/components/charts/chart-theme'
import type { ResumenOpciones, VarianteOpciones } from '@/lib/backtest/opciones-publicado'
import { CurvaBacktest } from './CurvaBacktest'

const pct = (x: number | null, d = 2) => (x == null ? '—' : `${(x * 100).toFixed(d)} %`)
const num = (x: number | null, d = 2) => (x == null ? '—' : x.toFixed(d))
const tono = (x: number) =>
  x > 0 ? 'var(--color-positive)' : x < 0 ? 'var(--color-negative)' : 'var(--color-text-secondary)'
const tamano = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} kB`

function Panel({ titulo, descripcion, children }: {
  titulo: string; descripcion?: ReactNode; children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface">
      <header className="border-b border-border-subtle px-4 py-3">
        <h2 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-primary">{titulo}</h2>
        {descripcion && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">{descripcion}</p>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Kpi({ etiqueta, valor, nota, color }: {
  etiqueta: string; valor: string; nota?: string; color?: string
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">{etiqueta}</p>
      <p className="mt-1 font-mono text-lg font-bold leading-none" style={{ color: color ?? 'var(--color-text-primary)' }}>{valor}</p>
      {nota && <p className="mt-1 text-[10px] leading-tight text-text-muted">{nota}</p>}
    </div>
  )
}

function Tabla({ cabeceras, children, min = 480 }: {
  cabeceras: string[]; children: ReactNode; min?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: min }}>
        <thead>
          <tr className="border-b border-border-subtle">
            {cabeceras.map((c, i) => (
              <th key={c} className={`px-2 py-2 font-medium text-text-secondary ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/**
 * Barrido del supuesto de volatilidad, como barras.
 *
 * Es el panel más importante de esta sección: enseña que el resultado de cada
 * agente es una **función del supuesto**, no un número. En Gamma el signo se da
 * la vuelta al cruzar el valor calibrado, y eso hay que poder verlo de un
 * vistazo en vez de deducirlo de una tabla.
 */
function Barrido({ puntos, color }: {
  puntos: Array<{ k: number; cagr: number; calibrado: boolean }>
  color: string
}) {
  const max = Math.max(...puntos.map(p => Math.abs(p.cagr)), 0.01)

  return (
    <div className="space-y-1">
      {puntos.map(p => {
        const ancho = (Math.abs(p.cagr) / max) * 50
        const positivo = p.cagr >= 0
        return (
          <div key={p.k} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-mono text-[10px] text-text-muted">{p.k.toFixed(2)}</span>
            <div className="relative h-4 flex-1">
              {/* Eje del cero en el centro: el signo importa más que la magnitud. */}
              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <div
                className="absolute inset-y-0.5 rounded-sm"
                style={{
                  width: `${ancho}%`,
                  left: positivo ? '50%' : `${50 - ancho}%`,
                  background: positivo ? color : 'var(--color-negative)',
                  opacity: p.calibrado ? 1 : 0.45,
                }}
              />
            </div>
            <span
              className="w-16 shrink-0 text-right font-mono text-[10px]"
              style={{ color: tono(p.cagr) }}
            >
              {pct(p.cagr, 1)}
            </span>
            <span className="w-16 shrink-0 text-[9px] text-text-muted">
              {p.calibrado ? '← calibrado' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function OpcionesSeccion({ resumen }: { resumen: ResumenOpciones }) {
  const [id, setId] = useState(resumen.variantes[0]?.id ?? '')
  const v: VarianteOpciones | undefined = resumen.variantes.find(x => x.id === id) ?? resumen.variantes[0]
  if (!v) return null

  const prima = resumen.primaDeVarianzaObservada
  // Las operaciones del estudio completo, no las de la corrida en pantalla: el
  // dataset descargable las lleva todas.
  const totalOperaciones = resumen.variantes.reduce(
    (a, x) => a + x.agentes.reduce((b, ag) => b + ag.metricas.nOperaciones, 0), 0,
  )

  return (
    <div className="space-y-4">

      {/* El aviso va antes que cualquier cifra: sin él, los números de abajo se
          leen como si midieran algo que no miden. */}
      <div
        className="flex gap-2.5 rounded-xl p-3.5"
        style={{ border: '1px solid rgba(245, 165, 36, 0.25)', background: 'rgba(245, 165, 36, 0.06)' }}
      >
        <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-warning)' }} />
        <div className="space-y-1.5 text-xs leading-relaxed text-text-secondary">
          <p>
            <strong className="text-text-primary">Estas primas no existieron: están reconstruidas.</strong>{' '}
            No hay histórico gratuito de cadenas de opciones, así que cada contrato se valora con
            Black-Scholes a partir del subyacente, el plazo, el tipo del día y una volatilidad
            implícita <em>modelada</em>. Lo único observable hacia atrás es la volatilidad realizada.
          </p>
          <p>
            Eso deja <strong className="text-text-primary">un supuesto libre</strong>, y no es
            inocente: la ventaja de un vendedor de opciones <em>es</em> que la implícita cotice por
            encima de la realizada. Por eso el supuesto no se elige, se{' '}
            <strong className="text-text-primary">calibra contra <span className="font-mono">^PUT</span></strong>,
            un índice del CBOE que vende puts sobre el S&amp;P 500 con precios reales desde 2005 — y
            aun así el resultado se publica como curva sobre el supuesto, nunca como cifra única.
          </p>
        </div>
      </div>

      {/* Selector de corrida */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border-subtle bg-background p-1">
        {resumen.variantes.map(x => (
          <button
            key={x.id}
            onClick={() => setId(x.id)}
            className={[
              'rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all',
              x.id === v.id ? 'bg-accent text-on-accent' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
            ].join(' ')}
          >
            {x.descripcionModo}
          </button>
        ))}
      </div>

      {/* Calibración */}
      <Panel
        titulo="Calibración contra ^PUT"
        descripcion={
          <>
            Se replica el índice PutWrite del CBOE con la cadena sintética y se busca el
            multiplicador de volatilidad que mejor lo reproduce. Si la réplica no siguiera al índice
            real, el modelo no valdría y no habría nada que publicar.
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi
            etiqueta="Multiplicador ajustado"
            valor={num(v.calibracion.kOptimo)}
            nota="el que mejor replica ^PUT"
          />
          <Kpi
            etiqueta="Correlación"
            valor={num(v.calibracion.correlacion)}
            nota="réplica contra índice real"
            color={v.calibracion.correlacion >= 0.9 ? 'var(--color-positive)' : 'var(--color-warning)'}
          />
          <Kpi etiqueta="Error de seguimiento" valor={pct(v.calibracion.errorSeguimiento)} nota="anualizado" />
          <Kpi
            etiqueta="Prima observada"
            valor={num(prima.mediana)}
            nota={`mediana VIX / realizada · p10 ${num(prima.p10)} · p90 ${num(prima.p90)}`}
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
          <strong className="text-text-secondary">El multiplicador ajustado no es la prima de riesgo
          de varianza</strong>, aunque se le parezca. La prima real es claramente positiva —la
          mediana de VIX sobre volatilidad realizada es {num(prima.mediana)} en estos 21 años—,
          mientras que el ajuste cae por debajo de 1. Lo que absorbe es el sesgo de valorar una
          opción a 30 días con la volatilidad de los 20 días <em>anteriores</em>: la volatilidad
          revierte a la media, y tras un susto la pasada sobreestima con mucho a la futura. Es una
          constante de ajuste, no una medida del mercado.
        </p>
      </Panel>

      {/* Los dos agentes */}
      {v.agentes.map(a => {
        const color = AGENT_COLORS[a.nombre] ?? AGENT_COLORS.Gamma
        const arruinado = a.metricas.cagr <= -0.999
        const exceso = a.metricas.cagr - a.benchmark.cagr

        return (
          <Panel
            key={a.id}
            titulo={`Agente ${a.nombre}`}
            descripcion={
              <>
                {a.descripcion} Medido contra{' '}
                <strong className="text-text-primary font-mono">{a.benchmark.ticker}</strong>,{' '}
                {a.metricas.nOperaciones.toLocaleString('es-ES')} operaciones sobre{' '}
                {resumen.ventana.nVencimientos} vencimientos.
              </>
            }
          >
            {arruinado && (
              <div
                className="mb-3 flex gap-2 rounded-lg p-3"
                style={{ border: '1px solid rgba(240, 68, 56, 0.3)', background: 'rgba(240, 68, 56, 0.08)' }}
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--color-negative)' }} />
                <p className="text-xs leading-relaxed text-text-secondary">
                  <strong style={{ color: 'var(--color-negative)' }}>La cartera se arruinó.</strong>{' '}
                  Vender opciones puede costar más que la prima cobrada: cuando el subyacente se
                  desploma, la obligación de recomprar supera lo que hay en caja. En esta
                  configuración el patrimonio llegó a cero y la simulación se detuvo ahí.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi
                etiqueta="CAGR"
                valor={pct(a.metricas.cagr)}
                nota={`${a.benchmark.ticker} ${pct(a.benchmark.cagr)}`}
                color={arruinado ? 'var(--color-negative)' : color}
              />
              <Kpi etiqueta="Exceso anual" valor={`${exceso > 0 ? '+' : ''}${pct(exceso)}`} nota="sobre su índice" color={tono(exceso)} />
              <Kpi etiqueta="Sharpe" valor={num(a.metricas.sharpe)} nota={`${a.benchmark.ticker} ${num(a.benchmark.sharpe)}`} />
              <Kpi etiqueta="Information ratio" valor={num(a.metricas.informationRatio)} color={tono(a.metricas.informationRatio)} nota="exceso / tracking error" />
              <Kpi etiqueta="Caída máxima" valor={pct(a.metricas.maxDrawdown)} nota={`${a.benchmark.ticker} ${pct(a.benchmark.maxDrawdown)}`} />
              <Kpi
                etiqueta="t-stat"
                valor={num(a.metricas.tStat)}
                nota="umbral convencional 2,0"
                color={Math.abs(a.metricas.tStat) >= 2 ? 'var(--color-positive)' : 'var(--color-warning)'}
              />
            </div>

            <div className="mt-4">
              <CurvaBacktest
                cartera={a.curva}
                benchmark={resumen.benchmarkCurvas[a.id] ?? []}
                mercadoAmplio={null}
                nombreCartera={`Agente ${a.nombre}`}
                tickerBenchmark={a.benchmark.ticker}
                color={color}
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Kpi etiqueta="Aciertos" valor={pct(a.metricas.hitRate, 1)} nota="operaciones en positivo" />
              <Kpi etiqueta="Volatilidad anual" valor={pct(a.metricas.volatilidadAnual)} nota={`${a.benchmark.ticker} ${pct(a.benchmark.volatilidadAnual)}`} />
              <Kpi
                etiqueta="Vencimientos en blanco"
                valor={`${a.metricas.vencimientosSinPosiciones}/${resumen.ventana.nVencimientos}`}
                nota="sin ninguna posición abierta"
              />
            </div>

            <div className="mt-4 rounded-lg border border-border-subtle p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Target size={12} className="text-text-muted" />
                <h4 className="font-mono text-[10px] font-bold tracking-wide text-text-muted">
                  DE QUÉ DEPENDE ESTE NÚMERO
                </h4>
              </div>
              <Barrido puntos={a.barrido} color={color} />
              <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                CAGR según el multiplicador de volatilidad supuesto. La barra opaca es el valor
                calibrado contra <span className="font-mono">^PUT</span>; las demás enseñan qué
                habría salido con otro supuesto.
              </p>
            </div>
          </Panel>
        )
      })}

      {/* Tabla comparativa de las corridas */}
      <Panel
        titulo="Las cuatro corridas"
        descripcion="Cada una cambia una decisión metodológica. Un resultado que solo aparece en una de ellas no es un resultado."
      >
        <Tabla cabeceras={['Corrida', 'k*', 'Corr.', 'Gamma CAGR', 'Gamma IR', 'Theta CAGR', 'Theta IR']} min={620}>
          {resumen.variantes.map(x => {
            const g = x.agentes.find(a => a.id === 'gamma')
            const t = x.agentes.find(a => a.id === 'theta')
            return (
              <tr key={x.id} className={`border-b border-border-subtle last:border-0 ${x.id === v.id ? 'bg-surface-raised' : ''}`}>
                <td className="px-2 py-2">
                  <button onClick={() => setId(x.id)} className="text-left text-text-primary hover:underline">
                    {x.descripcionModo}
                  </button>
                </td>
                <td className="px-2 py-2 text-right font-mono text-text-primary">{num(x.calibracion.kOptimo)}</td>
                <td className="px-2 py-2 text-right font-mono text-text-secondary">{num(x.calibracion.correlacion)}</td>
                <td className="px-2 py-2 text-right font-mono text-text-primary">{pct(g?.metricas.cagr ?? 0)}</td>
                <td className="px-2 py-2 text-right font-mono" style={{ color: tono(g?.metricas.informationRatio ?? 0) }}>
                  {num(g?.metricas.informationRatio ?? 0)}
                </td>
                <td className="px-2 py-2 text-right font-mono" style={{ color: (t?.metricas.cagr ?? 0) <= -0.999 ? 'var(--color-negative)' : 'var(--color-text-primary)' }}>
                  {pct(t?.metricas.cagr ?? 0)}
                </td>
                <td className="px-2 py-2 text-right font-mono" style={{ color: tono(t?.metricas.informationRatio ?? 0) }}>
                  {num(t?.metricas.informationRatio ?? 0)}
                </td>
              </tr>
            )
          })}
        </Tabla>
      </Panel>

      {/* Descargas */}
      <Panel
        titulo="Descargar el dataset"
        descripcion={
          <>
            Las {totalOperaciones.toLocaleString('es-ES')} operaciones de las cuatro corridas, una a
            una, con strike, vencimiento, primas, delta y volatilidad implícita de entrada. Cada
            fila lleva su corrida y el supuesto calibrado, para poder agrupar sin cruzar ficheros.
          </>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {resumen.descargas.map(d => (
            <li key={d.fichero}>
              <a
                href={d.ruta}
                download
                className="flex h-full gap-2.5 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 transition-colors hover:border-accent hover:bg-surface"
              >
                {d.formato === 'xlsx'
                  ? <FileSpreadsheet size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--color-positive)' }} />
                  : <FileText size={15} className="mt-0.5 shrink-0 text-text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-semibold text-text-primary">{d.etiqueta}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wide text-text-muted">
                      {d.formato} · {tamano(d.bytes)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-text-secondary">
                    {d.descripcion}
                  </span>
                </span>
                <Download size={13} className="mt-0.5 shrink-0 text-text-muted" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
          Las primas de estos ficheros están <strong className="text-text-secondary">reconstruidas</strong>,
          no observadas: no existe histórico gratuito de cadenas de opciones. La columna{' '}
          <span className="font-mono">k_calibrado</span> dice con qué supuesto de volatilidad se
          valoró cada operación, y{' '}
          <span className="font-mono">opciones-barrido-supuesto.csv</span> enseña qué habría salido
          con otro. Las descargas exigen sesión iniciada, igual que esta pantalla.
        </p>
      </Panel>

      {/* Conclusiones */}
      <Panel titulo="Qué se concluye" descripcion="Y qué no.">
        <ul className="space-y-3">
          {[
            {
              titulo: 'Los niveles de salida son lo que evita la ruina de Theta',
              detalle: 'Sin ellos la cartera de puts vendidos llega a cero: pierde el 100 %. Con ellos sobrevive los 21 años con una caída máxima del 26 %. Es el argumento más fuerte del estudio y valida haber implementado la revisión de niveles, que hasta agosto de 2026 se guardaba sin que ningún proceso la leyera.',
              positivo: true,
            },
            {
              titulo: 'A Gamma los niveles de salida le restan',
              detalle: 'Quitarlos sube el CAGR del 17,15 % al 25,34 % y, contra la intuición, reduce la caída máxima del 46 % al 21 %. El stop al 0,5× de la prima corta posiciones que después se recuperan. Es un hallazgo accionable, no un ajuste de parámetros: son dos configuraciones, no veinte.',
              positivo: true,
            },
            {
              titulo: 'El resultado de Gamma depende del supuesto, y mucho',
              detalle: 'Con el multiplicador calibrado gana; una décima por encima y el CAGR se vuelve negativo. Gamma compra opciones, así que su resultado es una apuesta directa sobre si las primas estaban caras o baratas — justo lo que estos datos no pueden decidir.',
              positivo: false,
            },
            {
              titulo: 'Theta no bate a su propio índice',
              detalle: 'Con el supuesto calibrado rinde por debajo de ^PUT, que hace lo mismo de forma mecánica y sin selección. El information ratio es negativo en las tres corridas que no arruinan la cartera. Vender puts sobre 36 subyacentes elegidos no mejora a venderlos sobre el índice.',
              positivo: false,
            },
            {
              titulo: 'Nada de esto alcanza significación estadística',
              detalle: 'El mejor t-stat es 1,29, por debajo del umbral convencional de 2,0, pese a tener 254 vencimientos y 21 años. Y sobre todo: la capa que decide si estos agentes ganan —si la volatilidad implícita estaba cara— es precisamente la que el modelo supone en vez de medir.',
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
    </div>
  )
}
