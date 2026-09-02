/**
 * Envilecimiento de la moneda (debasement).
 *
 * La pregunta no es cuánto sube el oro, sino cuánto se degrada aquello con lo
 * que se mide. Por eso el panel no mira el precio nominal: mira el oro y el
 * bitcoin **por unidad de M2**, la tasa real a 10 años, la inflación —general y
 * subyacente— y el tamaño del balance de la Reserva Federal. Cuando M2 crece
 * más rápido que el oro, el refugio va por detrás; cuando la tasa real cae, el
 * coste de guardar refugio desaparece. Tasa real e inflación son las dos caras
 * de la misma moneda: la nominal menos lo que se lleva la subida de precios.
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

/**
 * Cómo se lee una serie.
 *
 * De una tasa interesa el nivel: «tasa real 10 años, 1,9 %» es la frase
 * completa. De un índice de precios no interesa el nivel —nadie sabe qué
 * significa un IPC de 323— sino cuánto ha subido en un año, que es lo que la
 * gente llama inflación. Declararlo por serie evita que el panel tenga que
 * adivinarlo.
 */
type Lectura = 'nivel' | 'var12m'

interface SerieDef {
  id: string
  clave: string
  etiqueta: string
  unidad: string
  lectura: Lectura
}

const SERIES: readonly SerieDef[] = [
  { id: 'M2SL',     clave: 'm2',        etiqueta: 'M2 (masa monetaria)',       unidad: 'miles de millones USD', lectura: 'nivel'  },
  { id: 'WALCL',    clave: 'balance',   etiqueta: 'Balance de la Fed',         unidad: 'millones USD',          lectura: 'nivel'  },
  { id: 'DFII10',   clave: 'tasa_real', etiqueta: 'Tasa real 10 años (TIPS)',  unidad: '%',                     lectura: 'nivel'  },
  { id: 'CPIAUCSL', clave: 'ipc',       etiqueta: 'Inflación IPC (interanual)', unidad: '%',                    lectura: 'var12m' },
  { id: 'CPILFESL', clave: 'ipc_core',  etiqueta: 'IPC subyacente (interanual)', unidad: '%',                   lectura: 'var12m' },
]

/**
 * Traduce una serie de FRED a la métrica que se publica.
 *
 * Devuelve `null` cuando no hay con qué: sin observaciones, o sin un año de
 * historia en una serie que se publica como variación. Se prefiere omitir la
 * métrica a enseñar un hueco, porque el panel se lee de un vistazo y una
 * casilla vacía se confunde con un cero.
 */
export function metricaDesde(def: SerieDef, obs: FREDObservation[]): MetricaDebasement | null {
  const { ultimo, var12mPct } = variacion12m(obs)
  if (!ultimo) return null

  if (def.lectura === 'var12m') {
    if (var12mPct == null) return null
    // El valor ya *es* la variación: repetirla debajo sería decir dos veces lo
    // mismo con dos formatos distintos.
    return {
      clave: def.clave,
      etiqueta: def.etiqueta,
      valor: var12mPct,
      unidad: def.unidad,
      var12mPct: null,
      fecha: ultimo.date,
    }
  }

  return {
    clave: def.clave,
    etiqueta: def.etiqueta,
    valor: ultimo.value,
    unidad: def.unidad,
    var12mPct,
    fecha: ultimo.date,
  }
}

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
    // El nivel crudo se guarda siempre, aunque la métrica se publique como
    // variación: los cocientes de refugio necesitan M2 en unidades de dinero,
    // no en porcentaje.
    const ultimo = r.value.at(-1)
    if (ultimo) valores.set(def.clave, ultimo.value)

    const metrica = metricaDesde(def, r.value)
    if (!metrica) {
      errores.push(`${def.id}: sin observaciones suficientes`)
      return
    }
    metricas.push(metrica)
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
