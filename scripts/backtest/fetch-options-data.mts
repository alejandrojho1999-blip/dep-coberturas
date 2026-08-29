/**
 * Fase 1 del backtest de opciones — descarga y cachea lo que hace falta.
 *
 * Uso:
 *   npm run backtest:fetch-opciones
 *   npm run backtest:fetch-opciones -- --force     (reescribe lo ya cacheado)
 *
 * Baja tres cosas a `data/backtest/opciones/`:
 *
 *   · Los subyacentes de Gamma y Theta, 21 años de cierres diarios. Parte ya
 *     está en el caché de acciones, pero no toda: del universo de Theta faltan
 *     16 tickers que ningún agente de acciones mira.
 *   · Los índices de volatilidad (^VIX, ^VXN) y el tipo sin riesgo (^IRX).
 *   · `^PUT`, el CBOE S&P 500 PutWrite Index, que es la diana contra la que se
 *     calibra el modelo de volatilidad. Sin él, el supuesto de IV sería una
 *     elección arbitraria en vez de un parámetro ajustado.
 *
 * Aquí no se calcula nada: solo se trae y se guarda tal cual llega.
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import YahooFinance from 'yahoo-finance2'
import { DIR_OPCIONES, UNIVERSO_OPCIONES, SERIES_AUXILIARES, DESDE } from '@/lib/backtest/opciones/config'

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const args = process.argv.slice(2)
const force = args.includes('--force')

const LOTE = 10
const PAUSA_MS = 400
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const MANIFEST = path.join(DIR_OPCIONES, '_manifest.json')

interface Fila {
  date: string
  close: number
  adjClose: number
  volume: number
}

interface EntradaManifest {
  ticker: string
  papel: 'subyacente' | 'auxiliar'
  ok: boolean
  n: number
  desde: string | null
  hasta: string | null
  error: string | null
}

async function existe(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

/**
 * Descarga una serie diaria.
 *
 * Los índices (`^VIX`, `^IRX`, `^PUT`) no reparten dividendos ni se dividen, así
 * que su `adjClose` coincide con el cierre; se guarda igual para que todas las
 * series tengan la misma forma y el lector no tenga que recordar cuáles son
 * índices.
 */
async function descargar(ticker: string, papel: EntradaManifest['papel']): Promise<EntradaManifest> {
  const entrada: EntradaManifest = {
    ticker, papel, ok: false, n: 0, desde: null, hasta: null, error: null,
  }
  const destino = path.join(DIR_OPCIONES, `${ticker.replace('^', '_')}.json`)

  if (!force && await existe(destino)) {
    try {
      const cacheado = JSON.parse(await readFile(destino, 'utf8')) as { rows: Fila[] }
      entrada.ok = true
      entrada.n = cacheado.rows.length
      entrada.desde = cacheado.rows[0]?.date ?? null
      entrada.hasta = cacheado.rows.at(-1)?.date ?? null
      return entrada
    } catch { /* caché corrupto: se vuelve a bajar */ }
  }

  try {
    const chart = await yf.chart(ticker, {
      period1: DESDE, period2: new Date(), interval: '1d',
    })

    const rows: Fila[] = chart.quotes
      .filter(r => r.close != null)
      .map(r => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        close: r.close as number,
        adjClose: r.adjclose ?? (r.close as number),
        volume: r.volume ?? 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (!rows.length) throw new Error('sin cotizaciones')

    await writeFile(destino, JSON.stringify({ ticker, rows }))
    entrada.ok = true
    entrada.n = rows.length
    entrada.desde = rows[0].date
    entrada.hasta = rows.at(-1)!.date
  } catch (e) {
    entrada.error = e instanceof Error ? e.message : String(e)
  }

  return entrada
}

async function main() {
  await mkdir(DIR_OPCIONES, { recursive: true })

  const cola: Array<{ ticker: string; papel: EntradaManifest['papel'] }> = [
    ...UNIVERSO_OPCIONES.map(t => ({ ticker: t, papel: 'subyacente' as const })),
    ...Object.values(SERIES_AUXILIARES).map(t => ({ ticker: t, papel: 'auxiliar' as const })),
  ]
  // SPY aparece como subyacente de Theta y como benchmark de Gamma.
  const vistos = new Set<string>()
  const unicos = cola.filter(c => !vistos.has(c.ticker) && vistos.add(c.ticker))

  console.log(`Descargando ${unicos.length} series desde ${DESDE}…\n`)

  const manifest: EntradaManifest[] = []
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE)
    const res = await Promise.all(lote.map(c => descargar(c.ticker, c.papel)))
    for (const r of res) {
      const estado = r.ok ? '·' : '✗'
      const detalle = r.ok
        ? `${String(r.n).padStart(5)} sesiones  ${r.desde} → ${r.hasta}`
        : `ERROR ${r.error}`
      console.log(`${estado} ${r.ticker.padEnd(7)} ${detalle}`)
    }
    manifest.push(...res)
    if (i + LOTE < unicos.length) await sleep(PAUSA_MS)
  }

  await writeFile(MANIFEST, JSON.stringify({
    generado: new Date().toISOString(),
    desde: DESDE,
    series: manifest,
  }, null, 2))

  const fallidas = manifest.filter(m => !m.ok)
  const corta = manifest.filter(m => m.ok && m.n < 500)

  console.log(`\n✓ ${manifest.length - fallidas.length}/${manifest.length} series en ${DIR_OPCIONES}`)
  if (corta.length) {
    // No es un fallo: HOOD cotiza desde 2021 y ARKK desde 2014. El panel debe
    // tratarlas como ausentes antes de su primera sesión, nunca como precio 0.
    console.log(`\n  Series con menos de 500 sesiones (histórico corto, no es un error):`)
    for (const c of corta) console.log(`    ${c.ticker.padEnd(7)} ${c.n} desde ${c.desde}`)
  }
  if (fallidas.length) {
    console.log(`\n  ✗ Fallidas: ${fallidas.map(f => f.ticker).join(', ')}`)
    process.exitCode = 1
  }
}

main().catch(e => { console.error(e); process.exit(1) })
