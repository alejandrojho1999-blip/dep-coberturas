'use client'

import { useState } from 'react'
import { ChevronDown, FileText, ShieldCheck, AlertTriangle, Filter, LogOut } from 'lucide-react'

/**
 * Ficha técnica del AGENTE PETER, pensada para explicar el sistema a alguien que
 * no ha visto el código y tiene que decidir si le asigna capital.
 *
 * Documenta el método y, con el mismo detalle, lo que todavía no está validado.
 * Un panel que solo enseñara el proceso invitaría a confundir "método ordenado"
 * con "método demostrado", y esa confusión aquí se paga en dinero real.
 *
 * Los umbrales están escritos a mano y deben seguir a su fuente si esta cambia:
 *   · pasos 1-3   → `lib/peter-lynch/screener.ts`, `api/agentes/forecast`, `…/momentum`
 *   · paso 4      → `api/agentes/analyze/route.ts` y el filtro de `AgentePeter.tsx`
 *   · salida      → bloque de re-evaluación de `AgentePeter.tsx`
 */

interface Paso {
  n: string
  titulo: string
  fuente: string
  criterio: string
  umbral: string
}

const PASOS: Paso[] = [
  {
    n: '01',
    titulo: 'Screener Lynch',
    fuente: 'Fundamentales · Yahoo Finance',
    criterio: 'Seis criterios de valoración, 1 punto cada uno: P/E histórico < 25, P/E proyectado < 15, deuda neta sobre capitalización < 0,35, crecimiento de beneficio > 15 %, PEG < 2 y capitalización > $5 B.',
    umbral: 'Exige 6/6',
  },
  {
    n: '02',
    titulo: 'Proyección a 30 días',
    fuente: 'Precios · 60 sesiones',
    criterio: 'Regresión lineal sobre los 60 últimos cierres proyectada 30 sesiones, promediada 60/40 con una media exponencial de los 30 últimos.',
    umbral: 'Exige ≥ +2 %',
  },
  {
    n: '03',
    titulo: 'Momentum',
    fuente: 'Precio y volumen',
    criterio: 'Tres señales independientes: RSI-14 entre 50 y 75, MACD por encima de su línea de señal, y volumen de 5 sesiones ≥ 1,1× el de 20.',
    umbral: 'Exige ≥ 2/3',
  },
  {
    n: '04',
    titulo: 'Revisión por IA',
    fuente: 'Modelo de lenguaje',
    criterio: 'Un modelo revisa el conjunto desde tres ángulos —técnico, fundamental y gestor de cartera— y emite una convicción de 1 a 10 junto con una dirección.',
    umbral: 'Exige ≥ 7/10 y COMPRA',
  },
]

interface Garantia {
  titulo: string
  detalle: string
}

const GARANTIAS: Garantia[] = [
  {
    titulo: 'El precio de entrada es siempre real',
    detalle: 'Se registra el precio de mercado del momento. Si no se puede obtener, la recomendación se descarta en lugar de completarse con una estimación: una entrada inventada falsearía el rendimiento durante toda la vida de la posición.',
  },
  {
    titulo: 'El precio objetivo prioriza el consenso',
    detalle: 'Se usa el objetivo medio de los analistas que cubren el valor. Solo si no existe se recurre a la cifra del modelo, y el origen queda registrado en cada recomendación para poder auditarlo.',
  },
  {
    titulo: 'Los umbrales están fijados en el código',
    detalle: 'Ninguno se ajusta sobre la marcha ni depende del criterio del operador. Cambiar uno exige modificar el código y queda en el historial de versiones.',
  },
  {
    titulo: 'Las recomendaciones no se sobrescriben',
    detalle: 'Una nueva ejecución no reescribe el precio de entrada de una posición ya abierta. Sin esa regla, cada corrida reiniciaría el rendimiento a cero y se perdería el seguimiento desde la fecha real de la recomendación.',
  },
]

function Seccion({ icon: Icon, titulo, children }: {
  icon: typeof Filter
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-text-muted shrink-0" />
        <h4 className="text-[10px] font-mono font-bold tracking-wide text-text-muted">{titulo}</h4>
      </div>
      {children}
    </section>
  )
}

export default function FichaTecnicaPeter() {
  const [abierta, setAbierta] = useState(false)

  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
      <button
        onClick={() => setAbierta(v => !v)}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-text-primary">Ficha técnica del agente</span>
            <span className="block text-[10px] text-text-muted leading-tight">
              Cómo selecciona, cuándo vende y qué respaldo tiene
            </span>
          </span>
        </span>
        <ChevronDown
          size={14}
          className="shrink-0 text-text-muted transition-transform duration-200"
          style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {abierta && (
        <div className="space-y-5 border-t border-border-subtle px-4 py-4">

          <p className="text-xs leading-relaxed text-text-secondary">
            El <strong className="text-text-primary">Agente Peter</strong>{' '}aplica la metodología de
            Peter Lynch a un universo de unas 560 empresas del S&amp;P&nbsp;500 y el NASDAQ&nbsp;100.
            Es un <strong className="text-text-primary">embudo de cuatro filtros en cascada</strong>:
            una empresa solo llega a ser recomendación si supera los cuatro. Los tres primeros son
            deterministas —mismos datos, mismo resultado— y el cuarto es una revisión por IA.
          </p>

          <Seccion icon={Filter} titulo="EL EMBUDO">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-2 py-2 text-left font-medium text-text-secondary w-8">#</th>
                    <th className="px-2 py-2 text-left font-medium text-text-secondary">Filtro</th>
                    <th className="px-2 py-2 text-left font-medium text-text-secondary">Qué mide</th>
                    <th className="px-2 py-2 text-right font-medium text-text-secondary whitespace-nowrap">Corte</th>
                  </tr>
                </thead>
                <tbody>
                  {PASOS.map(p => (
                    <tr key={p.n} className="border-b border-border-subtle align-top last:border-0">
                      <td className="px-2 py-2.5 font-mono text-[10px] text-text-muted">{p.n}</td>
                      <td className="px-2 py-2.5">
                        <span className="block font-semibold text-text-primary whitespace-nowrap">{p.titulo}</span>
                        <span className="block text-[10px] text-text-muted leading-tight">{p.fuente}</span>
                      </td>
                      <td className="px-2 py-2.5 text-text-secondary leading-relaxed">{p.criterio}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span
                          className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px]"
                          style={{
                            color: 'var(--color-warning)',
                            border: '1px solid rgba(245, 165, 36, 0.3)',
                            background: 'rgba(245, 165, 36, 0.08)',
                          }}
                        >
                          {p.umbral}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] leading-relaxed text-text-muted">
              El primer filtro es el más restrictivo: exigir los seis criterios a la vez descarta la
              práctica totalidad del universo. El agente está diseñado para producir
              <strong className="text-text-secondary"> pocas señales</strong>, no muchas.
            </p>
          </Seccion>

          <Seccion icon={LogOut} titulo="CUÁNDO VENDE">
            <p className="text-xs leading-relaxed text-text-secondary">
              En cada ejecución, el agente vuelve a evaluar las posiciones abiertas contra los tres
              filtros objetivos y <strong className="text-text-primary">vende si fallan dos de los
              tres</strong>. La salida responde al deterioro de las condiciones que justificaron la
              entrada, no a un objetivo de precio: una sola señal debilitándose no basta, pero dos
              simultáneas invalidan la tesis. No hay toma de beneficios automática.
            </p>
          </Seccion>

          <Seccion icon={ShieldCheck} titulo="GARANTÍAS SOBRE LOS DATOS">
            <ul className="space-y-2">
              {GARANTIAS.map(g => (
                <li key={g.titulo} className="flex gap-2">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                    style={{ background: 'var(--color-positive)' }}
                  />
                  <span className="text-xs leading-relaxed text-text-secondary">
                    <strong className="text-text-primary">{g.titulo}.</strong> {g.detalle}
                  </span>
                </li>
              ))}
            </ul>
          </Seccion>

          <Seccion icon={AlertTriangle} titulo="ESTADO DE VALIDACIÓN">
            <div
              className="rounded-lg p-3 space-y-2.5"
              style={{
                border: '1px solid rgba(245, 165, 36, 0.25)',
                background: 'rgba(245, 165, 36, 0.06)',
              }}
            >
              <p className="text-xs leading-relaxed text-text-secondary">
                <strong style={{ color: 'var(--color-warning)' }}>Este agente no tiene backtest.</strong>{' '}
                Su respaldo hoy es el historial en vivo que se acumula desde la primera recomendación
                guardada, visible en la sección Portafolios y comparado contra el S&amp;P&nbsp;500. Es
                un registro real y sin retoques, pero todavía corto.
              </p>
              <p className="text-xs leading-relaxed text-text-secondary">
                No es una omisión: <strong className="text-text-primary">el primer filtro no se puede
                backtestear de forma honesta</strong> con los datos disponibles. Harían falta
                fundamentales <em>tal y como se conocían en cada fecha</em> —los proveedores gratuitos
                solo dan los actuales, ya revisados— y la lista histórica de miembros del índice: medir
                sobre las empresas que siguen en él hoy excluye a las que quebraron o salieron, y ese
                sesgo siempre favorece al resultado.
              </p>
              <p className="text-xs leading-relaxed text-text-secondary">
                Los filtros 2 y 3 sí son validables, porque solo usan precio y volumen. Es la vía
                abierta para medir el sistema sin gastar en datos.
              </p>
            </div>
            <p className="text-[10px] leading-relaxed text-text-muted">
              Lectura recomendada para una decisión de capital: el proceso es
              <strong className="text-text-secondary"> auditable, reproducible y conservador en el
              tratamiento de los datos</strong>, y por eso el historial que produce es fiable como
              medida. Lo que aún no existe es la evidencia estadística de que el conjunto bata al
              índice. Dimensionar en consecuencia.
            </p>
          </Seccion>

        </div>
      )}
    </div>
  )
}
