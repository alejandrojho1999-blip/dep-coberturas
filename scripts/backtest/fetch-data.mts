/**
 * Fase 1 — Descarga y caché de los datos crudos del backtest.
 *
 * Baja una sola vez, para los 750 tickers de los dos universos del screener:
 *   - fundamentales (`fundamentalsTimeSeries`, anual + trimestral)
 *   - precios diarios (`historical`) desde 2005
 * y los guarda en `data/backtest/`. Las fases siguientes leen de ahí: la
 * descarga no se repite en cada iteración del backtest.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/backtest/register-alias.mjs \
 *        scripts/backtest/fetch-data.mts [--solo=AAPL,MSFT] [--force]
 */
import { mkdir, writeFile, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import YahooFinance from 'yahoo-finance2'
import {
  SP500_NASDAQ100_TICKERS,
  SMALL_CAP_TICKERS,
} from '@/lib/peter-lynch/screener'
import {
  DATA_DIR, FUNDAMENTALS_DIR, PRICES_DIR, MANIFEST_PATH, SECTORS_PATH,
  PRICES_DESDE, BENCHMARK, BENCHMARK_POR_UNIVERSO,
} from '@/lib/backtest/config'

const BATCH_SIZE = 25
const PAUSA_MS = 400

const args = process.argv.slice(2)
const force = args.includes('--force')
const soloArg = args.find(a => a.startsWith('--solo='))?.split('=')[1]

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

interface ManifestEntry {
  ticker: string
  universo: 'large_cap' | 'small_cap' | 'benchmark'
  fundamentalsOk: boolean
  preciosOk: boolean
  nAnual: number
  nTrimestral: number
  nPrecios: number
  primerPrecio: string | null
  error: string | null
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Sector por ticker. Hace falta para el test de control: las carteras
 * aleatorias se emparejan por sector y decil de capitalización, si no la
 * comparación mide exposición sectorial en vez de calidad del filtro.
 * Se cachea aparte porque `fundamentalsTimeSeries` no lo devuelve.
 */
const sectores: Record<string, string> = {}

async function cargarSectoresCacheados(): Promise<void> {
  try {
    Object.assign(sectores, JSON.parse(await readFile(SECTORS_PATH, 'utf8')))
  } catch { /* primera ejecución */ }
}

async function descargarSector(ticker: string): Promise<void> {
  if (sectores[ticker]) return
  try {
    const r = await yf.quoteSummary(ticker, { modules: ['summaryProfile'] })
    sectores[ticker] = (r.summaryProfile?.sector as string | undefined) ?? '—'
  } catch {
    sectores[ticker] = '—'
  }
}

async function existe(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

async function descargar(ticker: string, universo: ManifestEntry['universo']): Promise<ManifestEntry> {
  const entry: ManifestEntry = {
    ticker, universo,
    fundamentalsOk: false, preciosOk: false,
    nAnual: 0, nTrimestral: 0, nPrecios: 0, primerPrecio: null, error: null,
  }

  const fPath = path.join(FUNDAMENTALS_DIR, `${ticker}.json`)
  const pPath = path.join(PRICES_DIR, `${ticker}.json`)

  // ── Fundamentales ────────────────────────────────────────────────────────
  try {
    if (!force && await existe(fPath)) {
      const cached = JSON.parse(await readFile(fPath, 'utf8'))
      entry.nAnual = cached.annual?.length ?? 0
      entry.nTrimestral = cached.quarterly?.length ?? 0
      entry.fundamentalsOk = entry.nAnual > 0
    } else if (universo !== 'benchmark') {
      const opts = { period1: '2005-01-01', period2: new Date(), module: 'all' as const }
      const [annual, quarterly] = await Promise.all([
        yf.fundamentalsTimeSeries(ticker, { ...opts, type: 'annual' }),
        yf.fundamentalsTimeSeries(ticker, { ...opts, type: 'quarterly' }),
      ])
      await writeFile(fPath, JSON.stringify({ ticker, annual, quarterly }))
      entry.nAnual = annual.length
      entry.nTrimestral = quarterly.length
      entry.fundamentalsOk = annual.length > 0
    }
  } catch (e) {
    entry.error = `fundamentals: ${(e as Error).message}`
  }

  // ── Precios ──────────────────────────────────────────────────────────────
  try {
    // Un fichero cacheado sin `splits` es de una versión anterior del script:
    // se vuelve a bajar, porque sin los splits la capitalización histórica sale mal.
    const cacheValida = !force && await existe(pPath)
      ? JSON.parse(await readFile(pPath, 'utf8'))
      : null

    if (cacheValida?.splits !== undefined) {
      entry.nPrecios = cacheValida.rows?.length ?? 0
      entry.primerPrecio = cacheValida.rows?.[0]?.date ?? null
      entry.preciosOk = entry.nPrecios > 0
    } else {
      // `historical()` está deprecado y Yahoo retiró su API; `chart()` es el
      // reemplazo oficial y además trae `adjclose` (dividendos + splits).
      const chart = await yf.chart(ticker, {
        period1: PRICES_DESDE, period2: new Date(), interval: '1d',
        events: 'split',
      })

      const rows = chart.quotes
        .filter(r => r.close != null)
        .map(r => ({
          date: new Date(r.date).toISOString().slice(0, 10),
          close: r.close as number,
          adjClose: r.adjclose ?? (r.close as number),
          volume: r.volume ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Los splits hacen falta para reexpresar el nº de acciones reportado en
      // un ejercicio antiguo a la base en la que Yahoo devuelve los precios
      // (que están ajustados retroactivamente por split).
      const splits = (chart.events?.splits ?? []).map(s => ({
        date: new Date(s.date).toISOString().slice(0, 10),
        factor: s.numerator / s.denominator,
      })).sort((a, b) => a.date.localeCompare(b.date))

      await writeFile(pPath, JSON.stringify({ ticker, rows, splits }))
      entry.nPrecios = rows.length
      entry.primerPrecio = rows[0]?.date ?? null
      entry.preciosOk = rows.length > 0
    }
  } catch (e) {
    entry.error = [entry.error, `precios: ${(e as Error).message}`].filter(Boolean).join(' | ')
  }

  if (universo !== 'benchmark') await descargarSector(ticker)

  return entry
}

async function main(): Promise<void> {
  await mkdir(FUNDAMENTALS_DIR, { recursive: true })
  await mkdir(PRICES_DIR, { recursive: true })
  await cargarSectoresCacheados()

  const large = [...new Set(SP500_NASDAQ100_TICKERS)]
  const small = [...new Set(SMALL_CAP_TICKERS)]

  const benchmarks = [...new Set([BENCHMARK, ...Object.values(BENCHMARK_POR_UNIVERSO)])]

  let cola: Array<{ ticker: string; universo: ManifestEntry['universo'] }> = [
    ...benchmarks.map(t => ({ ticker: t, universo: 'benchmark' as const })),
    ...large.map(t => ({ ticker: t, universo: 'large_cap' as const })),
    // Un ticker en ambos universos (FFIN, HWC) se descarga una sola vez.
    ...small.filter(t => !large.includes(t)).map(t => ({ ticker: t, universo: 'small_cap' as const })),
  ]

  if (soloArg) {
    const filtro = new Set(soloArg.split(',').map(t => t.trim().toUpperCase()))
    cola = cola.filter(c => filtro.has(c.ticker))
  }

  console.log(`[fetch] ${cola.length} tickers · lotes de ${BATCH_SIZE}${force ? ' · --force' : ''}`)

  const manifest: ManifestEntry[] = []
  for (let i = 0; i < cola.length; i += BATCH_SIZE) {
    const lote = cola.slice(i, i + BATCH_SIZE)
    const res = await Promise.all(lote.map(c => descargar(c.ticker, c.universo)))
    manifest.push(...res)
    const ok = manifest.filter(m => m.preciosOk).length
    console.log(`[fetch] ${Math.min(i + BATCH_SIZE, cola.length)}/${cola.length} · con precios: ${ok}`)
    if (i + BATCH_SIZE < cola.length) await sleep(PAUSA_MS)
  }

  // El nº de tickers que ya no cotizan es la cota inferior del sesgo de
  // supervivencia: los universos están hardcodeados con la composición de hoy.

  const resumen = recalcular(manifest)

  // Con `--solo` esta corrida ve una porción del universo: fusionar en vez de
  // sobrescribir, o el manifest perdería el recuento de tickers delisted del
  // que sale la cota de sesgo de supervivencia.
  if (soloArg) {
    const previo = await leerManifest()
    const porTicker = new Map<string, ManifestEntry>(
      [...(previo?.entradas ?? []), ...manifest].map(e => [e.ticker, e]),
    )
    const fusionadas = [...porTicker.values()]
    await writeFile(MANIFEST_PATH, JSON.stringify(recalcular(fusionadas), null, 2))
  } else {
    await writeFile(MANIFEST_PATH, JSON.stringify(resumen, null, 2))
  }
  await writeFile(SECTORS_PATH, JSON.stringify(sectores, null, 2))

  console.log(`\n[fetch] listo → ${path.relative(process.cwd(), DATA_DIR)}`)
  console.log(`[fetch] sin precios (delisted/renombrados): ${resumen.sinPrecios.length} → ${resumen.sinPrecios.join(', ') || '—'}`)
  console.log(`[fetch] sin fundamentales: ${resumen.sinFundamentales.length}`)
  console.log(`[fetch] profundidad anual: mediana ${resumen.medianaEjerciciosAnuales}, máx ${resumen.maxEjerciciosAnuales} ejercicios`)
  console.log(`[fetch] sectores conocidos: ${Object.values(sectores).filter(v => v !== '—').length}/${Object.keys(sectores).length}`)
}

interface Manifest {
  generado: string
  total: number
  conPrecios: number
  sinPrecios: string[]
  sinFundamentales: string[]
  medianaEjerciciosAnuales: number
  maxEjerciciosAnuales: number
  entradas: ManifestEntry[]
}

/** Agrega las entradas en el resumen que consume el backtest. */
function recalcular(entradas: ManifestEntry[]): Manifest {
  const sinPrecios = entradas.filter(m => !m.preciosOk).map(m => m.ticker)
  const profundidad = entradas.filter(m => m.nAnual > 0).map(m => m.nAnual)
  return {
    generado: new Date().toISOString(),
    total: entradas.length,
    conPrecios: entradas.length - sinPrecios.length,
    sinPrecios,
    sinFundamentales: entradas
      .filter(m => m.universo !== 'benchmark' && !m.fundamentalsOk)
      .map(m => m.ticker),
    medianaEjerciciosAnuales: mediana(profundidad),
    maxEjerciciosAnuales: profundidad.length ? Math.max(...profundidad) : 0,
    entradas,
  }
}

async function leerManifest(): Promise<Manifest | null> {
  try { return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) } catch { return null }
}

function mediana(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

main().catch((e) => { console.error(e); process.exit(1) })
