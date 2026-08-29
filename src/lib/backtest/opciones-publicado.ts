/**
 * Resumen publicado del backtest de los agentes de opciones.
 *
 * Vive aparte de `publicado.ts` porque los dos estudios responden preguntas
 * distintas y no comparten forma: allí hay screener, criterios y atribución por
 * capa; aquí hay calibración, un supuesto de volatilidad y un barrido sobre él.
 * Mezclarlos obligaría a que cada campo fuera opcional y la pantalla tendría que
 * adivinar cuál mira.
 */
import datos from './opciones-resumen-publicado.json'

/** Métricas de una variante, ya comparada con su índice. */
export interface MetricasOpciones {
  nPeriodos: number
  retornoTotal: number
  cagr: number
  volatilidadAnual: number
  sharpe: number
  maxDrawdown: number
  retornoActivoMedio: number
  trackingError: number
  informationRatio: number
  beta: number
  alphaAnual: number
  tStat: number
  pValor: number
  bootstrapPValor: number
  nOperaciones: number
  hitRate: number
  /** Vencimientos en los que el agente no tenía ninguna posición abierta. */
  vencimientosSinPosiciones: number
}

export interface IndiceOpciones {
  ticker: string
  cagr: number
  volatilidadAnual: number
  sharpe: number
  maxDrawdown: number
}

/** Un punto del barrido: qué sale con cada valor del supuesto. */
export interface PuntoBarrido {
  k: number
  cagr: number
  sharpe: number
  informationRatio: number
  tStat: number
  nOperaciones: number
  /** true en el valor que la calibración eligió. */
  calibrado: boolean
}

/** Un punto de la calibración contra `^PUT`. */
export interface PuntoCalibracion {
  k: number
  /** Error de seguimiento anualizado contra el índice real. */
  errorSeguimiento: number
  correlacion: number
  calibrado: boolean
}

export interface AgenteOpciones {
  id: 'gamma' | 'theta'
  nombre: string
  /** Qué hace con las opciones, en una línea. */
  descripcion: string
  capital: number
  metricas: MetricasOpciones
  benchmark: IndiceOpciones
  curva: Array<{ fecha: string; valor: number }>
  barrido: PuntoBarrido[]
}

/** Una corrida completa: un modo de volatilidad con sus dos agentes. */
export interface VarianteOpciones {
  id: string
  /** `constante` o `regimen`. */
  modo: string
  descripcionModo: string
  conSkew: boolean
  conNivelesDeSalida: boolean
  calibracion: {
    kOptimo: number
    errorSeguimiento: number
    correlacion: number
    rejilla: PuntoCalibracion[]
  }
  agentes: AgenteOpciones[]
}

export interface ResumenOpciones {
  generado: string
  ventana: { desde: string; hasta: string; nVencimientos: number }
  /**
   * Prima de varianza observada en los datos: el cociente VIX / volatilidad
   * realizada del S&P 500. Se publica porque es lo que impide leer mal el
   * parámetro calibrado — su mediana está muy por encima de 1, así que un ajuste
   * por debajo de 1 no puede interpretarse como «la implícita cotiza barata».
   */
  primaDeVarianzaObservada: { media: number; mediana: number; p10: number; p90: number }
  /**
   * Curva de cada índice de referencia, una sola vez.
   *
   * SPY y `^PUT` no dependen del supuesto de volatilidad ni del skew, así que
   * repetirlas dentro de cada corrida multiplicaba por cuatro el peso del JSON
   * que la pantalla se descarga. Van aquí, indexadas por agente.
   */
  benchmarkCurvas: Record<string, Array<{ fecha: string; valor: number }>>
  variantes: VarianteOpciones[]
}

export const RESUMEN_OPCIONES = datos as unknown as ResumenOpciones

/** Busca una corrida por su identificador. */
export function varianteOpciones(id: string): VarianteOpciones | undefined {
  return RESUMEN_OPCIONES.variantes.find(v => v.id === id)
}
