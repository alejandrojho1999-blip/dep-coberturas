/**
 * Qué hizo el precio después de cada evento del corpus.
 *
 * Descarga el histórico diario de los activos vigilados y, para cada evento,
 * calcula el retorno a +1, +3 y +5 sesiones desde el cierre previo al hecho.
 * Guarda además el **extremo** de la ventana, no solo el cierre final: igual que
 * en `src/lib/pulso/labels.ts`, lo que importa es si hubo susto en algún
 * momento, no si el viernes ya se había deshecho.
 *
 * La caché en disco no es un lujo: Yahoo devuelve 429 con facilidad y sin ella
 * cada reejecución vuelve a pedirlo todo. El fichero se reutiliza mientras
 * cubra el rango pedido.
 *
 * Uso:
 *   npm run calibracion:medir            # mide y escribe el JSON de resultados
 *   npm run calibracion:medir -- --json  # además vuelca la tabla completa
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import YahooFinance from 'yahoo-finance2'
import { EVENTOS, TICKERS_MEDIDOS, type EventoHistorico } from './eventos.ts'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const CACHE_DIR = 'scratchpad/calibracion/precios'
const SALIDA = 'scratchpad/calibracion/movimientos.json'
const VENTANAS = [1, 3, 5] as const
const DESDE = '2001-06-01'

interface Cierre { date: string; close: number; high: number; low: number }

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

function rutaCache(ticker: string): string {
  return `${CACHE_DIR}/${ticker.replace(/[^A-Za-z0-9]/g, '_')}.json`
}

/**
 * Histórico diario, de la caché si está y de Yahoo si no.
 *
 * Reintenta con espera creciente porque el 429 es la respuesta habitual cuando
 * se piden ocho símbolos seguidos.
 */
async function historico(ticker: string): Promise<Cierre[]> {
  const ruta = rutaCache(ticker)
  if (existsSync(ruta)) {
    return JSON.parse(readFileSync(ruta, 'utf8')) as Cierre[]
  }

  let ultimoError: unknown = null
  for (let intento = 0; intento < 4; intento++) {
    try {
      const filas = await yf.chart(ticker, {
        period1: DESDE,
        period2: new Date(),
        interval: '1d',
      })
      const cierres: Cierre[] = (filas.quotes ?? [])
        .filter((q) => q.close != null && q.high != null && q.low != null)
        .map((q) => ({
          date: new Date(q.date).toISOString().slice(0, 10),
          close: Number(q.close),
          high: Number(q.high),
          low: Number(q.low),
        }))

      mkdirSync(dirname(ruta), { recursive: true })
      writeFileSync(ruta, JSON.stringify(cierres))
      console.log(`  ${ticker.padEnd(10)} ${cierres.length} sesiones (${cierres[0]?.date} → ${cierres.at(-1)?.date})`)
      return cierres
    } catch (e) {
      ultimoError = e
      const espera = 2000 * (intento + 1)
      console.log(`  ${ticker.padEnd(10)} reintento en ${espera / 1000}s (${(e as Error).message.slice(0, 60)})`)
      await dormir(espera)
    }
  }
  console.log(`  ${ticker.padEnd(10)} SIN DATOS: ${(ultimoError as Error)?.message?.slice(0, 80)}`)
  return []
}

export interface Movimiento {
  ticker: string
  ventana: number
  /** Retorno de cierre a cierre, en tanto por uno. */
  retorno: number
  /** Mayor desplazamiento absoluto alcanzado dentro de la ventana. */
  extremo: number
  sesionBase: string
}

/**
 * Índice de la última sesión con cotización en o antes de la fecha del evento.
 *
 * Se toma la sesión **anterior** al hecho como base: si la noticia sale un
 * martes por la mañana, el cierre del martes ya la incorpora, y medir desde ahí
 * escondería justo el movimiento que se quiere ver.
 */
function sesionBase(cierres: Cierre[], fecha: string): number {
  let i = cierres.findIndex((c) => c.date >= fecha)
  if (i === -1) return -1
  // Si la fecha exacta cotiza, la base es la sesión previa.
  if (cierres[i].date === fecha) i -= 1
  else i -= 1
  return i
}

function medirEvento(cierres: Cierre[], ticker: string, evento: EventoHistorico): Movimiento[] {
  const base = sesionBase(cierres, evento.fecha)
  if (base < 0 || base >= cierres.length - 1) return []

  const precioBase = cierres[base].close
  const salida: Movimiento[] = []

  for (const v of VENTANAS) {
    const ventana = cierres.slice(base + 1, base + 1 + v)
    if (ventana.length < v) continue

    const retorno = ventana.at(-1)!.close / precioBase - 1
    const extremos = ventana.flatMap((c) => [c.high / precioBase - 1, c.low / precioBase - 1])
    const extremo = extremos.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0)

    salida.push({
      ticker,
      ventana: v,
      retorno: Number(retorno.toFixed(5)),
      extremo: Number(extremo.toFixed(5)),
      sesionBase: cierres[base].date,
    })
  }

  return salida
}

function pct(x: number): string {
  const s = (x * 100).toFixed(1)
  return `${x >= 0 ? '+' : ''}${s}%`
}

async function main(): Promise<void> {
  console.log('\nDESCARGA DE HISTÓRICOS')
  const series = new Map<string, Cierre[]>()
  for (const t of TICKERS_MEDIDOS) {
    series.set(t, await historico(t))
    await dormir(1500)
  }

  console.log('\nMEDICIÓN POR EVENTO')
  const resultados: Array<{ evento: EventoHistorico; movimientos: Movimiento[] }> = []

  for (const evento of EVENTOS) {
    const movimientos: Movimiento[] = []
    for (const t of TICKERS_MEDIDOS) {
      const cierres = series.get(t) ?? []
      if (cierres.length) movimientos.push(...medirEvento(cierres, t, evento))
    }
    resultados.push({ evento, movimientos })

    const oro = movimientos.find((m) => m.ticker === 'GC=F' && m.ventana === 5)
    const vix = movimientos.find((m) => m.ticker === '^VIX' && m.ventana === 5)
    const spx = movimientos.find((m) => m.ticker === 'ES=F' && m.ventana === 5)
    console.log(
      `  ${evento.fecha}  [${evento.severidad}] ${evento.clase.padEnd(22)}`
      + ` oro ${(oro ? pct(oro.retorno) : '  n/d').padStart(7)}`
      + ` · vix ${(vix ? pct(vix.extremo) : '  n/d').padStart(8)}`
      + ` · sp ${(spx ? pct(spx.retorno) : '  n/d').padStart(7)}`
      + `  ${evento.titulo.slice(0, 52)}`,
    )
  }

  mkdirSync(dirname(SALIDA), { recursive: true })
  writeFileSync(SALIDA, JSON.stringify(resultados, null, 1))
  console.log(`\nEscrito ${SALIDA} con ${resultados.length} eventos.\n`)
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
