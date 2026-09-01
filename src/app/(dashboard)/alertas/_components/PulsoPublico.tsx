'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Panel, Chip } from '@/app/(dashboard)/estrategias/_components/ui'
import { RiesgoChart, type PuntoRiesgo } from '@/components/charts/RiesgoChart'
import {
  ETIQUETA_FEATURE,
  ETIQUETA_FUENTE,
  ETIQUETA_MODELO,
  type EstadoModelo,
  type KeywordUi,
  type RespuestaPulso,
} from '@/lib/pulso/tipos-ui'

/**
 * El pulso público: qué se está mirando ahí fuera y qué probabilidad le pone el
 * modelo.
 *
 * Va en un componente aparte del registro de señales porque son dos cosas
 * distintas: aquel cuenta lo que ya se envió al teléfono, y este mide la
 * atención que todavía no es noticia. Comparten pantalla, no estado.
 */

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Guayaquil',
  })
}

/** Cuánto hace de la última captura, que es lo que dice si la fuente respira. */
function hace(iso: string): { texto: string; fresca: boolean } {
  const minutos = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
  if (!Number.isFinite(minutos)) return { texto: '—', fresca: false }
  // El pulso corre cada media hora; con más de dos horas de retraso algo pasa.
  const fresca = minutos < 120
  if (minutos < 60) return { texto: `hace ${Math.max(0, minutos)} min`, fresca }
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return { texto: `hace ${horas} h`, fresca }
  return { texto: `hace ${Math.floor(horas / 24)} d`, fresca }
}

const TONO_RELEVANCIA: Record<number, 'neutro' | 'aviso' | 'acento'> = {
  3: 'neutro', 4: 'aviso', 5: 'aviso',
}

function EstadoCurva({ estado }: { estado: EstadoModelo }) {
  if (!estado.activo) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
          {ETIQUETA_MODELO[estado.tipo]}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Calibrando. Llevamos {estado.diasConVector} día{estado.diasConVector === 1 ? '' : 's'} de
          medición y faltan {estado.faltanDias} para poder entrenar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
        {ETIQUETA_MODELO[estado.tipo]}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        AUC {estado.auc?.toFixed(3)} fuera de muestra · Brier {estado.brier?.toFixed(3)} ·
        el suceso ocurre el {((estado.tasaBase ?? 0) * 100).toFixed(0)}% de los días.
        Entrenado el {fechaCorta(estado.entrenadoAt)}.
      </p>
    </div>
  )
}

function FilaClave({ clave }: { clave: KeywordUi }) {
  const tono = TONO_RELEVANCIA[clave.relevancia ?? 3] ?? 'neutro'
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
      <Chip tono={tono}>{clave.relevancia ?? '—'}/5</Chip>
      <span className="font-mono text-xs text-text-primary">{clave.termino}</span>
      {clave.tema && <Chip>{clave.tema}</Chip>}
      <span className="font-mono text-[10px] text-text-muted">
        {clave.zScore.toFixed(1)}σ · {clave.menciones} menciones · {clave.fuentes.join(', ')}
      </span>
      {clave.resumen && (
        <p className="w-full text-xs leading-relaxed text-text-secondary">{clave.resumen}</p>
      )}
      {clave.ejemploUrl && (
        <a
          href={clave.ejemploUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted underline decoration-dotted hover:text-text-primary"
        >
          ver fuente <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </li>
  )
}

export function PulsoPublico() {
  const [datos, setDatos] = useState<RespuestaPulso | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const res = await fetch('/api/alertas/pulso', { cache: 'no-store' })
        const json = await res.json()
        if (!vivo) return
        if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`)
        setDatos(json as RespuestaPulso)
      } catch (e) {
        if (vivo) setError((e as Error).message)
      }
    })()
    return () => { vivo = false }
  }, [])

  /** Las dos series comparten eje temporal, así que se cruzan por día. */
  const serie = useMemo<PuntoRiesgo[]>(() => {
    const porDia = new Map<string, PuntoRiesgo>()
    for (const p of datos?.predicciones ?? []) {
      const punto = porDia.get(p.dia) ?? { dia: p.dia, mercado: null, geopolitico: null }
      punto[p.modelo] = p.probabilidad
      porDia.set(p.dia, punto)
    }
    return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia))
  }, [datos])

  const ultima = serie.at(-1)
  const modeloMercado = datos?.modelos.find((m) => m.tipo === 'mercado')

  /**
   * Lo que más empuja la probabilidad de hoy, para que el número tenga origen
   * visible en vez de salir de una caja negra.
   */
  const empuje = useMemo(() => {
    const hoy = (datos?.predicciones ?? []).filter((p) => p.dia === ultima?.dia)
    return hoy.flatMap((p) =>
      Object.entries(p.contribuciones)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3)
        .map(([f, v]) => ({ modelo: p.modelo, feature: f, valor: v })),
    )
  }, [datos, ultima])

  if (error) {
    return (
      <Panel titulo="Pulso público" descripcion="No se pudo leer el pulso.">
        <p className="text-xs text-negative">{error}</p>
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <Panel
        titulo="Probabilidad de riesgo"
        descripcion="Dos modelos entrenados con la atención pública medida cada media hora en búsquedas, Wikipedia, foros, redes, cadenas de noticias y prensa. Se reentrenan cada noche y solo se ponen en pie si mejoran al vigente fuera de muestra."
      >
        <div className="space-y-3">
          <RiesgoChart
            serie={serie}
            tasaBase={modeloMercado?.tasaBase ?? null}
            nota="La probabilidad solo se dibuja cuando hay un modelo activo. Sin él, la pantalla se queda vacía en vez de enseñar una cifra que nadie debería usar. La curva geopolítica se aprende del juicio de un modelo de lenguaje sobre términos emergentes, no de un hecho medido: sirve para ordenar días, no como pronóstico verificado."
          />

          <div className="grid gap-2 sm:grid-cols-2">
            {(datos?.modelos ?? []).map((m) => <EstadoCurva key={m.tipo} estado={m} />)}
          </div>

          {empuje.length > 0 && (
            <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                Qué empuja la probabilidad de hoy
              </p>
              <ul className="mt-1 space-y-0.5">
                {empuje.map((e, i) => (
                  <li key={`${e.modelo}-${e.feature}-${i}`} className="text-xs text-text-secondary">
                    <span className="font-mono text-[10px] text-text-muted">
                      {ETIQUETA_MODELO[e.modelo]}
                    </span>{' '}
                    {ETIQUETA_FEATURE[e.feature] ?? e.feature}{' '}
                    <span className={e.valor >= 0 ? 'text-warning' : 'text-text-muted'}>
                      {e.valor >= 0 ? '↑' : '↓'} {Math.abs(e.valor).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        titulo="Palabras clave emergentes"
        descripcion="Términos que hoy se salen de su costumbre de las últimas cuatro semanas, puntuados de 1 a 5 por relevancia para una cartera expuesta a oro, defensa, energía y tipos. Solo se muestran los de 3 en adelante."
      >
        {datos === null ? (
          <p className="text-xs text-text-muted">Cargando…</p>
        ) : datos.keywords.length === 0 ? (
          <p className="text-xs text-text-muted">
            Todavía no hay términos emergentes. Hacen falta varios días de medición para tener una
            línea base con la que comparar: sin ella, todo parece nuevo y nada lo es.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {datos.keywords.map((k) => <FilaClave key={`${k.dia}-${k.termino}`} clave={k} />)}
          </ul>
        )}
      </Panel>

      <Panel
        titulo="Fuentes vivas"
        descripcion="Última vez que cada fuente aportó una medición. Ninguna tiene acuerdo de servicio: que una caiga es normal, y por eso el vector de cada día registra cuántas contribuyeron."
      >
        {datos === null ? (
          <p className="text-xs text-text-muted">Cargando…</p>
        ) : datos.fuentes.length === 0 ? (
          <p className="text-xs text-text-muted">Todavía no se ha guardado ninguna medición.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {datos.fuentes.map((f) => {
              const { texto, fresca } = hace(f.ultimaAt)
              return (
                <li
                  key={f.fuente}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2"
                >
                  <span className="min-w-0 truncate text-xs text-text-secondary">
                    {ETIQUETA_FUENTE[f.fuente] ?? f.fuente}
                  </span>
                  <Chip tono={fresca ? 'positivo' : 'aviso'}>{texto}</Chip>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
