'use client'

import { useState } from 'react'
import { ChevronDown, FileText, ShieldCheck, AlertTriangle, Filter, LogOut, TrendingDown } from 'lucide-react'
import type { Ficha } from './fichas/tipos'

/**
 * Marco de la ficha técnica. El contenido vive en `fichas/<agente>.tsx`; aquí
 * solo está la presentación, para que las cuatro fichas sean idénticas y un
 * cambio de diseño se haga en un único sitio.
 */

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

export default function FichaTecnicaAgente({ ficha }: { ficha: Ficha }) {
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
            <span className="block text-[10px] text-text-muted leading-tight">{ficha.subtitulo}</span>
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

          <p className="text-xs leading-relaxed text-text-secondary">{ficha.intro}</p>

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
                  {ficha.pasos.map(p => (
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
            {ficha.notaEmbudo && (
              <p className="text-[10px] leading-relaxed text-text-muted">{ficha.notaEmbudo}</p>
            )}
          </Seccion>

          <Seccion icon={LogOut} titulo="CUÁNDO VENDE">
            <p className="text-xs leading-relaxed text-text-secondary">{ficha.cuandoVende}</p>
          </Seccion>

          <Seccion icon={ShieldCheck} titulo="GARANTÍAS SOBRE LOS DATOS">
            <ul className="space-y-2">
              {ficha.garantias.map(g => (
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

          {ficha.riesgos && (
            <Seccion icon={TrendingDown} titulo="CÓMO SE PIERDE DINERO AQUÍ">
              <ul className="space-y-2">
                {ficha.riesgos.map(r => (
                  <li key={r.titulo} className="flex gap-2">
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                      style={{ background: 'var(--color-negative)' }}
                    />
                    <span className="text-xs leading-relaxed text-text-secondary">
                      <strong className="text-text-primary">{r.titulo}.</strong> {r.detalle}
                    </span>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          <Seccion icon={AlertTriangle} titulo="ESTADO DE VALIDACIÓN">
            <div
              className="rounded-lg p-3 space-y-2.5"
              style={{
                border: '1px solid rgba(245, 165, 36, 0.25)',
                background: 'rgba(245, 165, 36, 0.06)',
              }}
            >
              {ficha.validacion.map(v => (
                <p key={v.id} className="text-xs leading-relaxed text-text-secondary">{v.texto}</p>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-text-muted">{ficha.lectura}</p>
          </Seccion>

        </div>
      )}
    </div>
  )
}
