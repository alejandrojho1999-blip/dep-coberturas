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

export interface ResultadoEnvio {
  ok: boolean
  error: string | null
}

export function nexusConfigurado(): boolean {
  return Boolean(process.env.NEXUS_WEBHOOK_URL && process.env.NEXUS_WEBHOOK_TOKEN)
}

export async function enviarNexus(
  mensaje: string,
  evento = 'alerta-temprana',
): Promise<ResultadoEnvio> {
  const url = process.env.NEXUS_WEBHOOK_URL
  const token = process.env.NEXUS_WEBHOOK_TOKEN

  if (!url || !token) {
    return { ok: false, error: 'NEXUS_WEBHOOK_URL o NEXUS_WEBHOOK_TOKEN no configurados' }
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
      return { ok: false, error: `puente devolvió ${res.status}: ${cuerpo.slice(0, 200)}` }
    }

    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
