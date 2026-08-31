/**
 * Envilecimiento de la moneda (debasement).
 *
 * La pregunta no es cuánto sube el oro, sino cuánto se degrada aquello con lo
 * que se mide. Por eso el panel no mira el precio nominal: mira el oro y el
 * bitcoin **por unidad de M2**, la tasa real a 10 años y el tamaño del balance
 * de la Reserva Federal. Cuando M2 crece más rápido que el oro, el refugio va
 * por detrás; cuando la tasa real cae, el coste de guardar refugio desaparece.
 */

import { fetchFREDObservations, type FREDObservation } from '@/lib/data/fred'
import { cotizar } from '@/lib/alertas/precios'

export interface MetricaDebasement {
  clave: string
  etiqueta: string
  valor: number
  unidad: string
  /** Variación en 12 meses, en porcentaje. `null` si no hay historia. */
  var12mPct: number | null
  fecha: string
}

export interface Debasement {
  metricas: MetricaDebasement[]
  errores: string[]
  tomadoAt: string
}

/** Serie más reciente y su valor de hace ~12 meses, para la variación anual. */
function variacion12m(obs: FREDObservation[]): { ultimo: FREDObservation | null; var12mPct: number | null } {
  const ultimo = obs.at(-1) ?? null
  if (!ultimo) return { ultimo: null, var12mPct: null }

  const objetivo = Date.parse(ultimo.date) - 365 * 86_400_000
  // La observación más cercana al objetivo por debajo: las series mensuales no
  // tienen un dato exactamente un año antes.
  const previa = [...obs].reverse().find((o) => Date.parse(o.date) <= objetivo)
  if (!previa || previa.value === 0) return { ultimo, var12mPct: null }

  return { ultimo, var12mPct: ((ultimo.value - previa.value) / Math.abs(previa.value)) * 100 }
}

const SERIES: ReadonlyArray<{ id: string; clave: string; etiqueta: string; unidad: string }> = [
  { id: 'M2SL',  clave: 'm2',        etiqueta: 'M2 (masa monetaria)',        unidad: 'miles de millones USD' },
  { id: 'WALCL', clave: 'balance',   etiqueta: 'Balance de la Fed',          unidad: 'millones USD' },
  { id: 'DFII10',clave: 'tasa_real', etiqueta: 'Tasa real 10 años (TIPS)',   unidad: '%' },
  { id: 'CPIAUCSL', clave: 'ipc',    etiqueta: 'IPC (índice)',               unidad: 'índice' },
]

/**
 * Foto del envilecimiento.
 *
 * Cada serie se pide por separado y un fallo aislado no tumba el resto: es
 * preferible un panel con cuatro de cinco métricas que ninguno.
 */
export async function medirDebasement(ahora = new Date()): Promise<Debasement> {
  const desde = new Date(ahora.getTime() - 400 * 86_400_000).toISOString().slice(0, 10)
  const hasta = ahora.toISOString().slice(0, 10)

  const metricas: MetricaDebasement[] = []
  const errores: string[] = []

  const series = await Promise.allSettled(
    SERIES.map((s) => fetchFREDObservations(s.id, desde, hasta)),
  )

  const valores = new Map<string, number>()

  series.forEach((r, i) => {
    const def = SERIES[i]
    if (r.status !== 'fulfilled') {
      errores.push(`${def.id}: ${(r.reason as Error).message}`)
      return
    }
    const { ultimo, var12mPct } = variacion12m(r.value)
    if (!ultimo) {
      errores.push(`${def.id}: sin observaciones`)
      return
    }
    valores.set(def.clave, ultimo.value)
    metricas.push({
      clave: def.clave,
      etiqueta: def.etiqueta,
      valor: ultimo.value,
      unidad: def.unidad,
      var12mPct,
      fecha: ultimo.date,
    })
  })

  // Refugio por unidad de dinero: es el cociente lo que dice si el activo está
  // simplemente siguiendo a la impresión o adelantándose a ella.
  const m2 = valores.get('m2')
  for (const [ticker, clave, etiqueta] of [
    ['GC=F', 'oro_m2', 'Oro por unidad de M2'],
    ['BTC-USD', 'btc_m2', 'Bitcoin por unidad de M2'],
  ] as const) {
    try {
      const { precio } = await cotizar(ticker)
      metricas.push({
        clave: 'precio_' + clave.split('_')[0],
        etiqueta: ticker,
        valor: precio,
        unidad: 'USD',
        var12mPct: null,
        fecha: hasta,
      })
      if (m2 && m2 > 0) {
        metricas.push({
          clave,
          etiqueta,
          valor: (precio / m2) * 1000,
          unidad: 'USD por cada mil M$ de M2',
          var12mPct: null,
          fecha: hasta,
        })
      }
    } catch (e) {
      errores.push(`${ticker}: ${(e as Error).message}`)
    }
  }

  return { metricas, errores, tomadoAt: ahora.toISOString() }
}

export { variacion12m }
