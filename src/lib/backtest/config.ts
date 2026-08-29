/**
 * Parámetros del backtest de los agentes Peter y Small.
 *
 * Todo lo que aquí se declara es una decisión metodológica que hay que poder
 * defender ante un inversor. Cambiar un valor cambia el resultado, así que
 * cada uno lleva su justificación.
 */
import path from 'node:path'

/** Raíz del caché de datos descargados. */
export const DATA_DIR = path.resolve(process.cwd(), 'data/backtest')
export const FUNDAMENTALS_DIR = path.join(DATA_DIR, 'fundamentals')
export const PRICES_DIR = path.join(DATA_DIR, 'prices')
export const MANIFEST_PATH = path.join(DATA_DIR, '_manifest.json')
export const SECTORS_PATH = path.join(DATA_DIR, '_sectores.json')

/**
 * Días naturales entre el cierre del ejercicio fiscal (`asOfDate` de Yahoo) y
 * el momento en que el dato fue realmente público. Yahoo no publica la fecha
 * de presentación del 10-K/10-Q, así que se aplica un retardo conservador.
 * Sin esto el backtest usaría información que nadie tenía → look-ahead puro.
 */
export const REPORTING_LAG_DIAS_ANUAL = 90
export const REPORTING_LAG_DIAS_TRIMESTRAL = 45

/** Primer año con fundamentales utilizables (Yahoo gratis da ~4 ejercicios). */
export const PRICES_DESDE = '2005-01-01'

/** Coste de ida y vuelta, en puntos básicos sobre el nominal negociado. */
export const COSTE_TRANSACCION_BPS = 10

/** Tope de permanencia si no salta la señal de venta. */
export const HOLDING_MAX_MESES = 12

/** Benchmark; el mismo que usan los portafolios en producción. */
export const BENCHMARK = 'SPY'

/**
 * Benchmark por universo. Medir una cartera de small caps contra el S&P 500 es
 * compararla con otra clase de activo: si el segmento entero rinde por debajo
 * del índice grande, un buen selector de small caps sigue saliendo "negativo"
 * aunque bata a todo su universo. IJR replica el S&P 600, que es de donde sale
 * la mayor parte de `SMALL_CAP_TICKERS`.
 */
export const BENCHMARK_POR_UNIVERSO = {
  large_cap: 'SPY',
  small_cap: 'IJR',
} as const

/** Sesiones bursátiles por año, para anualizar. */
export const SESIONES_ANUALES = 252

/** Nº de réplicas en bootstrap y en el test de control con carteras aleatorias. */
export const N_REPLICAS = 1000

/** Semilla del generador pseudoaleatorio: los resultados deben ser reproducibles. */
export const SEED = 20260827
