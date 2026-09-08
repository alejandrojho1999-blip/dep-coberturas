#!/usr/bin/env node
/**
 * Puente dep-coberturas → OpenClaw → WhatsApp.
 *
 * Escucha `POST /webhook/liberty-trading` en `127.0.0.1`, autentica con un
 * bearer token y entrega el texto por WhatsApp invocando el CLI de OpenClaw.
 *
 * ## Por qué esta versión existe
 *
 * La anterior respondía `202 queued` **antes** de llamar a OpenClaw y disparaba
 * sin mirar el resultado. Eso tenía tres consecuencias, las tres verificadas en
 * producción:
 *
 *   1. El `202` era una promesa que el puente no podía cumplir. Quien llamaba
 *      registraba «aceptado» y no había forma de distinguir un envío bueno de
 *      uno que murió medio minuto después.
 *   2. No había cola ni reintento. Con la sesión de WhatsApp caída —cuatro días
 *      seguidos entre el 2026-09-05 y el 2026-09-08— cada mensaje de esas horas
 *      se perdía para siempre.
 *   3. El fallo solo existía en el journal del servicio. Nadie lo miraba.
 *
 * Aquí el orden se invierte: primero se persiste el mensaje en disco, después se
 * intenta enviarlo, y solo entonces se responde diciendo lo que de verdad pasó.
 *
 * ## Contrato de respuesta
 *
 *   200 `{ok, delivered:true, messageId}`   entregado, confirmado por OpenClaw.
 *   202 `{ok, delivered:false, queued:true}` no salió, pero está en la cola y se
 *                                            reintentará. No se pierde.
 *   502 `{ok:false, delivered:false, queued:false}` fallo permanente, o la cola
 *                                            no se pudo escribir: se pierde, y
 *                                            se dice.
 *
 * Quien llama debe mirar `delivered`, no el código: un 202 significa «todavía
 * no». Los códigos 2xx se mantienen para no romper clientes viejos que solo
 * miraban `res.ok`.
 *
 * ## La cola
 *
 * Un fichero JSON por mensaje bajo `queue/`, escrito con `fsync` antes de
 * contestar, así que sobrevive a un reinicio o a un corte. El drenador lo
 * recorre cada `DRAIN_INTERVAL_MS` y reintenta lo que ya cumplió su espera. Los
 * reintentos son escalonados (30 s, 2 min, 5 min, 15 min, 30 min y luego cada
 * hora) y se abandonan tras `MAX_AGE_MS`; lo abandonado se mueve a `dead/` en
 * vez de borrarse, para poder mirarlo después.
 *
 * Los envíos se serializan con un cerrojo: OpenClaw tarda 10-20 s por mensaje y
 * dos invocaciones simultáneas compiten por la misma sesión de WhatsApp.
 *
 * ## Despliegue
 *
 * Este fichero es la fuente de verdad. Se instala con:
 *
 *   cp scripts/puente/server.js /root/openclaw-webhook/server.js
 *   systemctl restart openclaw-webhook
 *
 * Config por entorno (`/root/openclaw-webhook/webhook.env`, cargado por la
 * unidad systemd):
 *   WEBHOOK_TOKEN   requerido. Debe coincidir con `NEXUS_WEBHOOK_TOKEN` de la
 *                   aplicación; si se rota aquí hay que rotarlo allí, o todo
 *                   responde 401.
 *   WEBHOOK_PORT    opcional, por defecto 9091.
 *   WA_ACCOUNT      opcional, por defecto "nexus".
 *   WA_TARGET       opcional, número E.164 de destino.
 *   QUEUE_DIR       opcional, por defecto ./queue.
 */

const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const { execFile } = require('child_process')

const PORT = Number(process.env.WEBHOOK_PORT || 9091)
const TOKEN = process.env.WEBHOOK_TOKEN || ''
const WA_ACCOUNT = process.env.WA_ACCOUNT || 'nexus'
const WA_TARGET = process.env.WA_TARGET || '593996691586'

// El shim `openclaw` es `#!/usr/bin/env node` y el PATH de systemd no resuelve
// a una versión de Node que esta release soporte, así que se invoca el punto de
// entrada con un binario explícito.
const NODE_BIN = process.env.OPENCLAW_NODE || process.execPath
const OPENCLAW_CLI =
  process.env.OPENCLAW_CLI ||
  '/root/.nvm/versions/node/v22.23.2/lib/node_modules/openclaw/dist/index.js'

const QUEUE_DIR = process.env.QUEUE_DIR || path.join(__dirname, 'queue')
const DEAD_DIR = path.join(QUEUE_DIR, 'dead')

const MAX_BODY_BYTES = 64 * 1024
const SEND_TIMEOUT_MS = Number(process.env.SEND_TIMEOUT_MS || 60_000)
const DRAIN_INTERVAL_MS = Number(process.env.DRAIN_INTERVAL_MS || 30_000)
const MAX_AGE_MS = Number(process.env.MAX_AGE_MS || 24 * 60 * 60 * 1000)

/** Espera antes del reintento número `n` (1 = primer reintento). */
const BACKOFF_MS = [30_000, 120_000, 300_000, 900_000, 1_800_000]
function esperaTrasIntento(intentos) {
  return BACKOFF_MS[intentos - 1] ?? 3_600_000
}

if (!TOKEN) {
  console.error('[bridge] WEBHOOK_TOKEN is not set; refusing to start.')
  console.error('[bridge] Set it in /root/openclaw-webhook/webhook.env')
  process.exit(1)
}

fs.mkdirSync(QUEUE_DIR, { recursive: true, mode: 0o700 })
fs.mkdirSync(DEAD_DIR, { recursive: true, mode: 0o700 })

const expectedToken = Buffer.from(TOKEN)

function tokenMatches(received) {
  const got = Buffer.from(received)
  if (got.length !== expectedToken.length) return false
  return crypto.timingSafeEqual(got, expectedToken)
}

function extractMessage(event, data) {
  if (data.resumen) return String(data.resumen)
  if (data.message) return String(data.message)
  return `[${event}] ${JSON.stringify(data).slice(0, 300)}`
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

// ---------------------------------------------------------------- cola

/**
 * Escribe un elemento de la cola de forma atómica y duradera.
 *
 * Se escribe a un temporal, se fuerza a disco con `fsync` y se renombra: así el
 * fichero definitivo nunca existe a medias, ni siquiera si la máquina se corta
 * entre medias. Sin el `fsync` el `rename` puede llegar al disco antes que el
 * contenido y quedaría un JSON truncado que el drenador no sabría leer.
 */
async function guardarItem(item) {
  const destino = path.join(QUEUE_DIR, `${item.id}.json`)
  const temporal = `${destino}.tmp`
  const fh = await fsp.open(temporal, 'w', 0o600)
  try {
    await fh.writeFile(JSON.stringify(item, null, 2))
    await fh.sync()
  } finally {
    await fh.close()
  }
  await fsp.rename(temporal, destino)
  return destino
}

async function borrarItem(id) {
  await fsp.rm(path.join(QUEUE_DIR, `${id}.json`), { force: true })
}

async function enterrarItem(item) {
  const origen = path.join(QUEUE_DIR, `${item.id}.json`)
  const destino = path.join(DEAD_DIR, `${item.id}.json`)
  try {
    await fsp.rename(origen, destino)
  } catch {
    await fsp.rm(origen, { force: true })
  }
  console.error(
    `[bridge] abandonado id=${item.id} intentos=${item.attempts} ` +
      `edad=${Math.round((Date.now() - Date.parse(item.createdAt)) / 60000)}min ` +
      `ultimo_error=${String(item.lastError).slice(0, 200)}`,
  )
}

async function leerCola() {
  let nombres
  try {
    nombres = await fsp.readdir(QUEUE_DIR)
  } catch {
    return []
  }

  const items = []
  for (const nombre of nombres) {
    if (!nombre.endsWith('.json')) continue
    try {
      const crudo = await fsp.readFile(path.join(QUEUE_DIR, nombre), 'utf8')
      items.push(JSON.parse(crudo))
    } catch (e) {
      // Un elemento ilegible no debe parar el drenaje del resto.
      console.error(`[bridge] elemento ilegible ${nombre}: ${e.message}`)
    }
  }
  // Orden de llegada: el más viejo primero, para no reordenar las alertas.
  return items.sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

// ---------------------------------------------------------------- envío

/**
 * Cerrojo de envío.
 *
 * OpenClaw tarda 10-20 s por mensaje y dos invocaciones a la vez compiten por
 * la misma sesión de WhatsApp. Las peticiones se encadenan sobre una promesa
 * en vez de solaparse.
 */
let cadenaDeEnvio = Promise.resolve()
function enSerie(tarea) {
  const resultado = cadenaDeEnvio.then(tarea, tarea)
  // La cadena solo marca el turno; un fallo no debe envenenar a los siguientes.
  cadenaDeEnvio = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

function invocarOpenclaw(mensaje) {
  return new Promise((resolve) => {
    execFile(
      NODE_BIN,
      [
        OPENCLAW_CLI,
        'message', 'send',
        '--channel', 'whatsapp',
        '--account', WA_ACCOUNT,
        '--target', WA_TARGET,
        '--message', mensaje,
      ],
      { timeout: SEND_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          const detalle = String(stderr || stdout || err.message).trim()
          resolve({ ok: false, error: detalle.slice(0, 500) })
          return
        }
        const salida = String(stdout)
        const id = salida.match(/Message ID:\s*(\S+)/)?.[1] ?? null
        resolve({ ok: true, messageId: id, salida: salida.trim().slice(0, 200) })
      },
    )
  })
}

const enviar = (mensaje) => enSerie(() => invocarOpenclaw(mensaje))

/**
 * Intenta enviar un elemento y actualiza su estado en la cola.
 *
 * Devuelve el resultado de OpenClaw. El elemento se borra si salió, y si no se
 * reprograma o se entierra, pero nunca desaparece en silencio.
 */
async function intentarItem(item) {
  const resultado = await enviar(item.message)

  if (resultado.ok) {
    await borrarItem(item.id)
    console.log(
      `[bridge] entregado id=${item.id} event=${item.event} ` +
        `intentos=${item.attempts + 1} messageId=${resultado.messageId ?? '-'}`,
    )
    return resultado
  }

  item.attempts += 1
  item.lastError = resultado.error
  item.lastAttemptAt = new Date().toISOString()

  const edad = Date.now() - Date.parse(item.createdAt)
  if (edad >= MAX_AGE_MS) {
    await enterrarItem(item)
    return resultado
  }

  item.nextAttemptAt = new Date(Date.now() + esperaTrasIntento(item.attempts)).toISOString()
  await guardarItem(item)
  console.error(
    `[bridge] fallo id=${item.id} intentos=${item.attempts} ` +
      `reintento=${item.nextAttemptAt} error=${String(resultado.error).slice(0, 200)}`,
  )
  return resultado
}

// ---------------------------------------------------------------- drenador

let drenando = false

async function drenar() {
  if (drenando) return
  drenando = true
  try {
    const ahora = Date.now()
    for (const item of await leerCola()) {
      const listo = !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= ahora
      if (!listo) continue
      await intentarItem(item)
    }
  } catch (e) {
    console.error(`[bridge] drenaje falló: ${e.message}`)
  } finally {
    drenando = false
  }
}

// ---------------------------------------------------------------- servidor

async function manejarEnvio(res, payload) {
  const { event = 'unknown', data = {} } = payload
  const message = extractMessage(event, data)

  const item = {
    id: `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
    event,
    message,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
    nextAttemptAt: null,
  }

  // Persistir ANTES de intentar. Si el proceso muere durante el envío, el
  // mensaje sigue en la cola y el drenador lo recoge al arrancar; como mucho se
  // duplica, que es preferible a perderlo.
  try {
    await guardarItem(item)
  } catch (e) {
    console.error(`[bridge] no se pudo encolar id=${item.id}: ${e.message}`)
    sendJson(res, 502, {
      ok: false,
      delivered: false,
      queued: false,
      error: `no se pudo persistir el mensaje: ${e.message}`,
    })
    return
  }

  console.log(`[bridge] recibido id=${item.id} event=${event} message_len=${message.length}`)

  const resultado = await intentarItem(item)

  if (resultado.ok) {
    sendJson(res, 200, {
      ok: true,
      delivered: true,
      id: item.id,
      messageId: resultado.messageId,
      attempts: item.attempts + 1,
    })
    return
  }

  // No salió. Si sigue en la cola se reintentará; si se abandonó por edad —solo
  // posible en un mensaje viejo reencolado— se dice que se perdió.
  const encolado = fs.existsSync(path.join(QUEUE_DIR, `${item.id}.json`))
  sendJson(res, encolado ? 202 : 502, {
    ok: encolado,
    delivered: false,
    queued: encolado,
    id: item.id,
    attempts: item.attempts,
    nextAttemptAt: item.nextAttemptAt,
    error: resultado.error,
  })
}

async function manejarEstado(res) {
  const pendientes = await leerCola()
  let muertos = []
  try {
    muertos = (await fsp.readdir(DEAD_DIR)).filter((n) => n.endsWith('.json'))
  } catch {
    muertos = []
  }

  sendJson(res, 200, {
    ok: true,
    account: WA_ACCOUNT,
    pending: pendientes.length,
    dead: muertos.length,
    oldestPending: pendientes[0]?.createdAt ?? null,
    items: pendientes.slice(0, 20).map((i) => ({
      id: i.id,
      event: i.event,
      createdAt: i.createdAt,
      attempts: i.attempts,
      nextAttemptAt: i.nextAttemptAt,
      lastError: i.lastError ? String(i.lastError).slice(0, 200) : null,
    })),
  })
}

const server = http.createServer((req, res) => {
  const auth = req.headers['authorization'] || ''
  const token = auth.replace(/^Bearer\s+/i, '')

  if (!tokenMatches(token)) {
    sendJson(res, 401, { error: 'Unauthorized' })
    return
  }

  if (req.method === 'GET' && req.url === '/webhook/liberty-trading/queue') {
    manejarEstado(res).catch((e) => {
      console.error(`[bridge] estado falló: ${e.message}`)
      sendJson(res, 500, { error: 'Internal Error' })
    })
    return
  }

  if (req.method !== 'POST' || req.url !== '/webhook/liberty-trading') {
    sendJson(res, 404, { error: 'Not Found' })
    return
  }

  let body = ''
  let bytes = 0
  let aborted = false

  req.on('data', (chunk) => {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) {
      aborted = true
      sendJson(res, 413, { error: 'Payload Too Large' })
      req.destroy()
      return
    }
    body += chunk
  })

  req.on('end', () => {
    if (aborted) return

    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' })
      return
    }

    manejarEnvio(res, payload).catch((e) => {
      console.error(`[bridge] manejo falló: ${e.message}`)
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal Error' })
    })
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[bridge] listening on 127.0.0.1:${PORT} account=${WA_ACCOUNT} queue=${QUEUE_DIR}`,
  )
  // Lo que quedó de la ejecución anterior se reintenta al arrancar.
  drenar()
})

const temporizador = setInterval(drenar, DRAIN_INTERVAL_MS)
temporizador.unref()

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[bridge] ${sig} received; shutting down`)
    clearInterval(temporizador)
    server.close(() => process.exit(0))
  })
}
