/**
 * Ejecución programada de los agentes Peter y Small desde el VPS.
 *
 * Corre en esta máquina, y no en el planificador de la nube, por precisión. La
 * cascada tiene que dispararse una hora antes del cierre para que dé tiempo a
 * abrir o cerrar la posición recomendada ese mismo día, y ninguno de los dos
 * planificadores de la nube puede prometer esa hora:
 *
 * - El plan Hobby de Vercel invoca el cron en cualquier instante de la hora
 *   indicada, para repartir carga. `0 19 * * *` puede saltar a las 19:59, que
 *   es un minuto antes del cierre.
 * - GitHub Actions no garantiza la puntualidad de `schedule` y en horas de
 *   carga se retrasa sin aviso.
 *
 * Además aquí no existe el límite de 300 s por invocación del plan Hobby, que
 * es lo que ahogaba a Small: medido el 2026-09-06 saca 15 candidatos al paso 4,
 * y quince llamadas al modelo no caben con holgura en ese presupuesto.
 *
 * El VPS ya sostiene el motor de alerta temprana con este mismo patrón
 * (`scripts/alertas/`), así que no se introduce una dependencia nueva: se
 * reutiliza la que ya existe.
 *
 * Uso:
 *   npm run agentes                 # respeta la ventana y el sello del día
 *   npm run agentes -- peter        # solo un agente
 *   npm run agentes -- --forzar     # ignora ventana y sello (sigue exigiendo mercado abierto)
 *   npm run agentes -- --estado     # solo informa, no ejecuta
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  describeMarketStatus,
  enVentanaPrecierre,
  marketMoment,
  marketStatus,
  minutosParaCierre,
} from '@/lib/market-hours'
import {
  CASCADA_CATEGORIES,
  ejecutarCascada,
  isCascadaCategory,
  type CascadaCategory,
} from '@/lib/agentes/cascada'

/**
 * Dónde se anota el último día ejecutado.
 *
 * El cron dispara cada cuarto de hora dentro de una ventana ancha, porque el
 * desfase entre Nueva York y Madrid no es constante: Estados Unidos y Europa
 * cambian la hora en fines de semana distintos, así que hay semanas al año en
 * las que una hora fija del crontab caería fuera. La ventana ancha lo absorbe y
 * este sello impide que se ejecute más de una vez: manda el primer disparo que
 * cae dentro, y los demás salen por la puerta de atrás sin tocar Yahoo ni el
 * modelo.
 */
const SELLO = process.env.AGENTES_SELLO_PATH ?? '/var/lib/dep-coberturas/agentes-ultimo-dia'

function log(msg: string) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log(`[agentes ${t}] ${msg}`)
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
    // No es motivo para fallar: ya se hizo el trabajo. Pero sin sello el
    // siguiente disparo repetiría la cascada, así que tiene que verse.
    log(`⚠ no se pudo escribir el sello en ${SELLO}: ${(e as Error).message}`)
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const forzar = args.includes('--forzar')
  const soloEstado = args.includes('--estado')
  const pedido = args.find(a => !a.startsWith('--'))

  let categorias: readonly CascadaCategory[] = CASCADA_CATEGORIES
  if (pedido) {
    const mapa: Record<string, string> = { peter: 'PETER_LYNCH', small: 'SMALL_CAPS' }
    const cat = mapa[pedido.toLowerCase()] ?? pedido.toUpperCase()
    if (!isCascadaCategory(cat)) {
      log(`agente no reconocido: ${pedido}. Usa 'peter' o 'small'.`)
      return 1
    }
    categorias = [cat]
  }

  const ahora = new Date()
  const estado = marketStatus(ahora)
  const momento = marketMoment(ahora)

  if (soloEstado) {
    log(describeMarketStatus(estado))
    log(`faltan ${minutosParaCierre(ahora)} min para el cierre`)
    log(`en ventana de precierre: ${enVentanaPrecierre(ahora) ? 'sí' : 'no'}`)
    log(`último día ejecutado: ${leerSello() ?? 'nunca'} · hoy en ET: ${momento.fechaET}`)
    return 0
  }

  // El paso 4 pide el precio real de mercado y de él salen el precio de
  // entrada, el objetivo y el stop. Fuera de sesión Yahoo devuelve el último
  // cierre, así que la recomendación nacería anclada a un precio que ya no
  // existe. Esto no lo salta ni `--forzar`.
  if (!estado.abierto) {
    log(`sin ejecutar: ${describeMarketStatus(estado)}`)
    return 0
  }

  if (!forzar) {
    if (!enVentanaPrecierre(ahora)) {
      log(`sin ejecutar: faltan ${minutosParaCierre(ahora)} min para el cierre, fuera de la ventana`)
      return 0
    }
    if (leerSello() === momento.fechaET) {
      log(`sin ejecutar: ya se ejecutó hoy (${momento.fechaET})`)
      return 0
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const userId = process.env.CRON_USER_ID
  if (!url || !serviceKey) {
    log('falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return 1
  }
  if (!userId) {
    log('falta CRON_USER_ID: es la cuenta sobre la que se escriben las recomendaciones')
    return 1
  }
  if (!process.env.OPENROUTER_API_KEY) {
    log('falta OPENROUTER_API_KEY: el paso 4 no podría dictaminar')
    return 1
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  log(`${describeMarketStatus(estado)} · faltan ${minutosParaCierre(ahora)} min para el cierre`)

  let huboError = false
  for (const category of categorias) {
    try {
      const r = await ejecutarCascada(admin, userId, category)
      for (const linea of r.log) log(`  ${linea}`)
      log(
        `${category}: ${r.candidatos} candidatos · ${r.creadas} nuevas · ` +
        `${r.omitidas} ya vivas · ${r.vendidas} vendidas · ${r.fallidos} fallos` +
        (r.truncadas ? ` · ${r.truncadas} sin analizar` : '')
      )
      if (r.fallidos) huboError = true
    } catch (e) {
      log(`${category}: ERROR — ${(e as Error).message}`)
      huboError = true
    }
  }

  // El sello se pone aunque algún candidato fallara: la pasada del día se hizo,
  // y repetirla volvería a gastar tokens sobre los mismos candidatos. Solo un
  // fallo total —que sale por la excepción de arriba— merece reintento mañana.
  escribirSello(momento.fechaET)

  return huboError ? 1 : 0
}

process.exitCode = await main()
