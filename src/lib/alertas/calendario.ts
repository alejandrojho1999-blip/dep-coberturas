/**
 * Calendario de publicaciones que mueven el mercado.
 *
 * Las fechas están escritas a mano porque no existe una API pública fiable: el
 * FOMC publica su calendario en HTML y el BLS bloquea a los clientes
 * automatizados. Las de la Reserva Federal salen de
 * federalreserve.gov/monetarypolicy/fomccalendars.htm y las del IPC del
 * calendario de publicaciones del BLS. Hay que revisarlas una vez al año.
 *
 * El instante se guarda como fecha y hora **de Nueva York**; el desfase con UTC
 * cambia dos veces al año y se resuelve con `Intl`, igual que en
 * `src/lib/market-hours.ts`, en vez de cablear el horario de verano.
 */

export type TipoEvento = 'fomc' | 'cpi'

export interface EventoCalendario {
  tipo: TipoEvento
  /** Fecha en Nueva York, `YYYY-MM-DD`. */
  fechaET: string
  /** Hora en Nueva York, minutos desde medianoche. */
  horaET: number
  etiqueta: string
}

/**
 * Dónde se publica cada evento.
 *
 * Un aviso previo no nace de una noticia, así que no hereda el enlace de
 * ningún titular: apunta al organismo que publicará el dato, que es lo que uno
 * quiere abrir cuando llega el aviso.
 */
export const FUENTE_EVENTO: Record<TipoEvento, { fuente: string; url: string }> = {
  fomc: {
    fuente: 'Reserva Federal',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  },
  cpi: {
    fuente: 'BLS',
    url: 'https://www.bls.gov/cpi/',
  },
}

/** Decisión de tasas: 14:00 ET del segundo día de la reunión. */
const HORA_FOMC = 14 * 60
/** Dato de inflación: 08:30 ET. */
const HORA_CPI = 8 * 60 + 30

/** Segundo día de cada reunión del FOMC, que es cuando sale el comunicado. */
const FOMC: ReadonlyArray<[string, string]> = [
  ['2026-09-16', 'FOMC septiembre 2026 (con proyecciones)'],
  ['2026-10-28', 'FOMC octubre 2026'],
  ['2026-12-09', 'FOMC diciembre 2026 (con proyecciones)'],
  ['2027-01-27', 'FOMC enero 2027'],
  ['2027-03-17', 'FOMC marzo 2027 (con proyecciones)'],
  ['2027-04-28', 'FOMC abril 2027'],
  ['2027-06-09', 'FOMC junio 2027 (con proyecciones)'],
  ['2027-07-28', 'FOMC julio 2027'],
  ['2027-09-15', 'FOMC septiembre 2027 (con proyecciones)'],
  ['2027-10-27', 'FOMC octubre 2027'],
  ['2027-12-08', 'FOMC diciembre 2027 (con proyecciones)'],
]

const CPI: ReadonlyArray<[string, string]> = [
  ['2026-09-11', 'IPC de agosto 2026'],
  ['2026-10-14', 'IPC de septiembre 2026'],
  ['2026-11-10', 'IPC de octubre 2026'],
  ['2026-12-10', 'IPC de noviembre 2026'],
]

export const EVENTOS: readonly EventoCalendario[] = [
  ...FOMC.map(([fechaET, etiqueta]) => ({ tipo: 'fomc' as const, fechaET, horaET: HORA_FOMC, etiqueta })),
  ...CPI.map(([fechaET, etiqueta]) => ({ tipo: 'cpi' as const, fechaET, horaET: HORA_CPI, etiqueta })),
].sort((a, b) => (a.fechaET + a.horaET).localeCompare(b.fechaET + b.horaET))

const OFFSET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'longOffset',
})

/** Desfase de Nueva York con UTC, en minutos, para un instante dado. */
function offsetMinutos(ref: Date): number {
  const nombre = OFFSET.formatToParts(ref).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5'
  const m = nombre.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!m) return -300
  const signo = m[1] === '-' ? -1 : 1
  return signo * (Number(m[2]) * 60 + Number(m[3]))
}

/**
 * Instante UTC de un evento.
 *
 * El desfase se calcula sobre una primera aproximación (mediodía UTC de esa
 * fecha) y se aplica después: en los dos días del año en que cambia la hora, el
 * error posible es de una hora en un evento de las 8:30 o las 14:00, nunca en
 * el propio salto, que ocurre de madrugada.
 */
export function instanteUtc(evento: EventoCalendario): Date {
  const [y, m, d] = evento.fechaET.split('-').map(Number)
  const aproximado = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const offset = offsetMinutos(aproximado)
  return new Date(Date.UTC(y, m - 1, d, 0, evento.horaET - offset, 0))
}

export interface EventoProximo extends EventoCalendario {
  instante: Date
  /** Minutos que faltan. Negativo si ya ocurrió. */
  faltanMin: number
}

export function proximoEvento(
  tipo: TipoEvento | 'todos' = 'todos',
  ahora = new Date(),
): EventoProximo | null {
  const candidatos = EVENTOS
    .filter((e) => tipo === 'todos' || e.tipo === tipo)
    .map((e) => {
      const instante = instanteUtc(e)
      return { ...e, instante, faltanMin: (instante.getTime() - ahora.getTime()) / 60_000 }
    })
    .filter((e) => e.faltanMin > 0)
    .sort((a, b) => a.faltanMin - b.faltanMin)

  return candidatos[0] ?? null
}

/** Texto legible de una cuenta atrás en minutos. */
export function formatearFalta(faltanMin: number): string {
  const total = Math.max(0, Math.round(faltanMin))
  const dias = Math.floor(total / 1440)
  const horas = Math.floor((total % 1440) / 60)
  const minutos = total % 60

  if (dias > 0) return `${dias} d ${horas} h`
  if (horas > 0) return `${horas} h ${minutos} min`
  return `${minutos} min`
}

/** Hitos de aviso previo, en minutos antes del evento. */
export const HITOS_AVISO = [1440, 60, 15] as const
export type HitoAviso = (typeof HITOS_AVISO)[number]

/**
 * Hito que toca avisar, si alguno.
 *
 * La ventana es el propio periodo del cron (`toleranciaMin`): si el script
 * corre cada 5 minutos, un hito se considera alcanzado cuando faltan entre
 * `hito - 5` y `hito` minutos. Así cada aviso sale una sola vez sin depender de
 * que el reloj caiga en el minuto exacto.
 */
export function hitoAlcanzado(faltanMin: number, toleranciaMin = 5): HitoAviso | null {
  for (const hito of HITOS_AVISO) {
    if (faltanMin <= hito && faltanMin > hito - toleranciaMin) return hito
  }
  return null
}

/**
 * ¿Estamos en la ventana en que el dato acaba de salir?
 *
 * Desde el instante de la publicación hasta `ventanaMin` después. En ese rato
 * el script pasa a sondeo fino para avisar en cuanto haya cifra.
 */
export function enVentanaPublicacion(
  evento: EventoCalendario,
  ahora = new Date(),
  ventanaMin = 30,
): boolean {
  const t = instanteUtc(evento).getTime()
  const delta = (ahora.getTime() - t) / 60_000
  return delta >= 0 && delta <= ventanaMin
}

export function eventoEnCurso(ahora = new Date(), ventanaMin = 30): EventoCalendario | null {
  return EVENTOS.find((e) => enVentanaPublicacion(e, ahora, ventanaMin)) ?? null
}
