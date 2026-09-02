import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/auth/admin'
import type { EventoMedido } from '@/lib/alertas/backtesting'
import { FichaBacktesting } from './_components/FichaBacktesting'

export const metadata = {
  title: 'Backtesting de eventos · Alerta temprana',
}

// El corpus solo cambia cuando alguien ejecuta los scripts de calibración a
// mano, pero cuando cambia hay que verlo: sin esto, corregir una severidad y
// recargar seguiría enseñando la vieja.
export const dynamic = 'force-dynamic'

interface FilaEvento {
  fecha: string
  titulo: string
  tramo: string
  tema: string
  clase: string
  severidad: number
  nota: string | null
  severity_event_moves: Array<{
    ticker: string
    ventana: number
    retorno: number | null
    extremo: number | null
  }>
}

/**
 * Qué hizo el precio tras cada hecho del corpus de calibración.
 *
 * Se lee con la clave de servicio a propósito: las tablas `severity_*` llevan
 * RLS activada **sin ninguna política**, porque son tablas de trabajo interno
 * que no pertenecen a ningún usuario. Sin service key no devuelven ni una fila,
 * y el guard de admin de arriba es lo que sostiene esa decisión.
 */
export default async function BacktestingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdminEmail(user.email)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('severity_events')
    .select('fecha, titulo, tramo, tema, clase, severidad, nota, severity_event_moves(ticker, ventana, retorno, extremo)')
    .order('fecha', { ascending: true })

  // Un fallo de lectura no puede pasar por «no hay eventos»: son estados
  // distintos y el segundo se arregla cargando el corpus, no mirando el log.
  if (error) {
    return (
      <p className="rounded-lg border border-border-subtle bg-surface p-4 text-xs text-text-secondary">
        No se pudo leer el corpus de eventos: {error.message}
      </p>
    )
  }

  const eventos: EventoMedido[] = ((data ?? []) as unknown as FilaEvento[]).map((f) => ({
    fecha: f.fecha,
    titulo: f.titulo,
    tramo: f.tramo,
    tema: f.tema,
    clase: f.clase,
    severidad: f.severidad,
    nota: f.nota,
    movimientos: (f.severity_event_moves ?? []).map((m) => ({
      ticker: m.ticker,
      ventana: m.ventana,
      retorno: m.retorno,
      extremo: m.extremo,
    })),
  }))

  return <FichaBacktesting eventos={eventos} />
}
