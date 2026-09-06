/**
 * Registro de lo que el sistema observa y envía.
 *
 * Todo mensaje queda guardado con su motivo, su nivel y el resultado del envío,
 * porque una alerta que nadie puede auditar después no vale nada: cuando el oro
 * se mueve un 2% hay que poder responder qué se avisó, a qué hora y con qué
 * precio de referencia.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { N_MINIMO_PARA_CORREGIR, type PuntoCurva } from '@/lib/alertas/calibracion'
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
  aceptadoAt?: string | null
  errorEnvio?: string | null
  canalEstado?: 'vivo' | 'caido' | 'desconocido' | null
  canalDetalle?: string | null
}

/**
 * La curva de corrección de severidad, lista para `aplicarCurva`.
 *
 * Solo devuelve los puntos medidos con al menos `N_MINIMO_PARA_CORREGIR` casos.
 * Los que no llegan se dejan fuera a propósito, y como `aplicarCurva` publica
 * sin tocar todo peldaño que no encuentra, el efecto es el correcto: un peldaño
 * mal medido no corrige en vez de corregir mal.
 *
 * **Un fallo al leerla no puede tumbar un ciclo de alertas.** Si la tabla no
 * responde se devuelve la curva vacía, que es lo mismo que no corregir: el
 * sistema sigue avisando con el peldaño del modelo, que es como funcionó hasta
 * el 2026-09-03. Perder la corrección es un degradado aceptable; perder la
 * alerta, no.
 *
 * **`ALERTAS_CURVA=off` la desactiva sin desplegar.** Esto decide qué avisos
 * suenan y cuáles no, así que tiene que poder apagarse desde el entorno cuando
 * son las tres de la mañana y algo va mal. Apagarla devuelve el sistema al
 * comportamiento anterior: publica lo que dice el clasificador.
 */
export function curvaActiva(): boolean {
  return process.env.ALERTAS_CURVA?.toLowerCase() !== 'off'
}

export async function cargarCurva(
  admin: SupabaseClient,
): Promise<{ curva: PuntoCurva[]; error: string | null }> {
  if (!curvaActiva()) return { curva: [], error: null }

  const { data, error } = await admin
    .from('severity_calibration')
    .select('tema, severidad_llm, severidad_final, n_eventos')
    .gte('n_eventos', N_MINIMO_PARA_CORREGIR)

  if (error) return { curva: [], error: `severity_calibration: ${error.message}` }

  return {
    curva: (data ?? []).map((fila) => ({
      tema: fila.tema as string,
      severidadLlm: Number(fila.severidad_llm),
      severidadFinal: Number(fila.severidad_final),
    })),
    error: null,
  }
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

/**
 * Cuántos mensajes aceptó el puente en la última hora.
 *
 * Cuenta los aceptados, no los entregados: es el tope de ruido que se le mete
 * al teléfono. Un mensaje aceptado con la sesión caída no llega nunca —el
 * puente no encola ni reintenta—, así que este tope peca de conservador
 * durante una caída, que es el lado correcto por el que equivocarse.
 */
export async function enviadosUltimaHora(
  admin: SupabaseClient,
  ahora = new Date(),
): Promise<number> {
  const desde = new Date(ahora.getTime() - 3_600_000).toISOString()
  const { count, error } = await admin
    .from('alert_signals')
    .select('id', { count: 'exact', head: true })
    .not('aceptado_at', 'is', null)
    .gte('aceptado_at', desde)

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
    aceptado_at: senal.aceptadoAt ?? null,
    error_envio: senal.errorEnvio ?? null,
    canal_estado: senal.canalEstado ?? null,
    canal_detalle: senal.canalDetalle ?? null,
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
