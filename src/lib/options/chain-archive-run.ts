/**
 * Descarga y archiva las cadenas de opciones del universo de los agentes.
 *
 * Separado de `chain-archive.ts` —que es puro— porque aquí sí hay red y base de
 * datos. Lo llama el cron; no hay versión con sesión de usuario porque esto no
 * es una acción que nadie deba disparar a mano desde la interfaz.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchYahooOptionsAnalysis } from './yahoo-options'
import { prepararSnapshot, bytesAproximados, type SnapshotCadena } from './chain-archive'

/**
 * Universo a archivar: los subyacentes que miran Gamma y Theta.
 *
 * Se declara aquí en vez de importarlo de `lib/backtest/opciones/config.ts`
 * porque aquel es código de análisis que no debe entrar en el bundle del
 * servidor de producción. Si las dos listas divergen, el archivo dejaría de
 * cubrir a un agente en silencio: hay un test que las compara.
 */
export const UNIVERSO_ARCHIVO = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD',
  'NFLX', 'COIN', 'PLTR', 'SOFI', 'F', 'BAC', 'JPM', 'WFC', 'XOM', 'CVX',
  'GLD', 'SLV', 'TLT', 'XLE', 'XLF', 'XLK', 'ARKK',
  'ROKU', 'SNAP', 'UBER', 'DASH', 'HOOD', 'RIVN', 'LCID', 'MSTR', 'IONQ',
] as const

/** Peticiones simultáneas a Yahoo. Más agresivo devuelve 429. */
const LOTE = 4
const PAUSA_MS = 600
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export interface ResultadoArchivo {
  fecha: string
  archivados: number
  contratos: number
  bytes: number
  vacios: string[]
  fallidos: Array<{ ticker: string; error: string }>
  log: string[]
}

/**
 * Captura la cadena de un ticker y la deja lista para guardar.
 *
 * Devuelve `null` sin ruido cuando no hay nada archivable: eso lo decide
 * `prepararSnapshot`, que ya distingue entre «no había contratos útiles» y «los
 * datos venían rotos».
 */
async function capturar(ticker: string, fecha: string): Promise<SnapshotCadena | null> {
  const d = await fetchYahooOptionsAnalysis(ticker)
  return prepararSnapshot({
    fecha,
    ticker,
    spot: d.underlyingPrice,
    contratos: [...d.calls, ...d.puts],
  })
}

/**
 * Archiva el universo entero para una fecha de mercado.
 *
 * Se escribe con `upsert` sobre la clave (fecha, ticker) para que repetir la
 * ejecución del día sobrescriba en vez de acumular duplicados: el cron puede
 * dispararse dos veces y un recuento falseado sería peor que un dato ausente.
 */
export async function archivarCadenas(
  supabase: SupabaseClient,
  fecha: string,
  universo: readonly string[] = UNIVERSO_ARCHIVO,
): Promise<ResultadoArchivo> {
  const log: string[] = []
  const vacios: string[] = []
  const fallidos: ResultadoArchivo['fallidos'] = []
  let archivados = 0
  let contratos = 0
  let bytes = 0

  for (let i = 0; i < universo.length; i += LOTE) {
    const lote = universo.slice(i, i + LOTE)
    const capturas = await Promise.all(
      lote.map(async t => {
        try {
          return { ticker: t, snapshot: await capturar(t, fecha), error: null as string | null }
        } catch (e) {
          return { ticker: t, snapshot: null, error: e instanceof Error ? e.message : String(e) }
        }
      }),
    )

    const filas: SnapshotCadena[] = []
    for (const c of capturas) {
      if (c.error) {
        fallidos.push({ ticker: c.ticker, error: c.error })
        continue
      }
      if (!c.snapshot) {
        vacios.push(c.ticker)
        continue
      }
      filas.push(c.snapshot)
    }

    if (filas.length) {
      const { error } = await supabase
        .from('options_chain_snapshots')
        .upsert(filas, { onConflict: 'fecha,ticker' })

      if (error) {
        // El lote entero se marca fallido: sin saber cuáles entraron, contarlos
        // como archivados haría creer que hay datos que quizá no están.
        for (const f of filas) fallidos.push({ ticker: f.ticker, error: error.message })
      } else {
        for (const f of filas) {
          archivados++
          contratos += f.n_contratos
          bytes += bytesAproximados(f)
        }
      }
    }

    if (i + LOTE < universo.length) await sleep(PAUSA_MS)
  }

  log.push(`✓ ${archivados}/${universo.length} cadenas archivadas · ${contratos.toLocaleString('es-ES')} contratos · ${(bytes / 1024).toFixed(0)} kB`)
  if (vacios.length) log.push(`· sin contratos utilizables: ${vacios.join(', ')}`)
  if (fallidos.length) log.push(`✗ fallidos: ${fallidos.map(f => f.ticker).join(', ')}`)

  return { fecha, archivados, contratos, bytes, vacios, fallidos, log }
}
