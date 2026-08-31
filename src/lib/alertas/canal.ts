/**
 * Estado del canal de WhatsApp de Nexus.
 *
 * El puente responde `202 queued` en cuanto recibe la petición y hace el envío
 * después, de forma asíncrona: su respuesta dice que **aceptó** el mensaje, no
 * que llegara al teléfono. Cuando la sesión de WhatsApp está caída, el puente
 * sigue devolviendo 202 y el fallo solo aparece en su log medio minuto más
 * tarde. Un registro que marque eso como enviado miente, y una alerta que crees
 * entregada y no llegó es peor que ninguna alerta.
 *
 * Por eso se consulta el estado del canal antes de enviar. La fuente es el CLI
 * de OpenClaw, que es quien sabe si hay una sesión viva.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const ejecutar = promisify(execFile)

export type EstadoCanal = 'vivo' | 'caido' | 'desconocido'

export interface CanalWhatsapp {
  estado: EstadoCanal
  /** Línea de estado tal cual la dio OpenClaw, para el registro. */
  detalle: string
}

/** Ruta del binario de OpenClaw; el cron no hereda el PATH del usuario. */
function rutaOpenclaw(): string {
  return process.env.OPENCLAW_BIN || '/root/.nvm/versions/node/v22.22.0/bin/openclaw'
}

function cuenta(): string {
  return process.env.NEXUS_WHATSAPP_ACCOUNT || 'nexus'
}

/**
 * Interpreta la línea de estado de una cuenta.
 *
 * La salida es de la forma:
 *   `- WhatsApp nexus (Nexus): enabled, configured, not linked, stopped, …`
 *   `- WhatsApp stefy (Stefy): enabled, configured, linked, running, connected, …, health:healthy`
 *
 * Se comprueba `linked` y `connected` como palabras sueltas, porque `not linked`
 * contiene `linked` y una comparación por subcadena daría vivo un canal muerto.
 *
 * El `--json` del CLI no sirve aquí: ignora `--account` y devuelve un agregado
 * en el que una cuenta sana aparece como no vinculada (verificado 2026-08-31).
 */
export function interpretarLinea(linea: string): EstadoCanal {
  const campos = linea
    .slice(linea.indexOf(':') + 1)
    .split(',')
    .map((c) => c.trim().toLowerCase())

  if (campos.includes('not linked') || campos.includes('disconnected')) return 'caido'
  if (campos.includes('linked') && campos.includes('connected')) return 'vivo'
  return 'desconocido'
}

export function buscarLineaDeCuenta(salida: string, cuentaBuscada: string): string | null {
  const patron = new RegExp(`^\\s*-\\s*WhatsApp\\s+${cuentaBuscada}\\b.*$`, 'im')
  return salida.match(patron)?.[0]?.trim() ?? null
}

/**
 * Consulta si la sesión de WhatsApp está viva.
 *
 * Falla en abierto: si el CLI no responde, tarda demasiado o cambia su formato,
 * se devuelve `desconocido` y el envío se intenta igual. Perder una alerta de
 * escalada por un parseo roto sería peor que el problema que esto resuelve.
 */
export async function estadoCanal(timeoutMs = 20_000): Promise<CanalWhatsapp> {
  try {
    const { stdout } = await ejecutar(
      rutaOpenclaw(),
      ['channels', 'status', '--channel', 'whatsapp'],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
    )

    const linea = buscarLineaDeCuenta(stdout, cuenta())
    if (!linea) {
      return { estado: 'desconocido', detalle: `sin línea de estado para la cuenta ${cuenta()}` }
    }

    return { estado: interpretarLinea(linea), detalle: linea }
  } catch (e) {
    return { estado: 'desconocido', detalle: `no se pudo consultar: ${(e as Error).message}` }
  }
}
