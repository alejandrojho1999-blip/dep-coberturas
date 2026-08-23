import { timingSafeEqual } from 'node:crypto'

/**
 * Autenticación de las tareas programadas.
 *
 * Un cron no tiene cookie de sesión, así que se identifica con un secreto
 * compartido en la cabecera `Authorization: Bearer <CRON_SECRET>`. Es la misma
 * convención que usa el planificador de Vercel.
 */

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

/**
 * Comparación en tiempo constante.
 *
 * Un `===` sobre cadenas sale en cuanto encuentra el primer carácter distinto,
 * y esa diferencia de tiempo es medible: permite adivinar el secreto carácter a
 * carácter. Las longitudes se comparan antes porque `timingSafeEqual` exige
 * búferes del mismo tamaño; que la longitud se filtre no ayuda a nadie.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Comprueba que la petición venga del planificador.
 *
 * Falla cerrado: si `CRON_SECRET` no está configurado responde 503 en vez de
 * dejar pasar a cualquiera. Una tarea que escribe en la base de datos nunca
 * debe quedar abierta por un despiste de configuración.
 */
export function authorizeCron(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return { ok: false, status: 503, error: 'CRON_SECRET no está configurado' }
  }

  const header = request.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  if (!secretsMatch(header.slice(prefix.length), expected)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true }
}

/**
 * Cuenta sobre la que operan las tareas programadas.
 *
 * Sin RLS detrás del cliente de servicio, este identificador es la única
 * frontera entre cuentas: se toma de la configuración y **jamás** del cuerpo o
 * de la query de la petición, para que quien logre llamar al endpoint no pueda
 * elegir sobre qué datos actúa.
 */
export function cronUserId(): string | null {
  return process.env.CRON_USER_ID || null
}
