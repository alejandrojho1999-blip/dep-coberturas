import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BacktestCartera, BacktestEstrategia } from './types'

/**
 * Lectura de los JSON precalculados.
 *
 * Los ficheros viven en `public/estrategias/data/` y los genera
 * `scripts/build-estrategias.mjs`. Se leen del disco en el servidor en vez de
 * importarlos como módulos para que un cambio en los datos no obligue a
 * recompilar, y para que el bundle del cliente no cargue las curvas enteras.
 *
 * Las páginas que los consumen son estáticas, así que esta lectura ocurre una
 * sola vez en build.
 */

const DIRECTORIO = join(process.cwd(), 'public/estrategias/data')

async function leerJson<T>(archivo: string): Promise<T | null> {
  try {
    const crudo = await readFile(join(DIRECTORIO, archivo), 'utf8')
    return JSON.parse(crudo) as T
  } catch {
    // Falta el JSON: la sección se degrada a solo contenido curado en vez de
    // romper la página entera.
    return null
  }
}

export function backtestDe(slug: string): Promise<BacktestEstrategia | null> {
  return leerJson<BacktestEstrategia>(`${slug}.json`)
}

export function backtestCartera(): Promise<BacktestCartera | null> {
  return leerJson<BacktestCartera>('cartera.json')
}

/** Resumen de las seis, para la tabla comparativa del índice. */
export async function resumenTodas() {
  const { SLUGS } = await import('./catalogo')
  const cargados = await Promise.all(SLUGS.map(slug => backtestDe(slug)))
  return Object.fromEntries(
    SLUGS.map((slug, i) => [slug, cargados[i]])
  ) as Record<string, BacktestEstrategia | null>
}

/** Qué piezas del expediente están realmente en el repo. */
export interface DocumentosDisponibles {
  tesis: boolean
  wfo: boolean
  trades: boolean
  infografia: boolean
  codigo: boolean
}

async function existe(ruta: string): Promise<boolean> {
  try {
    await access(join(process.cwd(), 'public', ruta))
    return true
  } catch {
    return false
  }
}

/**
 * Comprueba el expediente antes de pintarlo.
 *
 * Los documentos se copian de Drive a mano, así que puede faltar alguno. Es
 * preferible no ofrecer el enlace a que el usuario se encuentre un 404.
 */
export async function documentosDe(slug: string): Promise<DocumentosDisponibles> {
  const [tesis, wfo, trades, infografia, codigo] = await Promise.all([
    existe(`estrategias/docs/${slug}-tesis.pdf`),
    existe(`estrategias/docs/${slug}-wfo.xlsx`),
    existe(`estrategias/docs/${slug}-trades.csv`),
    existe(`estrategias/img/${slug}-infografia.png`),
    existe(`estrategias/code/${slug}.cs`),
  ])
  return { tesis, wfo, trades, infografia, codigo }
}
