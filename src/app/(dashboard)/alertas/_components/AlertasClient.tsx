'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, FileText, History, RefreshCw } from 'lucide-react'
import { Panel, Chip } from '@/app/(dashboard)/estrategias/_components/ui'
import { KpiCard, KpiRow } from '@/app/(dashboard)/portafolios/_components/KpiCard'
import { PulsoPublico } from '@/app/(dashboard)/alertas/_components/PulsoPublico'
import {
  ETIQUETA_TIPO,
  type MacroFila,
  type RespuestaAlertas,
  type SenalFila,
} from '@/lib/alertas/tipos'

/**
 * Panel de auditoría del sistema de alerta temprana.
 *
 * No dispara nada: el motor corre como tarea del servidor, porque el puente de
 * WhatsApp solo escucha en local. Aquí se ve qué se envió, con qué precio de
 * referencia y por qué, que es lo que permite juzgar después si la señal fue
 * buena.
 */

const SEMAFORO: Record<number, string> = { 1: '⚪', 2: '🟡', 3: '🟠', 4: '🔴', 5: '🚨' }

function num(valor: number | null | undefined, decimales = 2): string {
  if (valor == null || !Number.isFinite(valor)) return '—'
  return valor.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(t))
}

function cuentaAtras(iso: string | null): string {
  if (!iso) return '—'
  const min = (Date.parse(iso) - Date.now()) / 60_000
  if (Number.isNaN(min) || min <= 0) return 'ya publicado'
  const dias = Math.floor(min / 1440)
  const horas = Math.floor((min % 1440) / 60)
  if (dias > 0) return `${dias} d ${horas} h`
  return `${horas} h ${Math.floor(min % 60)} min`
}

const TIPOS: Array<SenalFila['tipo'] | 'todos'> = ['todos', 'guerra', 'fed_tesoro', 'tasas', 'debasement']

export function AlertasClient({ proximoEventoIso, proximoEventoEtiqueta }: {
  proximoEventoIso: string | null
  proximoEventoEtiqueta: string | null
}) {
  const [datos, setDatos] = useState<RespuestaAlertas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<SenalFila['tipo'] | 'todos'>('todos')

  async function cargar() {
    setCargando(true)
    try {
      const res = await fetch('/api/alertas?limite=120', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`)
      setDatos(json as RespuestaAlertas)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  const ultimoMacro: MacroFila | null = datos?.macro[0] ?? null
  const senales = useMemo(
    () => (datos?.senales ?? []).filter((s) => filtro === 'todos' || s.tipo === filtro),
    [datos, filtro],
  )

  // Una señal encolada con la sesión de WhatsApp caída no llegó a ningún sitio,
  // así que cuenta como fallida igual que una que el puente rechazó.
  const fallidas = (datos?.senales ?? [])
    .filter((s) => !s.aceptado_at || s.canal_estado === 'caido').length
  const ultimas24h = (datos?.senales ?? []).filter(
    (s) => Date.now() - Date.parse(s.created_at) < 86_400_000,
  ).length

  const metricas = ultimoMacro?.debasement?.metricas ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-brand text-lg font-extrabold uppercase tracking-[0.14em] text-text-primary">
            Alerta temprana
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            Escalada Rusia–OTAN, pulso Fed vs Tesoro y publicación de tasas, más la atención
            pública medida cada media hora en búsquedas, Wikipedia, foros, redes y prensa. Los
            avisos salen por WhatsApp desde la tarea del servidor; esta pantalla es el registro.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/alertas/ficha"
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary hover:text-text-primary"
          >
            <FileText className="h-3 w-3" />
            Ficha técnica
          </Link>
          <Link
            href="/alertas/backtesting"
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary hover:text-text-primary"
          >
            <History className="h-3 w-3" />
            Backtesting
          </Link>
          <button
            type="button"
            onClick={() => void cargar()}
            className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary hover:text-text-primary"
          >
            <RefreshCw className={`h-3 w-3 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-negative/40 bg-negative/10 px-3 py-2 text-xs text-negative">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <KpiRow>
        <KpiCard
          label="Prob. subida"
          value={ultimoMacro ? `${num(ultimoMacro.prob_subida, 1)}%` : '—'}
          sub={ultimoMacro?.contrato ? `contrato ${ultimoMacro.contrato}` : 'sin foto macro'}
          ayuda="Probabilidad implícita en los futuros de fondos federales para la próxima reunión, metodología CME FedWatch."
        />
        <KpiCard
          label="Prob. mantener"
          value={ultimoMacro ? `${num(ultimoMacro.prob_mantener, 1)}%` : '—'}
          sub={ultimoMacro ? `tasa actual ${num(ultimoMacro.tasa_actual, 2)}%` : ''}
        />
        <KpiCard
          label="Próxima decisión"
          value={cuentaAtras(proximoEventoIso)}
          sub={proximoEventoEtiqueta ?? 'calendario agotado'}
          ayuda="Cuenta atrás hasta la próxima publicación del calendario (FOMC o IPC)."
        />
        <KpiCard label="Señales 24 h" value={ultimas24h} sub={`${datos?.senales.length ?? 0} en el registro`} />
        <KpiCard
          label="No entregados"
          ayuda="Señales que el puente rechazó, o que quedaron encoladas con la sesión de WhatsApp caída."
          value={fallidas}
          signo={fallidas > 0 ? -1 : 0}
          sub={fallidas > 0 ? 'revisar la sesión de WhatsApp de Nexus' : 'todo entregado'}
        />
      </KpiRow>

      <PulsoPublico />

      {metricas.length > 0 && (
        <Panel
          titulo="Envilecimiento"
          descripcion={`Foto del ${fechaCorta(ultimoMacro?.tomado_at ?? null)}. El refugio se mide contra la masa monetaria, no contra su propio precio nominal.`}
        >
          <div className="grid gap-px bg-surface-raised p-px sm:grid-cols-2 lg:grid-cols-3">
            {metricas.map((m) => (
              <div key={m.clave} className="bg-surface px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-text-muted">{m.etiqueta}</p>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-text-primary">
                  {num(m.valor, 2)} <span className="text-[10px] font-normal text-text-muted">{m.unidad}</span>
                </p>
                {m.var12mPct != null && (
                  <p
                    className="mt-0.5 font-mono text-[10px] tabular-nums"
                    style={{ color: m.var12mPct >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}
                  >
                    12 m {m.var12mPct >= 0 ? '+' : ''}{num(m.var12mPct, 1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        titulo="Señales enviadas"
        descripcion="Cada fila es un mensaje que salió (o intentó salir) al WhatsApp del administrador."
        accion={
          <div className="flex flex-wrap gap-1">
            {TIPOS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFiltro(t)}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                  filtro === t
                    ? 'border-transparent bg-accent text-on-accent'
                    : 'border-border bg-surface-raised text-text-secondary hover:text-text-primary'
                }`}
              >
                {t === 'todos' ? 'Todos' : ETIQUETA_TIPO[t]}
              </button>
            ))}
          </div>
        }
      >
        {cargando && !datos ? (
          <p className="text-xs text-text-muted">Cargando el registro…</p>
        ) : senales.length === 0 ? (
          <p className="text-xs text-text-muted">
            Todavía no hay señales de este tipo. El motor las escribe desde la tarea del servidor.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {senales.map((s) => (
              <FilaSenal key={s.id} senal={s} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

/**
 * Estado de entrega de una señal.
 *
 * Tres desenlaces distintos, y hace falta distinguirlos: el puente acepta el
 * mensaje (202) antes de intentar enviarlo, así que «aceptado» con la sesión de
 * WhatsApp caída significa que no llegó a ningún teléfono.
 */
function ChipEntrega({ senal }: { senal: SenalFila }) {
  if (!senal.aceptado_at) return <Chip tono="aviso">no enviado</Chip>

  if (senal.canal_estado === 'caido') {
    return <Chip tono="aviso">encolado · WhatsApp caído</Chip>
  }

  if (senal.canal_estado === 'desconocido' || senal.canal_estado == null) {
    return <Chip tono="neutro">aceptado {fechaCorta(senal.aceptado_at)}</Chip>
  }

  return <Chip tono="positivo">entregado {fechaCorta(senal.aceptado_at)}</Chip>
}

function FilaSenal({ senal }: { senal: SenalFila }) {
  const niveles = senal.payload?.niveles
    ?? [...(senal.payload?.nivelesVenta ?? []), ...(senal.payload?.nivelesCompra ?? [])]

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs">{SEMAFORO[senal.severidad] ?? '⚪'}</span>
        <Chip tono="neutro">{ETIQUETA_TIPO[senal.tipo]}</Chip>
        <Chip tono={senal.severidad >= 4 ? 'aviso' : 'neutro'}>sev {senal.severidad}/5</Chip>
        <ChipEntrega senal={senal} />
        <span className="ml-auto font-mono text-[10px] text-text-muted">{fechaCorta(senal.created_at)}</span>
      </div>

      <p className="mt-1.5 text-xs font-medium text-text-primary">{senal.titular}</p>
      {senal.resumen && <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">{senal.resumen}</p>}

      {niveles.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-[11px]">
            <thead>
              <tr className="text-left font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted">
                <th className="py-1 pr-3">Activo</th>
                <th className="py-1 pr-3">Precio</th>
                <th className="py-1 pr-3">Orden</th>
                <th className="py-1 pr-3">Nivel</th>
                <th className="py-1">ATR14</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-text-secondary">
              {niveles.map((n, i) => (
                <tr key={`${n.ticker}-${n.direccion}-${i}`} className="border-t border-border-subtle">
                  <td className="py-1 pr-3 text-text-primary">{n.ticker}</td>
                  <td className="py-1 pr-3">{num(n.precio)}</td>
                  <td className="py-1 pr-3">{n.direccion === 'buy' ? 'buy stop' : 'sell stop'}</td>
                  <td className="py-1 pr-3 text-text-primary">{num(n.nivel)}</td>
                  <td className="py-1">{num(n.atr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
        {/* La fuente es el enlace cuando la hay: un rótulo suelto al lado de un
            «ver noticia» genérico obligaba a leer dos cosas para saber adónde
            lleva. Las señales calculadas —el pulso macro, los avisos previos—
            apuntan al organismo que publica el dato, no a un titular. */}
        {senal.url ? (
          <a
            href={senal.url}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-text-primary"
          >
            {senal.fuente ?? 'ver fuente'}
          </a>
        ) : (
          senal.fuente && <span>{senal.fuente}</span>
        )}
        {senal.payload?.motivoEnvio && <span>motivo: {senal.payload.motivoEnvio}</span>}
        {senal.error_envio && <span className="text-negative">error: {senal.error_envio}</span>}
      </div>
    </li>
  )
}
