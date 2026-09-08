/**
 * Salida a WhatsApp por Nexus.
 *
 * Nexus es el bot de OpenClaw que ya vive en este servidor. El puente
 * (`/root/openclaw-webhook/server.js`, servicio `openclaw-webhook`) escucha solo
 * en `127.0.0.1` y ejecuta `openclaw message send --channel whatsapp`, así que
 * este módulo únicamente le pasa el texto ya formateado. Por eso el motor corre
 * como cron del VPS: publicar ese puente en internet sería abrir un disparador
 * de mensajes a quien encuentre el token.
 *
 * El puente toma el texto de `data.message` y solo acepta la ruta que ya tenía
 * publicada, así que no hubo que tocarlo: lo que identifica a este proyecto en
 * su log es el campo `event`.
 *
 * Nunca lanza. Una alerta que no se puede enviar debe quedar registrada en la
 * base con su error, no reventar el ciclo y perder también las siguientes.
 */

import { readFileSync } from 'node:fs'

import { estadoCanal, type EstadoCanal } from '@/lib/alertas/canal'

export interface ResultadoEnvio {
  /**
   * El puente se hizo cargo del mensaje: o lo entregó, o lo tiene en su cola
   * con reintento. En ningún caso se perdió.
   */
  aceptado: boolean
  /**
   * OpenClaw confirmó la entrega. Esto sí es una entrega de verdad: el puente
   * ya no responde hasta saberlo.
   */
  entregado: boolean
  /** El mensaje no salió, pero está en la cola del puente y se reintentará. */
  encolado: boolean
  /** Id del mensaje en WhatsApp, cuando se entregó. Sirve para auditar. */
  messageId: string | null
  error: string | null
  /** Estado de la sesión de WhatsApp en el momento del envío. */
  canal: EstadoCanal
  /** Línea de estado de OpenClaw, para poder auditar la decisión después. */
  canalDetalle: string
}

/** Respuesta del puente. Los campos opcionales faltan en versiones viejas. */
interface RespuestaPuente {
  delivered?: boolean
  queued?: boolean
  messageId?: string | null
  id?: string
  attempts?: number
  nextAttemptAt?: string | null
  error?: string
}

/**
 * Token del puente, con un solo origen de verdad.
 *
 * El token vivía en dos sitios: `WEBHOOK_TOKEN` en el fichero de entorno que
 * carga el servicio del puente, y `NEXUS_WEBHOOK_TOKEN` en el de la aplicación.
 * El 2026-09-08 se rotó solo el primero y todo respondió `401` durante horas
 * sin que nada lo dijera: dos copias de un secreto son dos oportunidades de
 * divergir, y la divergencia solo se ve cuando ya falló.
 *
 * Aquí manda el fichero del puente, porque el puente es quien valida: si se lee,
 * no hay forma de que la aplicación mande un token que el puente vaya a
 * rechazar. La variable de entorno queda como respaldo para cuando ese fichero
 * no existe —una máquina de desarrollo, o un despliegue donde el motor no corra
 * junto al puente—. `NEXUS_WEBHOOK_ENV_FILE` cambia la ruta; apuntarla a algo
 * inexistente devuelve el control a la variable.
 */
export function tokenPuente(): string | null {
  const ruta = process.env.NEXUS_WEBHOOK_ENV_FILE || '/root/openclaw-webhook/webhook.env'

  try {
    const contenido = readFileSync(ruta, 'utf8')
    const valor = contenido.match(/^\s*WEBHOOK_TOKEN\s*=\s*(.*)$/m)?.[1]
    if (valor) {
      // El fichero lo consume systemd, que no quita comillas ni espacios de la
      // misma forma en todos los casos; se normaliza igual que haría el shell.
      const limpio = valor.trim().replace(/^["']|["']$/g, '')
      if (limpio) return limpio
    }
  } catch {
    // Sin fichero legible se usa la variable, que es lo correcto fuera del VPS.
  }

  return process.env.NEXUS_WEBHOOK_TOKEN || null
}

export function nexusConfigurado(): boolean {
  return Boolean(process.env.NEXUS_WEBHOOK_URL && tokenPuente())
}

/**
 * Envía un mensaje por el puente de Nexus.
 *
 * Antes comprueba la sesión de WhatsApp. Si está caída **se intenta igual**,
 * porque el estado del canal se lee justo antes y puede haber vuelto entre la
 * consulta y el POST; pero el resultado lo dice, para que la fila del registro
 * no afirme una entrega que no ocurrió.
 *
 * Desde el 2026-09-08 el puente responde **después** de intentar el envío, y
 * distingue tres casos: `200` con `delivered:true` (entregado y confirmado por
 * OpenClaw), `202` con `queued:true` (no salió, pero está en su cola en disco y
 * lo reintentará con espera creciente durante 24 h) y `502` (se perdió). Lo que
 * manda es el campo `delivered`, no el código: un 202 significa «todavía no».
 *
 * Un puente viejo, sin esos campos, responde `202` sin `delivered`. En ese caso
 * se cae al comportamiento anterior: se toma como aceptado y la entrega se
 * infiere del estado del canal, que es lo más cerca que se podía estar entonces.
 */
export async function enviarNexus(
  mensaje: string,
  evento = 'alerta-temprana',
): Promise<ResultadoEnvio> {
  const url = process.env.NEXUS_WEBHOOK_URL
  const token = tokenPuente()

  const canal = await estadoCanal()

  const fallo = (error: string): ResultadoEnvio => ({
    aceptado: false,
    entregado: false,
    encolado: false,
    messageId: null,
    error,
    canal: canal.estado,
    canalDetalle: canal.detalle,
  })

  if (!url || !token) {
    return fallo(
      'sin puente: falta NEXUS_WEBHOOK_URL, o el token no está ni en ' +
      `${process.env.NEXUS_WEBHOOK_ENV_FILE || '/root/openclaw-webhook/webhook.env'} ` +
      'ni en NEXUS_WEBHOOK_TOKEN',
    )
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: evento,
        source: 'dep-coberturas',
        timestamp: new Date().toISOString(),
        // El puente toma `data.message` como texto del WhatsApp.
        data: { message: mensaje },
      }),
      // El puente ya no responde hasta terminar el envío, y OpenClaw tarda
      // 10-20 s por mensaje; con un margen de 15 s se cortaría una entrega que
      // iba bien y se registraría como fallo lo que en realidad llegó.
      signal: AbortSignal.timeout(90_000),
    })

    const cuerpo: RespuestaPuente = await res.json().catch(() => ({}))

    if (!res.ok) {
      return fallo(
        `puente devolvió ${res.status}: ${(cuerpo.error ?? JSON.stringify(cuerpo)).slice(0, 200)}`,
      )
    }

    // Puente viejo: sin `delivered` no hay forma de saberlo, así que se infiere
    // del estado del canal como se hacía antes.
    if (cuerpo.delivered === undefined) {
      return {
        aceptado: true,
        entregado: canal.estado === 'vivo',
        encolado: false,
        messageId: null,
        error: canal.estado === 'caido'
          ? `no entregado: el puente aceptó el mensaje, pero la sesión de WhatsApp está caída y no hay reintento: ${canal.detalle}`
          : null,
        canal: canal.estado,
        canalDetalle: canal.detalle,
      }
    }

    if (cuerpo.delivered) {
      return {
        aceptado: true,
        entregado: true,
        encolado: false,
        messageId: cuerpo.messageId ?? null,
        error: null,
        canal: canal.estado,
        canalDetalle: canal.detalle,
      }
    }

    // No salió. Encolado no es un fallo perdido: se reintentará. Se registra
    // como error igualmente para que nadie lea la fila como una entrega.
    return {
      aceptado: Boolean(cuerpo.queued),
      entregado: false,
      encolado: Boolean(cuerpo.queued),
      messageId: null,
      error: cuerpo.queued
        ? `no entregado todavía: en la cola del puente, ${cuerpo.attempts ?? 1} intento(s), ` +
          `próximo ${cuerpo.nextAttemptAt ?? 'sin programar'}: ${String(cuerpo.error).slice(0, 200)}`
        : `no entregado y no encolado: ${String(cuerpo.error).slice(0, 200)}`,
      canal: canal.estado,
      canalDetalle: canal.detalle,
    }
  } catch (e) {
    return fallo((e as Error).message)
  }
}
