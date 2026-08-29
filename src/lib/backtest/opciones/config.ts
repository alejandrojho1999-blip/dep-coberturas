/**
 * Parámetros del backtest de los agentes de opciones (Gamma y Theta).
 *
 * Todo lo que se declara aquí es una decisión metodológica que hay que poder
 * defender ante un inversor, así que cada valor lleva su justificación. Vive
 * aparte de `../config.ts` porque aquel gobierna el backtest de acciones y las
 * dos familias no comparten ni una sola constante: allí se rebalancea al mes y
 * se mide contra un índice de renta variable, aquí hay vencimientos, primas y
 * una superficie de volatilidad que no existe en los datos.
 */
import path from 'node:path'

/** Caché propio, hermano del de acciones. */
export const DIR_OPCIONES = path.resolve(process.cwd(), 'data/backtest/opciones')

/**
 * Universo de Theta, copiado de `AgenteTheta.tsx:68`.
 *
 * Está escrito a mano allí y aquí: son los mismos 36 tickers y deben seguir
 * siéndolo. Si divergen, el backtest mediría un agente que no existe.
 */
export const UNIVERSO_THETA = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD',
  'NFLX', 'COIN', 'PLTR', 'SOFI', 'F', 'BAC', 'JPM', 'WFC', 'XOM', 'CVX',
  'GLD', 'SLV', 'TLT', 'XLE', 'XLF', 'XLK', 'ARKK',
  'ROKU', 'SNAP', 'UBER', 'DASH', 'HOOD', 'RIVN', 'LCID', 'MSTR', 'IONQ',
] as const

/**
 * Universo de Gamma, copiado de `AgenteGamma.tsx:68`.
 *
 * Ojo: en producción Gamma **no** tiene universo fijo. Toma los picks vivos de
 * Peter y Small y solo cae a esta lista cuando no hay ninguno. Reproducir el
 * universo dinámico encadenaría este backtest al de acciones y heredaría su
 * ventana de 28 meses, que es justo la limitación de la que Gamma se libra por
 * no usar fundamentales. Se mide sobre la lista fija, con 21 años, y el informe
 * lo declara: es el universo del caso degenerado, no el del caso típico.
 */
export const UNIVERSO_GAMMA = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN',
  'META', 'GOOGL', 'AMD', 'NFLX', 'COIN',
  'PLTR', 'SOFI', 'UBER', 'ROKU', 'SNAP',
] as const

/** Todo lo que hay que descargar de subyacentes. */
export const UNIVERSO_OPCIONES = [...new Set([...UNIVERSO_THETA, ...UNIVERSO_GAMMA])]

/**
 * Series auxiliares, cada una con su papel.
 *
 * `^PUT` es la pieza clave: el CBOE S&P 500 PutWrite Index vende puts ATM sobre
 * el S&P 500 cada mes con **precios de opciones reales**. Replicarlo con la
 * cadena sintética y buscar el `k` que lo reproduce es lo que convierte el
 * supuesto de volatilidad en un parámetro ajustado contra el mercado en vez de
 * elegido a dedo.
 */
export const SERIES_AUXILIARES = {
  /** Volatilidad implícita del S&P 500 a 30 días. */
  vix: '^VIX',
  /** Volatilidad implícita del Nasdaq 100, para los subyacentes tecnológicos. */
  vxn: '^VXN',
  /** Diana de calibración y benchmark de Theta. */
  putWrite: '^PUT',
  /** Letra del Tesoro a 13 semanas: el tipo sin riesgo, fecha a fecha. */
  tipoSinRiesgo: '^IRX',
  /** Índice de venta de calls cubiertas, para el lado covered-call de Theta. */
  buyWrite: 'QYLD',
  /** Benchmark de Gamma: compra opciones sobre acciones, se mide contra el mercado. */
  mercado: 'SPY',
} as const

/** Primera fecha con datos en todas las series largas. */
export const DESDE = '2005-01-01'

/**
 * Multiplicador estándar de un contrato en EE. UU.
 * Se reexporta desde `lib/options/settlement.ts` para no tener dos definiciones.
 */
export { CONTRACT_MULTIPLIER } from '@/lib/options/settlement'

/**
 * Horquilla de compraventa, como fracción del mid.
 *
 * Sin esto el backtest cobra y paga al precio teórico, que nadie consigue. La
 * horquilla real se ensancha cuanto más lejos del dinero está el contrato y
 * cuanto menos líquido es el subyacente; se modela con un suelo y una pendiente
 * en función de la moneyness. Los valores son conservadores a propósito: si el
 * resultado solo aparece con horquillas optimistas, no es un resultado.
 */
export const HORQUILLA_BASE = 0.02
export const HORQUILLA_POR_MONEYNESS = 0.08

/**
 * Comisión por contrato, ida o vuelta. Un bróker minorista típico cobra entre
 * $0,50 y $0,65; se toma el extremo alto.
 */
export const COMISION_POR_CONTRATO = 0.65

/**
 * Ventana de la volatilidad realizada, en sesiones.
 *
 * 20 sesiones ≈ un mes natural, que es el plazo de los contratos que ambos
 * agentes operan. Se calcula también a 30 para la variante de robustez.
 */
export const VENTANA_VOL_REALIZADA = 20
export const VENTANA_VOL_REALIZADA_LARGA = 30

/**
 * Rejilla de `k` para el barrido de sensibilidad.
 *
 * `k` es el cociente entre la volatilidad implícita que se supone y la
 * realizada. Es el **único supuesto libre** del estudio y decide por sí solo si
 * Theta gana, así que el informe publica el resultado como curva sobre esta
 * rejilla y no como una cifra única.
 *
 * La rejilla baja hasta 0,55 porque la calibración contra `^PUT` se fue al borde
 * inferior dos veces seguidas. Un óptimo pegado al borde no es un óptimo: es la
 * señal de que la rejilla estaba mal puesta.
 *
 * Que el ajuste caiga por debajo de 1 **no** significa que la implícita cotice
 * por debajo de la realizada: el cociente VIX/realizada tiene mediana 1,31 en
 * estos 21 años, así que la prima de varianza es claramente positiva. Lo que
 * `k` absorbe es el sesgo de valorar una opción a 30 días con la volatilidad de
 * los 20 días **anteriores**: la volatilidad revierte a la media, y tras un
 * susto la pasada sobreestima con mucho a la futura. `k` es una constante de
 * ajuste, no la prima de varianza, y el informe no debe confundirlas.
 */
export const REJILLA_K = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 1.00, 1.10, 1.20, 1.30] as const

/** Sesiones bursátiles por año, para anualizar. */
export const SESIONES_ANUALES = 252

/** Capital asignado a cada agente, el mismo que usan los portafolios. */
export const CAPITAL_GAMMA = 100_000
export const CAPITAL_THETA = 300_000

/**
 * Margen exigido por un put vendido, como fracción del nocional.
 *
 * Dimensionar por la prima cobrada haría parecer a Theta infinitamente
 * escalable: cobrar $200 no significa poder abrir infinitos contratos. La regla
 * estándar del bróker es la mayor de dos fórmulas; se aproxima con un 20 % del
 * nocional, que es el orden de magnitud correcto y peca de conservador.
 */
export const MARGEN_SHORT_PUT = 0.20

/** Semilla del generador pseudoaleatorio: los resultados deben reproducirse. */
export const SEED = 20260829
