/**
 * Probabilidad implícita de movimiento de tasas.
 *
 * Es la metodología de CME FedWatch, calculada aquí en vez de leída de su
 * página: el futuro de fondos federales de 30 días (ZQ) liquida contra la media
 * aritmética de la tasa efectiva del mes, así que `100 - precio` es la tasa
 * media que el mercado espera para ese mes. Si dentro del mes hay una reunión,
 * esa media mezcla los días previos (a la tasa vigente) con los posteriores (a
 * la tasa nueva), y despejando se obtiene la tasa que el mercado descuenta
 * después de la reunión.
 *
 *     100 - P = (n1/N)·r0 + (n2/N)·r1   ⟹   r1 = ((100-P)·N − n1·r0) / n2
 *
 * La probabilidad de subida es cuánto de un movimiento completo de 25 pb hay ya
 * metido en esa r1. No es una opinión del modelo: es aritmética sobre un precio
 * de mercado, y por eso se puede auditar.
 */

import { fetchFREDObservations } from '@/lib/data/fred'
import { instanteUtc, proximoEvento, type EventoProximo } from '@/lib/alertas/calendario'

/** Tamaño estándar de un movimiento del FOMC, en puntos porcentuales. */
export const PASO_TASA = 0.25

const CODIGOS_MES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'] as const

/**
 * Símbolo Yahoo del contrato ZQ de un mes concreto.
 *
 * Verificado contra Yahoo: `ZQU26.CBT`, `ZQV26.CBT`, `ZQZ26.CBT` cotizan. El
 * front month genérico (`ZQ=F`) no sirve aquí porque rota sin avisar y no
 * siempre es el mes de la reunión.
 */
export function simboloZq(anio: number, mes: number): string {
  return `ZQ${CODIGOS_MES[mes - 1]}${String(anio % 100).padStart(2, '0')}.CBT`
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

export interface ProbabilidadTasas {
  reunion: string
  etiqueta: string
  contrato: string
  precioContrato: number
  /** Tasa efectiva vigente, en porcentaje. */
  tasaActual: number
  /** Tasa media que descuenta el contrato para el mes. */
  tasaMediaImplicita: number
  /** Tasa que descuenta el mercado tras la reunión. */
  tasaImplicitaPost: number
  probSubida: number
  probMantener: number
  probBajada: number
  /** true si algo obligó a una aproximación (contrato del mes siguiente, etc.). */
  aproximado: boolean
  nota: string
}

/**
 * Reparte la probabilidad entre subir, mantener y bajar.
 *
 * El mercado no cotiza "una subida": cotiza una tasa esperada entre dos
 * escalones. La fracción del paso que ya está descontada es la probabilidad del
 * movimiento; el resto se queda en "mantener". Movimientos de más de 25 pb
 * saturan en 100%, que es lo que hace también la tabla de CME.
 */
export function repartirProbabilidad(tasaActual: number, tasaImplicita: number): {
  probSubida: number; probMantener: number; probBajada: number
} {
  const delta = tasaImplicita - tasaActual
  const fraccion = Math.min(1, Math.abs(delta) / PASO_TASA)
  const pct = Math.round(fraccion * 1000) / 10

  if (delta > 0) return { probSubida: pct, probMantener: Math.round((100 - pct) * 10) / 10, probBajada: 0 }
  if (delta < 0) return { probSubida: 0, probMantener: Math.round((100 - pct) * 10) / 10, probBajada: pct }
  return { probSubida: 0, probMantener: 100, probBajada: 0 }
}

/**
 * Despeja la tasa posterior a la reunión a partir del precio del contrato.
 *
 * `diaEfectivo` es el primer día del mes en que rige ya la tasa nueva: la
 * decisión se anuncia a las 14:00 ET y es efectiva al día siguiente.
 */
export function tasaPostReunion(params: {
  precio: number
  tasaActual: number
  diasMes: number
  diaEfectivo: number
}): number | null {
  const { precio, tasaActual, diasMes, diaEfectivo } = params
  const media = 100 - precio
  const n1 = diaEfectivo - 1
  const n2 = diasMes - n1
  if (n2 <= 0 || !Number.isFinite(media)) return null
  return ((media * diasMes) - (n1 * tasaActual)) / n2
}

async function precioContrato(simbolo: string): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=5d&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(9000),
  })
  if (!res.ok) throw new Error(`Yahoo devolvió ${res.status} para ${simbolo}`)

  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  const precio = Number(meta?.regularMarketPrice)
  if (!Number.isFinite(precio) || precio <= 0 || precio > 100) {
    throw new Error(`Precio no utilizable para ${simbolo}`)
  }
  return precio
}

/** Tasa efectiva de fondos federales más reciente publicada por la Fed. */
export async function tasaEfectivaActual(): Promise<number> {
  const hoy = new Date()
  const desde = new Date(hoy.getTime() - 45 * 86_400_000).toISOString().slice(0, 10)
  const obs = await fetchFREDObservations('EFFR', desde, hoy.toISOString().slice(0, 10))
  const ultima = obs.at(-1)
  if (!ultima || !Number.isFinite(ultima.value)) throw new Error('FRED no devolvió la tasa efectiva (EFFR)')
  return ultima.value
}

/**
 * Probabilidad para la próxima reunión del FOMC.
 *
 * Si el contrato del mes de la reunión no cotiza se cae al contrato del mes
 * siguiente, cuyo precio es directamente la tasa esperada tras la reunión
 * —siempre que no haya otra reunión de por medio— y el resultado se marca como
 * aproximado en lugar de inventarse.
 */
export async function probabilidadProximaReunion(ahora = new Date()): Promise<ProbabilidadTasas> {
  const reunion: EventoProximo | null = proximoEvento('fomc', ahora)
  if (!reunion) throw new Error('No hay reuniones del FOMC en el calendario')

  const tasaActual = await tasaEfectivaActual()
  const [anio, mes, dia] = reunion.fechaET.split('-').map(Number)
  const diasMes = diasDelMes(anio, mes)
  // La decisión rige desde el día siguiente al anuncio.
  const diaEfectivo = dia + 1

  const contratoMes = simboloZq(anio, mes)
  let aproximado = false
  let nota = 'Descomposición del contrato del mes de la reunión (metodología CME FedWatch).'
  let contrato = contratoMes
  let precio: number
  let tasaImplicitaPost: number | null

  try {
    precio = await precioContrato(contratoMes)
    tasaImplicitaPost = tasaPostReunion({ precio, tasaActual, diasMes, diaEfectivo })
    if (tasaImplicitaPost == null) throw new Error('reunión demasiado cerca del fin de mes')
  } catch (e) {
    const siguiente = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
    contrato = simboloZq(siguiente.anio, siguiente.mes)
    precio = await precioContrato(contrato)
    tasaImplicitaPost = 100 - precio
    aproximado = true
    nota = `Contrato del mes de la reunión no utilizable (${(e as Error).message}); se usa el del mes siguiente.`
  }

  const reparto = repartirProbabilidad(tasaActual, tasaImplicitaPost)

  return {
    reunion: reunion.fechaET,
    etiqueta: reunion.etiqueta,
    contrato,
    precioContrato: precio,
    tasaActual,
    tasaMediaImplicita: 100 - precio,
    tasaImplicitaPost,
    ...reparto,
    aproximado,
    nota,
  }
}

/** Instante UTC de la próxima decisión, para las cuentas atrás. */
export function instanteProximaReunion(ahora = new Date()): Date | null {
  const r = proximoEvento('fomc', ahora)
  return r ? instanteUtc(r) : null
}
