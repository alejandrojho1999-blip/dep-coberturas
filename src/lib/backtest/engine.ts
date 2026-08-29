/**
 * Fase 3 — Motor de backtest.
 *
 * Replica la cascada de los agentes Peter y Small sobre el panel
 * point-in-time, con **los mismos umbrales que producción**:
 *
 *   paso 1  screener Lynch          → `evaluarCriterios` (src/lib/peter-lynch/screener.ts)
 *   paso 2  proyección 30 sesiones  → `computeForecast`  (src/lib/agentes/signals.ts)
 *   paso 3  momentum RSI/MACD/vol   → `computeMomentum`  (src/lib/agentes/signals.ts)
 *   paso 4  confirmación LLM        → NO reproducible históricamente, se omite
 *
 * Venta: `failCount >= 2` de 3, igual que `AgentePeter.tsx` / `AgenteSmall.tsx`.
 */
import {
  evaluarCriterios, contarScore,
  LARGE_CAP_OPTIONS, SMALL_CAP_OPTIONS,
  type ScreenerOptions, type ScreenerCriteria,
} from '@/lib/peter-lynch/screener'
import {
  computeForecast, computeMomentum,
  FORECAST_LOOKBACK_DIAS, MOMENTUM_LOOKBACK_DIAS,
} from '@/lib/agentes/signals'
import { COSTE_TRANSACCION_BPS, HOLDING_MAX_MESES } from '@/lib/backtest/config'
import { indiceEn, sumarDias } from '@/lib/backtest/panel'
import type {
  Operacion, Panel, PanelRow, PriceSeries, PuntoCurva, Universo,
} from '@/lib/backtest/types'

/** Criterios que solo existen vía proxy (sin histórico de consenso). */
export const CRITERIOS_PROXY = ['pe_proyectado', 'peg'] as const
export const CRITERIOS_TODOS = [
  'pe_historico', 'pe_proyectado', 'deuda_capital',
  'crecimiento_eps', 'peg', 'market_cap',
] as const
export type NombreCriterio = typeof CRITERIOS_TODOS[number]

export type Capas = 'lynch' | 'lynch+tecnico' | 'tecnico'
export type Pesos = 'equal' | 'cap'

export interface OpcionesSimulacion {
  universo: Universo
  /** Umbrales del screener; por defecto los de producción. */
  opts?: ScreenerOptions
  /** Criterios activos. Excluir los proxy responde "¿el alfa depende del proxy?". */
  criterios?: readonly NombreCriterio[]
  /** Qué capas de la cascada se aplican. */
  capas?: Capas
  pesos?: Pesos
  /** Coste de ida y vuelta en pb. 0 para medir el bruto. */
  costeBps?: number
  /** Fuerza el corte de score; por defecto el de producción del universo. */
  corteScore?: number
  /**
   * Sustituye el filtro por una selección arbitraria: es el gancho del test de
   * control (carteras aleatorias emparejadas por sector y tamaño). Cuando está
   * presente, la venta por señal se desactiva y solo actúa el tope temporal.
   */
  aleatorio?: { elegir: (filas: PanelRow[], fecha: string) => string[] }
}

export interface ResultadoSimulacion {
  curva: PuntoCurva[]
  operaciones: Operacion[]
  /** Nº de posiciones abiertas en cada fecha de rebalanceo. */
  posicionesPorFecha: Array<{ fecha: string; n: number }>
  /** Retornos entre fechas de rebalanceo consecutivas (fracción). */
  retornos: Array<{ fecha: string; retorno: number }>
}

/** Corte de admisión de producción: Peter exige 6/6, Small 4/6. */
export function corteDeProduccion(universo: Universo, nCriterios: number): number {
  return universo === 'small_cap'
    ? Math.ceil((4 / 6) * nCriterios)
    : nCriterios
}

export function opcionesDe(universo: Universo): ScreenerOptions {
  return universo === 'small_cap' ? SMALL_CAP_OPTIONS : LARGE_CAP_OPTIONS
}

/** Criterios restringidos al subconjunto activo, para poder puntuar sobre n<6. */
export function evaluarSubconjunto(
  fila: PanelRow,
  opts: ScreenerOptions,
  criterios: readonly NombreCriterio[],
): { criteria: ScreenerCriteria; score: number } {
  const criteria = evaluarCriterios(
    {
      trailingPE: fila.trailingPE,
      forwardPE: fila.forwardPE,
      debtToEquity: fila.debtToEquity,
      earningsGrowth: fila.earningsGrowth,
      pegRatio: fila.pegRatio,
      marketCap: fila.marketCap,
    },
    opts,
  )
  const activos = new Set<string>(criterios)
  const score = criterios.length === CRITERIOS_TODOS.length
    ? contarScore(criteria)
    : Object.entries(criteria).filter(([k, v]) => activos.has(k) && v).length
  return { criteria, score }
}

// ── Señales técnicas sobre el histórico ─────────────────────────────────────

function ventana(
  serie: PriceSeries, fecha: string, diasNaturales: number,
): { closes: number[]; volumes: number[] } {
  const fin = indiceEn(serie.rows, fecha)
  if (fin < 0) return { closes: [], volumes: [] }
  const desde = sumarDias(fecha, -diasNaturales)
  let ini = fin
  while (ini > 0 && serie.rows[ini - 1].date >= desde) ini--
  const trozo = serie.rows.slice(ini, fin + 1)
  return { closes: trozo.map(r => r.close), volumes: trozo.map(r => r.volume) }
}

export function pasaForecast(serie: PriceSeries, fecha: string): boolean | null {
  const { closes } = ventana(serie, fecha, FORECAST_LOOKBACK_DIAS)
  return computeForecast(closes)?.pass ?? null
}

export function pasaMomentum(serie: PriceSeries, fecha: string): boolean | null {
  const { closes, volumes } = ventana(serie, fecha, MOMENTUM_LOOKBACK_DIAS)
  return computeMomentum(closes, volumes)?.pass ?? null
}

// ── Simulación ──────────────────────────────────────────────────────────────

interface Posicion {
  ticker: string
  fechaEntrada: string
  precioEntrada: number
  adjEntrada: number
  scoreEntrada: number
  criteriosEntrada: ScreenerCriteria
  marketCapEntrada: number | null
}

/**
 * Recorre las fechas de rebalanceo abriendo y cerrando posiciones según los
 * filtros, y devuelve la curva de valor de una cartera de peso igual (o
 * ponderada por capitalización) reajustada en cada fecha.
 */
export function simular(
  panel: Panel,
  series: Map<string, PriceSeries>,
  o: OpcionesSimulacion,
): ResultadoSimulacion {
  const opts = o.opts ?? opcionesDe(o.universo)
  const criterios = o.criterios ?? CRITERIOS_TODOS
  const capas = o.capas ?? 'lynch+tecnico'
  const pesos = o.pesos ?? 'equal'
  const costeBps = o.costeBps ?? COSTE_TRANSACCION_BPS
  const corte = o.corteScore ?? corteDeProduccion(o.universo, criterios.length)

  const abiertas = new Map<string, Posicion>()
  const operaciones: Operacion[] = []
  const curva: PuntoCurva[] = []
  const retornos: ResultadoSimulacion['retornos'] = []
  const posicionesPorFecha: ResultadoSimulacion['posicionesPorFecha'] = []

  let valor = 1
  // La mitad del coste de ida y vuelta se imputa en cada extremo de la operación.
  const costeUnLado = costeBps / 2 / 10_000

  for (let i = 0; i < panel.fechas.length; i++) {
    const fecha = panel.fechas[i]
    const filas = panel.porFecha.get(fecha) ?? []
    const porTicker = new Map(filas.map(f => [f.ticker, f]))

    // ── Quién pasa hoy los filtros ──────────────────────────────────────────
    const lynchOk = new Set<string>()
    const scores = new Map<string, { score: number; criteria: ScreenerCriteria }>()
    for (const fila of filas) {
      const r = evaluarSubconjunto(fila, opts, criterios)
      scores.set(fila.ticker, r)
      if (r.score >= corte) lynchOk.add(fila.ticker)
    }

    const cacheForecast = new Map<string, boolean | null>()
    const cacheMomentum = new Map<string, boolean | null>()
    const fc = (t: string) => {
      if (!cacheForecast.has(t)) {
        const s = series.get(t)
        cacheForecast.set(t, s ? pasaForecast(s, fecha) : null)
      }
      return cacheForecast.get(t)!
    }
    const mm = (t: string) => {
      if (!cacheMomentum.has(t)) {
        const s = series.get(t)
        cacheMomentum.set(t, s ? pasaMomentum(s, fecha) : null)
      }
      return cacheMomentum.get(t)!
    }

    let candidatos: string[]
    if (o.aleatorio) {
      candidatos = o.aleatorio.elegir(filas, fecha)
    } else {
      const base = capas === 'tecnico' ? filas.map(f => f.ticker) : [...lynchOk]
      candidatos = capas === 'lynch'
        ? base
        : base.filter(t => fc(t) === true && mm(t) === true)
    }

    // ── Cierres ─────────────────────────────────────────────────────────────
    let cierres = 0
    for (const [ticker, pos] of [...abiertas]) {
      const fila = porTicker.get(ticker)
      const serie = series.get(ticker)
      if (!fila || !serie) continue


      // Un fallo de datos nunca genera venta: mismo criterio que producción.
      const fallos =
        (lynchOk.has(ticker) ? 0 : 1) +
        (fc(ticker) === false ? 1 : 0) +
        (mm(ticker) === false ? 1 : 0)

      const mesesDentro = mesesEntre(pos.fechaEntrada, fecha)
      const motivo: Operacion['motivoSalida'] | null =
        o.aleatorio
          ? (mesesDentro >= HOLDING_MAX_MESES ? 'tope_temporal' : null)
          : fallos >= 2 ? 'senal'
          : mesesDentro >= HOLDING_MAX_MESES ? 'tope_temporal'
          : null

      if (motivo) {
        operaciones.push(cerrar(pos, fila, motivo, costeUnLado))
        abiertas.delete(ticker)
        cierres++
      }
    }

    // ── Aperturas ───────────────────────────────────────────────────────────
    let aperturas = 0
    for (const ticker of candidatos) {
      if (abiertas.has(ticker)) continue     // dedup, igual que /api/agentes/picks
      const fila = porTicker.get(ticker)
      if (!fila || fila.close <= 0) continue
      const s = scores.get(ticker)
      abiertas.set(ticker, {
        ticker,
        fechaEntrada: fecha,
        precioEntrada: fila.close,
        adjEntrada: fila.adjClose,
        scoreEntrada: s?.score ?? 0,
        criteriosEntrada: s?.criteria ?? vacio(),
        marketCapEntrada: fila.marketCap,
      })
      aperturas++
    }

    posicionesPorFecha.push({ fecha, n: abiertas.size })
    curva.push({ fecha, valor })

    // ── Retorno hasta la siguiente fecha de rebalanceo ───────────────────────
    const siguiente = panel.fechas[i + 1]
    if (!siguiente) break

    const tramos: Array<{ peso: number; r: number }> = []
    for (const pos of abiertas.values()) {
      const serie = series.get(pos.ticker)
      if (!serie) continue
      const a = indiceEn(serie.rows, fecha)
      const b = indiceEn(serie.rows, siguiente)
      if (a < 0 || b < 0 || b <= a) continue
      const r = serie.rows[b].adjClose / serie.rows[a].adjClose - 1
      const cap = porTicker.get(pos.ticker)?.marketCap ?? pos.marketCapEntrada ?? 0
      tramos.push({ peso: pesos === 'cap' ? Math.max(cap, 0) : 1, r })
    }

    const sumaPesos = tramos.reduce((a, t) => a + t.peso, 0)
    const bruto = sumaPesos > 0
      ? tramos.reduce((a, t) => a + (t.peso / sumaPesos) * t.r, 0)
      : 0   // sin posiciones: en liquidez, sin remuneración

    // Coste sobre la parte de la cartera que ha rotado en este rebalanceo.
    const rotacion = abiertas.size > 0 ? (aperturas + cierres) / abiertas.size : 0
    const retorno = bruto - rotacion * costeUnLado

    valor *= 1 + retorno
    retornos.push({ fecha: siguiente, retorno })
  }

  // Cierre de las que siguen vivas al final de la muestra.
  const ultima = panel.fechas[panel.fechas.length - 1]
  for (const pos of abiertas.values()) {
    const fila = (panel.porFecha.get(ultima) ?? []).find(f => f.ticker === pos.ticker)
    if (fila) operaciones.push(cerrar(pos, fila, 'fin_muestra', costeUnLado))
  }

  if (ultima && curva[curva.length - 1]?.fecha !== ultima) curva.push({ fecha: ultima, valor })

  return { curva, operaciones, posicionesPorFecha, retornos }
}

function cerrar(
  pos: Posicion, fila: PanelRow, motivo: Operacion['motivoSalida'], costeUnLado: number,
): Operacion {
  const bruto = fila.adjClose / pos.adjEntrada - 1
  return {
    ticker: pos.ticker,
    fechaEntrada: pos.fechaEntrada,
    fechaSalida: fila.fecha,
    precioEntrada: pos.precioEntrada,
    precioSalida: fila.close,
    retorno: (1 + bruto) * (1 - costeUnLado) ** 2 - 1,
    motivoSalida: motivo,
    scoreEntrada: pos.scoreEntrada,
    criteriosEntrada: pos.criteriosEntrada,
  }
}

function vacio(): ScreenerCriteria {
  return {
    pe_historico: false, pe_proyectado: false, deuda_capital: false,
    crecimiento_eps: false, peg: false, market_cap: false,
  }
}

export function mesesEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`), b = new Date(`${hasta}T00:00:00Z`)
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
}

/** Muestreo sin reemplazo con un RNG inyectado (reproducible). */
export function muestrear<T>(xs: T[], n: number, rng: () => number): T[] {
  const copia = [...xs]
  const out: T[] = []
  while (out.length < n && copia.length) {
    out.push(copia.splice(Math.floor(rng() * copia.length), 1)[0])
  }
  return out
}
