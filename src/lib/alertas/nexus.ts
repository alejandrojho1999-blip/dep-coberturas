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

import { estadoCanal, type EstadoCanal } from '@/lib/alertas/canal'

export interface ResultadoEnvio {
  /**
   * El puente aceptó el mensaje. NO significa que llegara al teléfono: el
   * puente responde `202 queued` y envía después. Lo más cerca que se está de
   * saber si llegará es `canal`, consultado justo antes.
   */
  aceptado: boolean
  error: string | null
  /** Estado de la sesión de WhatsApp en el momento del envío. */
  canal: EstadoCanal
  /** Línea de estado de OpenClaw, para poder auditar la decisión después. */
  canalDetalle: string
}

export function nexusConfigurado(): boolean {
  return Boolean(process.env.NEXUS_WEBHOOK_URL && process.env.NEXUS_WEBHOOK_TOKEN)
}

/**
 * Envía un mensaje por el puente de Nexus.
 *
 * Antes comprueba la sesión de WhatsApp. Si está caída **se envía igual** —el
 * puente encola y OpenClaw reintenta cuando vuelve— pero el resultado lo dice,
 * para que la fila del registro no afirme una entrega que no ocurrió.
 */
export async function enviarNexus(
  mensaje: string,
  evento = 'alerta-temprana',
): Promise<ResultadoEnvio> {
  const url = process.env.NEXUS_WEBHOOK_URL
  const token = process.env.NEXUS_WEBHOOK_TOKEN

  const canal = await estadoCanal()

  if (!url || !token) {
    return {
      aceptado: false,
      error: 'NEXUS_WEBHOOK_URL o NEXUS_WEBHOOK_TOKEN no configurados',
      canal: canal.estado,
      canalDetalle: canal.detalle,
    }
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
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      return {
        aceptado: false,
        error: `puente devolvió ${res.status}: ${cuerpo.slice(0, 200)}`,
        canal: canal.estado,
        canalDetalle: canal.detalle,
      }
    }

    // El puente encoló el mensaje. Si la sesión de WhatsApp estaba caída, eso
    // se registra como el fallo que es, aunque el puente respondiera 202.
    return {
      aceptado: true,
      error: canal.estado === 'caido'
        ? `encolado en el puente, pero la sesión de WhatsApp está caída: ${canal.detalle}`
        : null,
      canal: canal.estado,
      canalDetalle: canal.detalle,
    }
  } catch (e) {
    return {
      aceptado: false,
      error: (e as Error).message,
      canal: canal.estado,
      canalDetalle: canal.detalle,
    }
  }
}
