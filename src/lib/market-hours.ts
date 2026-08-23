/**
 * Horario del mercado estadounidense, para las tareas que dependen de precios
 * vivos.
 *
 * Importa porque la revisión de niveles cotiza el **mid bid/ask** de las
 * opciones: fuera de la sesión regular esa horquilla se queda congelada en el
 * cierre, así que revisar de noche sería comparar los niveles contra un precio
 * muerto.
 *
 * El desfase entre ET y UTC cambia dos veces al año. En vez de cablear las
 * reglas del horario de verano se le pregunta a `Intl`, que las conoce y las
 * mantiene actualizadas.
 */

/** Apertura de la sesión regular, en minutos desde medianoche ET. */
const APERTURA = 9 * 60 + 30
/** Cierre de la sesión regular, en minutos desde medianoche ET. */
const CIERRE = 16 * 60

/**
 * Margen tras la apertura en el que no se opera. En la primera media hora los
 * spreads de opciones están anchísimos y el mid es poco representativo.
 */
export const MARGEN_APERTURA_MIN = 30

/** Margen antes del cierre, para no revisar en la subasta final. */
export const MARGEN_CIERRE_MIN = 15

export interface MarketMoment {
  /** Minutos desde medianoche en Nueva York. */
  minutosET: number
  /** 0 = domingo … 6 = sábado, en Nueva York. */
  diaSemana: number
  /** Fecha `YYYY-MM-DD` en Nueva York. */
  fechaET: string
}

const FORMATO = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DIAS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** Traduce un instante a la hora de Nueva York. */
export function marketMoment(now: Date): MarketMoment {
  const parts = FORMATO.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  // A medianoche `Intl` devuelve "24" en algunas plataformas; 24:00 es 00:00.
  const hora = parseInt(get('hour'), 10) % 24
  const minuto = parseInt(get('minute'), 10)

  return {
    minutosET: hora * 60 + minuto,
    diaSemana: DIAS[get('weekday')] ?? -1,
    fechaET: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

export interface MarketStatus {
  abierto: boolean
  /** Motivo por el que no se puede operar, para el log. */
  motivo?: 'fin-de-semana' | 'fuera-de-horario' | 'apertura-reciente' | 'cierre-inminente'
  momento: MarketMoment
}

/**
 * ¿Es un buen momento para cotizar opciones?
 *
 * Exige sesión regular y, además, que hayan pasado los primeros minutos y que
 * no esté a punto de cerrar. No conoce los festivos: en un festivo Yahoo
 * devuelve la horquilla del último cierre, y evaluarla otra vez da el mismo
 * resultado que ya dio ese día, así que la consecuencia es una ejecución
 * inútil, no un cierre equivocado.
 */
export function marketStatus(now: Date): MarketStatus {
  const momento = marketMoment(now)

  if (momento.diaSemana === 0 || momento.diaSemana === 6) {
    return { abierto: false, motivo: 'fin-de-semana', momento }
  }
  if (momento.minutosET < APERTURA || momento.minutosET >= CIERRE) {
    return { abierto: false, motivo: 'fuera-de-horario', momento }
  }
  if (momento.minutosET < APERTURA + MARGEN_APERTURA_MIN) {
    return { abierto: false, motivo: 'apertura-reciente', momento }
  }
  if (momento.minutosET >= CIERRE - MARGEN_CIERRE_MIN) {
    return { abierto: false, motivo: 'cierre-inminente', momento }
  }
  return { abierto: true, momento }
}

/** Explicación legible de por qué no se opera. */
export function describeMarketStatus(status: MarketStatus): string {
  const hh = String(Math.floor(status.momento.minutosET / 60)).padStart(2, '0')
  const mm = String(status.momento.minutosET % 60).padStart(2, '0')
  const reloj = `${status.momento.fechaET} ${hh}:${mm} ET`
  if (status.abierto) return `Mercado abierto (${reloj})`
  switch (status.motivo) {
    case 'fin-de-semana':     return `Fin de semana (${reloj})`
    case 'fuera-de-horario':  return `Fuera de la sesión regular (${reloj})`
    case 'apertura-reciente': return `Primeros ${MARGEN_APERTURA_MIN} min de sesión: spreads poco fiables (${reloj})`
    case 'cierre-inminente':  return `Últimos ${MARGEN_CIERRE_MIN} min de sesión (${reloj})`
    default:                  return `Mercado cerrado (${reloj})`
  }
}
