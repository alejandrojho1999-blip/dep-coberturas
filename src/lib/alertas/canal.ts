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
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const ejecutar = promisify(execFile)

export type EstadoCanal = 'vivo' | 'caido' | 'desconocido'

export interface CanalWhatsapp {
  estado: EstadoCanal
  /** Línea de estado tal cual la dio OpenClaw, para el registro. */
  detalle: string
}

/**
 * Ruta del binario de OpenClaw; el cron no hereda el PATH del usuario.
 *
 * No se puede fijar una versión de Node concreta: nvm instala cada release en
 * su propio directorio y al actualizar OpenClaw el binario se muda. Una ruta
 * escrita a mano sobrevive hasta la siguiente actualización y luego falla con
 * `ENOENT`, que `estadoCanal` traduce a `desconocido` — es decir, la sonda deja
 * de vigilar el canal sin que nadie se entere. Ocurrió el 2026-09-08, cuando
 * `v22.22.0` desapareció en favor de `v22.23.2`.
 *
 * Por eso se busca: primero la escotilla `OPENCLAW_BIN`, después los binarios
 * que de verdad existan bajo nvm —el más alto por orden natural, que es el más
 * reciente—, y por último `openclaw` a secas, que resuelve por PATH cuando lo
 * hay. La búsqueda es síncrona y toca un solo directorio.
 */
function rutaOpenclaw(): string {
  if (process.env.OPENCLAW_BIN) return process.env.OPENCLAW_BIN

  const raiz = process.env.OPENCLAW_NVM_DIR || '/root/.nvm/versions/node'
  try {
    const candidatos = readdirSync(raiz)
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
      .map((version) => join(raiz, version, 'bin', 'openclaw'))
      .filter((ruta) => existsSync(ruta))

    if (candidatos[0]) return candidatos[0]
  } catch {
    // El directorio de nvm puede no existir (contenedor, otra máquina): se cae
    // al PATH, que es lo correcto en un entorno de desarrollo normal.
  }

  return 'openclaw'
}

/**
 * Entorno con el que se invoca el CLI.
 *
 * El ejecutable `openclaw` es un script `#!/usr/bin/env node`, así que la
 * versión de Node que acaba corriendo sale del PATH, no del binario que se
 * eligió. Los scripts de alertas corren bajo el Node de la aplicación, que es
 * más antiguo que el mínimo que exige OpenClaw, y el CLI aborta antes de hacer
 * nada. Anteponiendo el `bin/` del propio binario al PATH, `env node` resuelve
 * al Node hermano, que por construcción es el que esa instalación soporta.
 */
function entornoDe(binario: string): NodeJS.ProcessEnv {
  const bin = dirname(binario)
  return { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` }
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
    const binario = rutaOpenclaw()
    const { stdout } = await ejecutar(
      binario,
      ['channels', 'status', '--channel', 'whatsapp'],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024, env: entornoDe(binario) },
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
