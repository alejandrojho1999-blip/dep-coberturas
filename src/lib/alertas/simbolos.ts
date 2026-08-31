/**
 * Catálogo de activos vigilados por el sistema de alerta temprana.
 *
 * Cada símbolo declara con qué evento reacciona, en qué dirección se coloca la
 * orden y con qué precisión se redondea el nivel. El tick importa: un buy stop
 * en el futuro del oro con tres decimales no lo acepta el bróker, y uno en
 * bitcoin redondeado a dos decimales es ruido disfrazado de precisión.
 */

export type EventoAlerta = 'guerra' | 'tasas'

export interface SimboloAlerta {
  /** Símbolo tal y como lo entiende Yahoo Finance. */
  ticker: string
  /** Etiqueta corta para el mensaje de WhatsApp. */
  etiqueta: string
  /** Decimales con los que se muestra el precio. */
  decimales: number
  /** Salto mínimo de precio al que se redondea el nivel de la orden. */
  tick: number
  /** Eventos ante los que este activo entra en el mensaje. */
  eventos: EventoAlerta[]
  /**
   * Dirección de la orden ante una escalada bélica. El refugio se compra; los
   * índices no participan de este evento y quedan como `null`.
   */
  direccionGuerra: 'buy' | 'sell' | null
}

export const SIMBOLOS: readonly SimboloAlerta[] = [
  { ticker: 'GC=F',     etiqueta: 'ORO (GC=F)',    decimales: 2, tick: 0.1,   eventos: ['guerra'], direccionGuerra: 'buy' },
  { ticker: 'SI=F',     etiqueta: 'PLATA (SI=F)',  decimales: 3, tick: 0.005, eventos: ['guerra'], direccionGuerra: 'buy' },
  { ticker: 'BTC-USD',  etiqueta: 'BTC-USD',       decimales: 0, tick: 10,    eventos: ['guerra'], direccionGuerra: 'buy' },
  { ticker: 'CL=F',     etiqueta: 'WTI (CL=F)',    decimales: 2, tick: 0.01,  eventos: ['guerra'], direccionGuerra: 'buy' },
  { ticker: 'NQ=F',     etiqueta: 'NASDAQ (NQ=F)', decimales: 2, tick: 0.25,  eventos: ['tasas'],  direccionGuerra: null },
  { ticker: 'ES=F',     etiqueta: 'S&P 500 (ES=F)',decimales: 2, tick: 0.25,  eventos: ['tasas'],  direccionGuerra: null },
] as const

/** Dólar: no se opera, se cita como termómetro del envilecimiento. */
export const TICKER_DXY = 'DX-Y.NYB'

export function simbolosDe(evento: EventoAlerta): SimboloAlerta[] {
  return SIMBOLOS.filter((s) => s.eventos.includes(evento))
}

export function buscarSimbolo(ticker: string): SimboloAlerta | undefined {
  return SIMBOLOS.find((s) => s.ticker === ticker)
}
