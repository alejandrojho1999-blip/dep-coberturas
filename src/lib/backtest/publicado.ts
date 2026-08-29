/**
 * Resumen publicado del backtest de los agentes de acciones.
 *
 * `data/backtest/` no se versiona: son ~324 MB de caché regenerable y los
 * `resultados-*.json` que produce el orquestador pesan cientos de kilobytes
 * cada uno. La página `/agentes/backtest` no puede depender de ellos, así que
 * `scripts/backtest/publicar-resumen.mts` destila lo que la interfaz necesita
 * en `resumen-publicado.json`, que sí entra en el repositorio.
 *
 * Regla: aquí no se recalcula nada. Todas las cifras salen tal cual del
 * backtest; si un número de esta pantalla no cuadra con su informe, el fallo
 * está en el script de publicación, no en un ajuste de presentación.
 */
import type { PuntoCurva, Universo } from './types'
import datos from './resumen-publicado.json'

/** Métricas de una curva de resultado, ya comparada contra su benchmark. */
export interface MetricasPublicadas {
  nPeriodos: number
  retornoTotal: number
  cagr: number
  volatilidadAnual: number
  sharpe: number
  maxDrawdown: number
  /** Exceso medio mensual sobre el benchmark. */
  retornoActivoMedio: number
  trackingError: number
  informationRatio: number
  beta: number
  alphaAnual: number
  tStat: number
  pValor: number
  nOperaciones: number
  hitRate: number
  posicionesMedias: number
}

/** Un índice de referencia, sin métricas relativas: es la vara de medir. */
export interface IndicePublicado {
  ticker: string
  retornoTotal: number
  cagr: number
  volatilidadAnual: number
  sharpe: number
  maxDrawdown: number
}

/** Corte de una variante: cagr, sharpe e IR bastan para compararla. */
export interface CorteMetricas {
  cagr: number
  sharpe: number
  informationRatio: number
}

export interface SubPeriodoPublicado {
  nombre: string
  nPeriodos: number
  /** `null` cuando el tramo cae fuera de la ventana con datos utilizables. */
  retornoAcumulado: number | null
  retornoActivoMedio: number | null
}

export interface VariantePublicada {
  /** Identificador de la variante: `peter`, `peter-lynch`, `small`, `small-lynch`. */
  id: string
  agente: string
  universo: Universo
  capas: string
  capasDescripcion: string
  /** Fecha de la ejecución que produjo estas cifras. */
  generado: string

  muestra: {
    tickersDeclarados: number
    tickersConDatos: number
    tickersSinPrecios: number
    sesgoSupervivenciaPct: number
    medianaEjerciciosConDatos: number
    desde: string
    hasta: string
    nRebalanceos: number
    mesesInicialesEnLiquidez: number
  }

  base: MetricasPublicadas
  benchmark: IndicePublicado
  /**
   * Mercado amplio como coste de oportunidad. Es `null` en los agentes de gran
   * capitalización, donde el benchmark ya es el mercado amplio y repetirlo
   * sugeriría dos varas de medir donde solo hay una.
   */
  mercadoAmplio: IndicePublicado | null

  ventaja: {
    tStat: number
    pValor: number
    bootstrapPValor: number
    deflatedSharpeProbabilidad: number
    sharpeEsperadoPorAzar: number
    nConfiguracionesProbadas: number
  }

  control: {
    nCarteras: number
    cagrBase: number
    cagrControlMediano: number
    percentil: number
  }

  subperiodos: SubPeriodoPublicado[]
  /** Qué aporta cada capa del embudo por separado. */
  porCapa: Record<string, CorteMetricas>
  /** Qué pasa al retirar un criterio del screener. */
  leaveOneOut: Record<string, CorteMetricas>
  /** Variantes de robustez: sin costes, ponderación alternativa, umbrales… */
  robustez: Record<string, CorteMetricas>

  curvas: {
    cartera: PuntoCurva[]
    benchmark: PuntoCurva[]
    mercadoAmplio: PuntoCurva[] | null
  }

  paridad: {
    comparados: number
    jaccard: number
    acuerdoPorCriterio: Record<string, number>
  } | null
}

export interface ResumenPublicado {
  /** Cuándo se ejecutó el script de publicación. */
  generado: string
  /** Ventana común a todas las variantes, en meses de rebalanceo. */
  ventana: { desde: string; hasta: string; nMeses: number }
  variantes: VariantePublicada[]
}

export const RESUMEN_BACKTEST = datos as ResumenPublicado

/** Devuelve una variante por su identificador, o `undefined` si no se publicó. */
export function varianteBacktest(id: string): VariantePublicada | undefined {
  return RESUMEN_BACKTEST.variantes.find(v => v.id === id)
}

/**
 * Etiquetas legibles de las claves técnicas que vienen del motor. Se declaran
 * aquí, junto al tipo, para que añadir una variante al backtest obligue a
 * decidir cómo se llama en pantalla.
 */
export const ETIQUETA_CRITERIO: Record<string, string> = {
  pe_historico: 'P/E histórico',
  pe_proyectado: 'P/E proyectado',
  deuda_capital: 'Deuda / capitalización',
  crecimiento_eps: 'Crecimiento del beneficio',
  peg: 'PEG',
  market_cap: 'Capitalización',
}

export const ETIQUETA_CAPA: Record<string, string> = {
  solo_lynch: 'Solo screener Lynch',
  solo_tecnico: 'Solo capas técnicas',
  cascada: 'Cascada completa',
}

export const ETIQUETA_ROBUSTEZ: Record<string, string> = {
  sin_costes: 'Sin costes de transacción',
  ponderado_por_capitalizacion: 'Ponderado por capitalización',
  criterios_limpios_sin_proxy: 'Solo criterios sin proxy',
  umbrales_20pct_mas_laxos: 'Umbrales 20 % más laxos',
  umbrales_20pct_mas_estrictos: 'Umbrales 20 % más estrictos',
}
