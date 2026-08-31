/**
 * Registro de lo que el sistema observa y envía.
 *
 * Todo mensaje queda guardado con su motivo, su nivel y el resultado del envío,
 * porque una alerta que nadie puede auditar después no vale nada: cuando el oro
 * se mueve un 2% hay que poder responder qué se avisó, a qué hora y con qué
 * precio de referencia.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EstadoEvento } from '@/lib/alertas/dedupe'
import type { ProbabilidadTasas } from '@/lib/alertas/fedwatch'
import type { MetricaDebasement } from '@/lib/alertas/debasement'

export interface SenalAGuardar {
  tipo: 'guerra' | 'fed_tesoro' | 'tasas' | 'debasement'
  severidad: number
  eventoKey: string
  titular: string
  url?: string | null
  fuente?: string | null
  resumen?: string | null
  publishedAt?: string | null
  simbolo?: string | null
  precioRef?: number | null
  direccion?: 'buy' | 'sell' | null
  nivelStop?: number | null
  atr?: number | null
  mercadoAbierto?: boolean | null
  mensaje: string
  payload?: Record<string, unknown>
  enviadoAt?: string | null
  errorEnvio?: string | null
}

export async function estadoDeEvento(
  admin: SupabaseClient,
  eventoKey: string,
): Promise<EstadoEvento | null> {
  const { data, error } = await admin
    .from('alert_dedupe')
    .select('evento_key, ultima_vez, max_severidad')
    .eq('evento_key', eventoKey)
    .maybeSingle()

  if (error) throw new Error(`alert_dedupe: ${error.message}`)
  if (!data) return null

  return {
    eventoKey: data.evento_key as string,
    ultimaVez: data.ultima_vez as string,
    maxSeveridad: Number(data.max_severidad),
  }
}

/** Cuántos mensajes se enviaron de verdad en la última hora. */
export async function enviadosUltimaHora(
  admin: SupabaseClient,
  ahora = new Date(),
): Promise<number> {
  const desde = new Date(ahora.getTime() - 3_600_000).toISOString()
  const { count, error } = await admin
    .from('alert_signals')
    .select('id', { count: 'exact', head: true })
    .not('enviado_at', 'is', null)
    .gte('enviado_at', desde)

  if (error) throw new Error(`alert_signals (conteo): ${error.message}`)
  return count ?? 0
}

export async function registrarSenal(admin: SupabaseClient, senal: SenalAGuardar): Promise<void> {
  const { error } = await admin.from('alert_signals').insert({
    tipo: senal.tipo,
    severidad: senal.severidad,
    evento_key: senal.eventoKey,
    titular: senal.titular,
    url: senal.url ?? null,
    fuente: senal.fuente ?? null,
    resumen: senal.resumen ?? null,
    published_at: senal.publishedAt ?? null,
    simbolo: senal.simbolo ?? null,
    precio_ref: senal.precioRef ?? null,
    direccion: senal.direccion ?? null,
    nivel_stop: senal.nivelStop ?? null,
    atr: senal.atr ?? null,
    mercado_abierto: senal.mercadoAbierto ?? null,
    mensaje: senal.mensaje,
    payload: senal.payload ?? {},
    enviado_at: senal.enviadoAt ?? null,
    error_envio: senal.errorEnvio ?? null,
  })

  if (error) throw new Error(`alert_signals (insert): ${error.message}`)
}

/**
 * Marca el suceso como visto.
 *
 * `max_severidad` solo sube: si el incidente escaló a 5 y luego llega otro
 * titular tibio de 2, el enfriamiento no debe reabrirse por eso.
 */
export async function tocarEvento(
  admin: SupabaseClient,
  eventoKey: string,
  severidad: number,
  estadoPrevio: EstadoEvento | null,
): Promise<void> {
  const ahora = new Date().toISOString()

  if (!estadoPrevio) {
    const { error } = await admin.from('alert_dedupe').insert({
      evento_key: eventoKey,
      primera_vez: ahora,
      ultima_vez: ahora,
      max_severidad: severidad,
      veces: 1,
    })
    if (error) throw new Error(`alert_dedupe (insert): ${error.message}`)
    return
  }

  const { data, error: errLectura } = await admin
    .from('alert_dedupe')
    .select('veces')
    .eq('evento_key', eventoKey)
    .maybeSingle()
  if (errLectura) throw new Error(`alert_dedupe (lectura): ${errLectura.message}`)

  const { error } = await admin
    .from('alert_dedupe')
    .update({
      ultima_vez: ahora,
      max_severidad: Math.max(estadoPrevio.maxSeveridad, severidad),
      veces: Number(data?.veces ?? 1) + 1,
    })
    .eq('evento_key', eventoKey)

  if (error) throw new Error(`alert_dedupe (update): ${error.message}`)
}

/** URLs ya procesadas, para no volver a pagar la clasificación del mismo enlace. */
export async function urlsRecientes(
  admin: SupabaseClient,
  horas = 24,
): Promise<Set<string>> {
  const desde = new Date(Date.now() - horas * 3_600_000).toISOString()
  const { data, error } = await admin
    .from('alert_signals')
    .select('url')
    .gte('created_at', desde)
    .not('url', 'is', null)

  if (error) throw new Error(`alert_signals (urls): ${error.message}`)
  return new Set((data ?? []).map((r) => String(r.url)))
}

export async function guardarSnapshot(
  admin: SupabaseClient,
  probabilidad: ProbabilidadTasas,
  metricas: MetricaDebasement[],
): Promise<void> {
  const { error } = await admin.from('macro_snapshots').insert({
    reunion_ref: probabilidad.reunion,
    contrato: probabilidad.contrato,
    precio_contrato: probabilidad.precioContrato,
    tasa_actual: probabilidad.tasaActual,
    tasa_implicita: probabilidad.tasaImplicitaPost,
    prob_subida: probabilidad.probSubida,
    prob_mantener: probabilidad.probMantener,
    prob_bajada: probabilidad.probBajada,
    aproximado: probabilidad.aproximado,
    debasement: { metricas },
    nota: probabilidad.nota,
  })

  if (error) throw new Error(`macro_snapshots (insert): ${error.message}`)
}

/** Última foto macro guardada, para comparar contra la actual. */
export async function ultimoSnapshot(admin: SupabaseClient): Promise<{
  tomadoAt: string
  probSubida: number
} | null> {
  const { data, error } = await admin
    .from('macro_snapshots')
    .select('tomado_at, prob_subida')
    .order('tomado_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`macro_snapshots (lectura): ${error.message}`)
  if (!data) return null
  return { tomadoAt: data.tomado_at as string, probSubida: Number(data.prob_subida) }
}
