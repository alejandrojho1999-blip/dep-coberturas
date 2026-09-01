/**
 * Punto de entrada de los ciclos de alerta temprana.
 *
 * Uso:
 *   npm run alertas -- guerra            # escalada Rusia–OTAN
 *   npm run alertas -- macro             # pulso FED vs Tesoro
 *   npm run alertas -- snapshot          # FedWatch + debasement
 *   npm run alertas -- calendario        # avisos previos y publicación de tasas
 *   npm run alertas -- pulso             # atención pública: búsquedas, foros, redes
 *   npm run alertas -- prueba            # mensaje de prueba por Nexus
 *   npm run alertas -- diagnostico       # comprueba credenciales y fuentes
 *   npm run alertas -- claves            # qué clave de suceso asigna el LLM
 *   npm run alertas -- guerra --dry-run  # compone pero no envía ni guarda
 *
 * Es el binario que llama el cron del servidor. Toda la lógica vive en
 * `src/lib/alertas/motor.ts`; aquí solo se eligen el ciclo y las opciones, se
 * imprime el resultado y se decide el código de salida —que es lo único que el
 * cron sabe leer.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import {
  cicloCalendario,
  cicloGuerra,
  cicloMacro,
  cicloSnapshot,
  type ResultadoCiclo,
} from '@/lib/alertas/motor'
import { enviarNexus, nexusConfigurado } from '@/lib/alertas/nexus'
import { atr as calcularAtr } from '@/lib/alertas/atr'
import { cotizarVarios } from '@/lib/alertas/precios'
import { simbolosDe } from '@/lib/alertas/simbolos'
import { FUENTES_GUERRA, leerFuentes } from '@/lib/alertas/rss'
import { clasificarTitulares } from '@/lib/alertas/clasificador'
import { formatearFalta, proximoEvento } from '@/lib/alertas/calendario'
import { probabilidadProximaReunion } from '@/lib/alertas/fedwatch'
import { recolectarPulso } from '@/lib/pulso/recolector'
import { guardarDocumentos, guardarObservaciones } from '@/lib/pulso/persistencia'

const CICLOS = ['guerra', 'macro', 'snapshot', 'calendario', 'pulso', 'prueba', 'diagnostico', 'claves'] as const
type Ciclo = (typeof CICLOS)[number]

function ahoraTexto(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function log(mensaje: string): void {
  console.log(`[alertas ${ahoraTexto()}] ${mensaje}`)
}

/**
 * Comprobación de que el motor puede funcionar en esta máquina.
 *
 * El cron corre en un servidor donde las credenciales son de un fichero, no de
 * un panel: conviene poder responder en diez segundos si falta una clave, si
 * Yahoo contesta y si el puente de WhatsApp está en pie, sin mandar mensajes.
 */
async function diagnostico(): Promise<number> {
  const filas: Array<[string, boolean, string]> = []

  for (const clave of [
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'OPENROUTER_API_KEY', 'FRED_API_KEY',
    'NEXUS_WEBHOOK_URL', 'NEXUS_WEBHOOK_TOKEN',
  ]) {
    filas.push([`env ${clave}`, Boolean(process.env[clave]), process.env[clave] ? 'presente' : 'VACÍA'])
  }

  try {
    const titulares = await leerFuentes(FUENTES_GUERRA, 24 * 60)
    filas.push(['RSS escalada', titulares.length > 0, `${titulares.length} titulares en 24 h`])
  } catch (e) {
    filas.push(['RSS escalada', false, (e as Error).message])
  }

  const simbolos = simbolosDe('guerra').concat(simbolosDe('tasas'))
  const { cotizaciones, errores } = await cotizarVarios(simbolos.map((s) => s.ticker))
  for (const s of simbolos) {
    const cot = cotizaciones.find((c) => c.ticker === s.ticker)
    const valor = cot ? calcularAtr(cot.velas, 14) : null
    filas.push([
      `precio ${s.ticker}`,
      Boolean(cot && valor),
      cot ? `${cot.precio} · ATR14 ${valor?.toFixed(4) ?? 'sin historia'}` : 'sin cotización',
    ])
  }
  for (const e of errores) filas.push(['precio', false, e])

  const proxima = proximoEvento('todos')
  filas.push([
    'calendario',
    proxima != null,
    proxima ? `${proxima.etiqueta} en ${formatearFalta(proxima.faltanMin)}` : 'calendario agotado, hay que actualizarlo',
  ])

  try {
    const p = await probabilidadProximaReunion()
    filas.push(['FedWatch', true, `subir ${p.probSubida}% con ${p.contrato}${p.aproximado ? ' (aprox.)' : ''}`])
  } catch (e) {
    filas.push(['FedWatch', false, (e as Error).message])
  }

  for (const [nombre, ok, detalle] of filas) {
    console.log(`${ok ? '✅' : '❌'} ${nombre.padEnd(32)} ${detalle}`)
  }

  return filas.every(([, ok]) => ok) ? 0 : 1
}

/**
 * Inspección de las claves de suceso sobre los titulares reales del momento.
 *
 * Es la comprobación que decide si el freno anti-repetición sirve: dos medios
 * contando el mismo hecho tienen que producir la misma clave. Si aquí salen
 * claves distintas para el mismo suceso, el teléfono recibirá duplicados y hay
 * que endurecer el prompt del clasificador.
 */
async function claves(): Promise<number> {
  const titulares = await leerFuentes(FUENTES_GUERRA, 180)
  if (!titulares.length) {
    console.log('No hay titulares recientes que inspeccionar.')
    return 0
  }

  const { clasificados, errores } = await clasificarTitulares(titulares, 'guerra', 12)
  for (const e of errores) console.error(`error: ${e}`)

  const porClave = new Map<string, string[]>()
  for (const t of clasificados) {
    const { clasificacion: c } = t
    const clave = c.relevante ? c.eventoKey : '(descartado)'
    console.log(`${clave.padEnd(46)} sev ${c.severidad}  ${t.titulo.slice(0, 62)}`)
    porClave.set(clave, [...(porClave.get(clave) ?? []), t.titulo])
  }

  const agrupados = [...porClave.entries()].filter(([k, v]) => k !== '(descartado)' && v.length > 1)
  console.log(
    `\n${clasificados.length} titulares → ${porClave.size - (porClave.has('(descartado)') ? 1 : 0)} sucesos distintos` +
    `; ${agrupados.length} suceso(s) contados por más de un medio y agrupados correctamente.`,
  )

  return errores.length ? 1 : 0
}

/**
 * Recolección del pulso público.
 *
 * No manda nada al teléfono ni compone mensajes: solo mide y guarda. Por eso no
 * devuelve un `ResultadoCiclo` como los demás ciclos, y por eso puede correr
 * cada media hora sin gastar ni una llamada al modelo de lenguaje.
 */
async function pulso(dryRun: boolean): Promise<number> {
  const resultado = await recolectarPulso()

  log(
    `pulso: ${resultado.observaciones.length} observaciones, ${resultado.documentos.length} documentos, ` +
    `${resultado.fuentesVivas.length}/6 fuentes vivas (${resultado.fuentesVivas.join(', ') || 'ninguna'})`,
  )
  for (const e of resultado.errores) log(`  error: ${e}`)

  if (dryRun) {
    const porFuente = new Map<string, number>()
    for (const o of resultado.observaciones) porFuente.set(o.fuente, (porFuente.get(o.fuente) ?? 0) + 1)
    for (const [fuente, n] of porFuente) console.log(`  ${fuente.padEnd(10)} ${n} observaciones`)
    for (const o of resultado.observaciones.slice(0, 15)) {
      console.log(`  · ${o.fuente}/${o.geo ?? '—'} ${o.termino} = ${o.valor} ${o.unidad}`)
    }
    for (const d of resultado.documentos.slice(0, 10)) {
      console.log(`  » [${d.fuente}] ${d.titulo.slice(0, 90)}`)
    }
    return 0
  }

  const admin = createAdminClient()
  const guardadas = await guardarObservaciones(admin, resultado.observaciones)
  const guardados = await guardarDocumentos(admin, resultado.documentos)
  log(`pulso: ${guardadas} observaciones nuevas y ${guardados} documentos nuevos guardados`)

  // Que todas las fuentes fallen no es un día flojo, es una avería.
  if (!resultado.fuentesVivas.length) return 1
  return 0
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const ciclo = args.find((a) => !a.startsWith('--')) as Ciclo | undefined
  const dryRun = args.includes('--dry-run')
  const forzar = args.includes('--forzar')

  if (!ciclo || !CICLOS.includes(ciclo)) {
    console.error(`Ciclo no reconocido. Opciones: ${CICLOS.join(', ')}`)
    return 2
  }

  if (ciclo === 'diagnostico') return diagnostico()
  if (ciclo === 'claves') return claves()
  if (ciclo === 'pulso') return pulso(dryRun)

  if (ciclo === 'prueba') {
    if (!nexusConfigurado()) {
      console.error('NEXUS_WEBHOOK_URL o NEXUS_WEBHOOK_TOKEN no están configurados.')
      return 3
    }
    const envio = await enviarNexus(
      `✅ Prueba del sistema de alerta temprana\nEnviado ${ahoraTexto()} UTC desde dep-coberturas.`,
      'prueba',
    )
    // Se distinguen los tres desenlaces porque los tres se ven distintos en el
    // teléfono: llega, no llega, o llegará cuando WhatsApp vuelva.
    if (!envio.aceptado) {
      log(`el puente rechazó el mensaje: ${envio.error}`)
      return 1
    }
    if (envio.canal === 'caido') {
      log(`encolado, PERO NO ENTREGADO: ${envio.canalDetalle}`)
      log('reconecta la sesión: openclaw channels login --channel whatsapp --account nexus')
      return 1
    }
    log(
      envio.canal === 'vivo'
        ? 'mensaje entregado al puente con la sesión de WhatsApp viva'
        : `mensaje entregado al puente; estado del canal indeterminado (${envio.canalDetalle})`,
    )
    return 0
  }

  // En seco no se toca la base: el cliente de servicio ni siquiera se crea, así
  // se puede probar el formato de los mensajes sin credenciales de escritura.
  const admin = dryRun ? (null as never) : createAdminClient()

  let resultado: ResultadoCiclo
  switch (ciclo) {
    case 'guerra':     resultado = await cicloGuerra(admin, { dryRun }); break
    case 'macro':      resultado = await cicloMacro(admin, { dryRun }); break
    case 'snapshot':   resultado = await cicloSnapshot(admin, { dryRun, forzar }); break
    case 'calendario': resultado = await cicloCalendario(admin, { dryRun }); break
  }

  log(
    `${resultado.ciclo}: revisados ${resultado.revisados}, enviados ${resultado.enviados}, ` +
    `omitidos ${resultado.omitidos}, errores ${resultado.errores.length}`,
  )
  for (const e of resultado.errores) log(`  error: ${e}`)
  if (dryRun) {
    for (const m of resultado.mensajes) {
      console.log('\n──────── mensaje ────────\n' + m + '\n')
    }
  }

  // Un fallo parcial tiene que verse en el log del cron, no esconderse tras un
  // código de salida cero.
  return resultado.errores.length ? 1 : 0
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    console.error(`[alertas ${ahoraTexto()}] fallo no controlado:`, e)
    process.exit(1)
  })
