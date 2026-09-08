/**
 * Tareas programadas de opciones, ejecutadas desde el VPS.
 *
 * Antes las disparaba GitHub Actions llamando a la ruta de API. Medido el
 * 2026-09-08, el `schedule` de GitHub cumplía **2 o 3** de las 14 citas diarias
 * de la revisión de salidas: no es que fallara, es que sencillamente no
 * ejecutaba. La documentación de GitHub lo admite —`schedule` se retrasa o se
 * descarta cuando hay carga— y con una tarea que existe para poner al día el
 * registro cada media hora, cumplir el 20 % es no cumplirla.
 *
 * Aquí no hay planificador ajeno, ni límite de 300 s por invocación, ni
 * dependencia del despliegue de Vercel. El VPS ya sostiene el motor de alerta
 * temprana y la cascada de agentes con este mismo patrón.
 *
 * La decisión de si toca trabajar **no vive aquí**: está en
 * `@/lib/options/cron-opciones`, compartida con las rutas de API, para que el
 * cron y el respaldo HTTP no puedan aplicar reglas distintas.
 *
 * Uso:
 *   npm run opciones -- salidas          # revisión de niveles de salida
 *   npm run opciones -- archivo          # archivo de cadenas (una vez al día)
 *   npm run opciones -- archivo --forzar # ignora el sello del día
 *   npm run opciones -- estado           # informa y no ejecuta nada
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { describeMarketStatus, marketMoment, marketStatus } from '@/lib/market-hours'
import {
  archivarCadenasProgramado,
  revisarSalidasProgramada,
} from '@/lib/options/cron-opciones'

const TAREAS = ['salidas', 'archivo', 'estado'] as const
type Tarea = (typeof TAREAS)[number]

/**
 * Dónde se anota el último día archivado.
 *
 * El archivo es una captura por sesión, y el crontab dispara varias veces
 * dentro de la ventana posterior al cierre porque el desfase entre Nueva York y
 * Madrid no es constante: Estados Unidos y Europa cambian la hora en fines de
 * semana distintos. La ventana ancha lo absorbe y el sello impide repetir la
 * captura: manda el primer disparo que cae dentro.
 *
 * El `upsert` sobre `(fecha, ticker)` ya hace la escritura idempotente, así que
 * el sello no protege los datos: evita pedirle a Yahoo treinta y seis cadenas
 * de nuevo, que es lo caro.
 *
 * La revisión de salidas **no** lleva sello: tiene que correr cada media hora.
 */
const SELLO = process.env.OPCIONES_SELLO_PATH ?? '/var/lib/dep-coberturas/archivo-ultimo-dia'

function log(msg: string) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[opciones ${t}] ${msg}`)
}

function leerSello(): string | null {
  try {
    return readFileSync(SELLO, 'utf8').trim() || null
  } catch {
    return null
  }
}

function escribirSello(fechaET: string) {
  try {
    mkdirSync(dirname(SELLO), { recursive: true })
    writeFileSync(SELLO, `${fechaET}\n`, 'utf8')
  } catch (e) {
    // No es motivo para fallar: el trabajo ya se hizo. Pero sin sello el
    // siguiente disparo repetiría la captura, así que tiene que verse.
    log(`⚠ no se pudo escribir el sello en ${SELLO}: ${(e as Error).message}`)
  }
}

/**
 * Cliente con la clave de servicio.
 *
 * El cron no tiene sesión de usuario: opera sobre la cuenta de `CRON_USER_ID`
 * con la clave de servicio, igual que hace la ruta de API con `createAdminClient`.
 */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function salidas(): Promise<number> {
  const userId = process.env.CRON_USER_ID
  if (!userId) {
    log('sin ejecutar: CRON_USER_ID no está configurado')
    return 3
  }

  const r = await revisarSalidasProgramada(admin(), userId)

  if (!r.ejecutado) {
    log(`sin ejecutar: ${r.mensaje}`)
    return 0
  }

  log(`revisión: ${r.cerradas} cerrada(s), ${r.fallidos} fallida(s) · ${r.mensaje}`)
  for (const e of r.errores) log(`  error: ${e}`)

  // Un fallo parcial sale con código distinto de cero para que se vea en el
  // log del cron, igual que ponía el job en rojo en GitHub.
  return r.errores.length ? 1 : 0
}

async function archivo(forzar: boolean): Promise<number> {
  const ahora = new Date()
  const momento = marketMoment(ahora)
  const sello = leerSello()

  if (!forzar && sello === momento.fechaET) {
    log(`sin ejecutar: la sesión de ${momento.fechaET} ya está archivada`)
    return 0
  }

  const r = await archivarCadenasProgramado(admin(), ahora)

  if (!r.ejecutado) {
    log(`sin ejecutar: ${r.mensaje}`)
    return 0
  }

  log(
    `archivo ${r.fecha}: ${r.archivados}/${r.universo} tickers · ` +
    `${r.contratos} contratos · ${r.kb} KB · ${r.vacios?.length ?? 0} vacíos · ${r.fallidos?.length ?? 0} fallidos`,
  )

  // Que fallen algunos tickers sueltos es normal: Yahoo tiene huecos. Que no se
  // archive ni uno significa que la fuente cambió o que la clave caducó, y eso
  // no debe pasar desapercibido ni sellar el día como hecho.
  if (!r.archivados) {
    log('NINGUNA cadena archivada: revisa Yahoo y las credenciales')
    return 1
  }

  escribirSello(r.fecha ?? momento.fechaET)
  return 0
}

function estado(): number {
  const ahora = new Date()
  const momento = marketMoment(ahora)
  log(describeMarketStatus(marketStatus(ahora)))
  log(`hoy en Nueva York: ${momento.fechaET} · ${Math.floor(momento.minutosET / 60)}:${String(momento.minutosET % 60).padStart(2, '0')} ET`)
  log(`último día archivado: ${leerSello() ?? 'nunca'}`)
  log(`CRON_USER_ID: ${process.env.CRON_USER_ID ? 'presente' : 'VACÍO'}`)
  return 0
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const tarea = args.find((a) => !a.startsWith('--')) as Tarea | undefined
  const forzar = args.includes('--forzar')

  if (!tarea || !TAREAS.includes(tarea)) {
    console.error(`Tarea no reconocida. Opciones: ${TAREAS.join(', ')}`)
    return 2
  }

  if (tarea === 'estado') return estado()
  if (tarea === 'salidas') return salidas()
  return archivo(forzar)
}

main()
  .then((codigo) => { process.exitCode = codigo })
  .catch((e) => {
    log(`fallo no controlado: ${(e as Error).stack ?? (e as Error).message}`)
    process.exitCode = 1
  })
