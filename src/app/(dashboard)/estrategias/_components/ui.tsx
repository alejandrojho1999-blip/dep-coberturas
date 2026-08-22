import type { ReactNode } from 'react'
import type { FilaDato } from '@/lib/estrategias/types'

/**
 * Piezas de presentación compartidas por el índice, las fichas y la sección de
 * cartera. Se mantienen aquí para que las tres se lean como el mismo documento.
 */

export function Panel({
  titulo,
  descripcion,
  children,
  accion,
}: {
  titulo: string
  descripcion?: string
  children: ReactNode
  accion?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-brand text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-primary">
            {titulo}
          </h2>
          {descripcion && (
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-secondary">{descripcion}</p>
          )}
        </div>
        {accion}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Etiqueta corta de contexto: instrumento, sesión, estado… */
export function Chip({
  children,
  tono = 'neutro',
}: {
  children: ReactNode
  tono?: 'neutro' | 'acento' | 'aviso' | 'positivo'
}) {
  const tonos = {
    neutro: 'border-border bg-surface-raised text-text-secondary',
    acento: 'border-transparent bg-accent text-on-accent',
    aviso: 'border-warning/40 bg-warning/10 text-warning',
    positivo: 'border-positive/40 bg-positive/10 text-positive',
  } as const
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}

/** Tabla de dos columnas para las fichas de parámetros y mecánica. */
export function TablaDatos({ filas }: { filas: readonly FilaDato[] }) {
  return (
    <dl className="divide-y divide-border-subtle">
      {filas.map(f => (
        <div key={f.etiqueta} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-4">
          <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted sm:pt-0.5">
            {f.etiqueta}
          </dt>
          <dd className="min-w-0">
            <p className="text-xs text-text-primary">{f.valor}</p>
            {f.nota && <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{f.nota}</p>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Lista de afirmaciones con viñeta discreta. */
export function ListaPuntos({
  puntos,
  tono = 'neutro',
}: {
  puntos: readonly string[]
  tono?: 'neutro' | 'aviso'
}) {
  const color = tono === 'aviso' ? 'bg-warning' : 'bg-accent'
  return (
    <ul className="space-y-2.5">
      {puntos.map((p, i) => (
        <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-text-secondary">
          <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${color}`} />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  )
}

/** Contenedor con scroll propio: las tablas anchas no deben romper la página. */
export function TablaScroll({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4">{children}</div>
}

// Tailwind purga por coincidencia estática, así que las clases de alineación no
// pueden construirse por interpolación.
const ALINEACION = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

type Alineacion = keyof typeof ALINEACION

export function Th({
  children,
  alinear = 'left',
}: {
  children: ReactNode
  alinear?: Alineacion
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted ${ALINEACION[alinear]}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  alinear = 'left',
  mono = false,
  className = '',
}: {
  children: ReactNode
  alinear?: Alineacion
  mono?: boolean
  className?: string
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2 text-xs ${ALINEACION[alinear]} ${mono ? 'font-mono tabular-nums' : ''} ${className}`}
    >
      {children}
    </td>
  )
}

/** Nota al pie de un bloque: supuestos, trazabilidad, matices. */
export function NotaPie({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-text-muted">{children}</p>
}
