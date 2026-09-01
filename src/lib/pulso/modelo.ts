/**
 * Regresión logística para las curvas de riesgo.
 *
 * Escrita a mano y no traída de una librería por dos razones. El repositorio no
 * tiene ninguna de clasificación, y añadir una por doscientas líneas de
 * descenso de gradiente sería peor negocio que mantenerlas. Y sobre todo:
 * necesitamos los coeficientes en claro para guardarlos en la base y para poder
 * decir en pantalla qué está empujando la probabilidad de hoy. Un modelo que no
 * se puede explicar no se puede defender cuando se equivoca.
 *
 * El honesto no es el modelo que más acierta, es el que se calla cuando no
 * sabe: por eso `entrenar` devuelve las métricas fuera de muestra junto a los
 * coeficientes, y quien llama decide si eso merece activarse.
 */

import { timeSeriesSplit } from '@/lib/causal/backtest'

export interface ModeloLogistico {
  features: string[]
  /** Uno por feature, en el mismo orden. */
  pesos: number[]
  sesgo: number
  /** Media y desviación con las que se estandarizó cada feature al entrenar. */
  medias: number[]
  desviaciones: number[]
}

export interface Metricas {
  auc: number
  brier: number
  tasaBase: number
  nEntrenamiento: number
  nPrueba: number
  folds: number
}

export interface OpcionesEntrenamiento {
  tasaAprendizaje?: number
  iteraciones?: number
  /** Regularización L2. Con pocas filas y muchas features, sin esto se memoriza. */
  l2?: number
}

export function sigmoide(z: number): number {
  // Se acota el exponente: con |z| grande, `Math.exp` desborda y la
  // probabilidad sale NaN en vez de pegarse a 0 o a 1 como debe.
  if (z >= 0) return 1 / (1 + Math.exp(-Math.min(z, 40)))
  const e = Math.exp(Math.max(z, -40))
  return e / (1 + e)
}

function estandarizadores(X: number[][]): { medias: number[]; desviaciones: number[] } {
  const nCols = X[0]?.length ?? 0
  const medias: number[] = []
  const desviaciones: number[] = []

  for (let j = 0; j < nCols; j++) {
    const col = X.map((fila) => fila[j])
    const m = col.reduce((s, v) => s + v, 0) / col.length
    const varianza = col.reduce((s, v) => s + (v - m) ** 2, 0) / col.length
    // Una feature constante tendría desviación cero y dividir por ella daría
    // infinito; se deja en 1 y el peso se encarga de anularla.
    medias.push(m)
    desviaciones.push(Math.sqrt(varianza) || 1)
  }

  return { medias, desviaciones }
}

function estandarizar(fila: number[], medias: number[], desviaciones: number[]): number[] {
  return fila.map((v, j) => (v - medias[j]) / desviaciones[j])
}

/**
 * Descenso de gradiente sobre la verosimilitud logística, con L2.
 *
 * El sesgo no se regulariza: penalizarlo empujaría la probabilidad base hacia
 * 0.5 aunque los datos digan que el suceso ocurre un 12% de los días.
 */
export function entrenarLogistica(
  X: number[][],
  y: number[],
  features: string[],
  { tasaAprendizaje = 0.1, iteraciones = 2000, l2 = 0.01 }: OpcionesEntrenamiento = {},
): ModeloLogistico {
  if (!X.length || X.length !== y.length) {
    throw new Error('entrenarLogistica: X e y tienen que tener la misma longitud y no estar vacíos')
  }

  const { medias, desviaciones } = estandarizadores(X)
  const Z = X.map((fila) => estandarizar(fila, medias, desviaciones))

  const n = Z.length
  const d = Z[0].length
  const pesos = new Array<number>(d).fill(0)
  let sesgo = 0

  for (let iter = 0; iter < iteraciones; iter++) {
    const gradPesos = new Array<number>(d).fill(0)
    let gradSesgo = 0

    for (let i = 0; i < n; i++) {
      const p = sigmoide(Z[i].reduce((s, v, j) => s + v * pesos[j], sesgo))
      const err = p - y[i]
      for (let j = 0; j < d; j++) gradPesos[j] += err * Z[i][j]
      gradSesgo += err
    }

    for (let j = 0; j < d; j++) {
      pesos[j] -= tasaAprendizaje * (gradPesos[j] / n + l2 * pesos[j])
    }
    sesgo -= tasaAprendizaje * (gradSesgo / n)
  }

  return { features, pesos, sesgo, medias, desviaciones }
}

/** Probabilidad que el modelo asigna a una fila cruda (sin estandarizar). */
export function predecir(modelo: ModeloLogistico, fila: number[]): number {
  const z = estandarizar(fila, modelo.medias, modelo.desviaciones)
    .reduce((s, v, j) => s + v * modelo.pesos[j], modelo.sesgo)
  return sigmoide(z)
}

/**
 * Aportación de cada feature a la probabilidad de hoy.
 *
 * Es lo que permite decir «la probabilidad ha subido por las búsquedas en
 * Polonia», en vez de enseñar un número sin origen.
 */
export function contribuciones(modelo: ModeloLogistico, fila: number[]): Record<string, number> {
  const z = estandarizar(fila, modelo.medias, modelo.desviaciones)
  return Object.fromEntries(modelo.features.map((f, j) => [f, z[j] * modelo.pesos[j]]))
}

/**
 * Área bajo la curva ROC, por el equivalente de Mann–Whitney: la probabilidad
 * de que un día con suceso puntúe más alto que uno sin él.
 *
 * Devuelve 0.5 —el valor de la moneda al aire— cuando todos los días son
 * iguales, porque ahí no hay nada que discriminar.
 */
export function auc(y: number[], p: number[]): number {
  const positivos = p.filter((_, i) => y[i] === 1)
  const negativos = p.filter((_, i) => y[i] === 0)
  if (!positivos.length || !negativos.length) return 0.5

  let suma = 0
  for (const pp of positivos) {
    for (const pn of negativos) {
      suma += pp > pn ? 1 : pp === pn ? 0.5 : 0
    }
  }
  return suma / (positivos.length * negativos.length)
}

/** Error cuadrático medio de la probabilidad. Premia estar calibrado, no solo ordenar bien. */
export function brier(y: number[], p: number[]): number {
  if (!y.length) return 1
  return y.reduce((s, yi, i) => s + (p[i] - yi) ** 2, 0) / y.length
}

export interface Entrenamiento {
  modelo: ModeloLogistico
  metricas: Metricas
}

/** Por debajo de esto no hay modelo: hay una anécdota con coeficientes. */
export const MINIMO_DIAS = 60

export interface OpcionesEvaluacion extends OpcionesEntrenamiento {
  nSplits?: number
  /**
   * Días que se saltan entre entrenamiento y prueba.
   *
   * La etiqueta de mercado mira cinco sesiones hacia delante, así que sin este
   * hueco el último día de entrenamiento ya sabe lo que pasó en el primero de
   * prueba. Es el mismo embargo que usa el módulo causal.
   */
  embargo?: number
}

/**
 * Entrena con todo y mide fuera de muestra con validación walk-forward.
 *
 * Se devuelven las dos cosas juntas a propósito: el modelo que se guarda es el
 * entrenado con la serie entera —usar menos datos de los disponibles sería
 * tirar información— pero las métricas que lo acompañan son las de los folds,
 * donde el modelo no había visto el futuro.
 */
export function entrenarYEvaluar(
  X: number[][],
  y: number[],
  features: string[],
  opciones: OpcionesEvaluacion = {},
): Entrenamiento {
  const { nSplits = 4, embargo = 5, ...entrenamiento } = opciones

  if (X.length < MINIMO_DIAS) {
    throw new Error(`entrenarYEvaluar: hacen falta ${MINIMO_DIAS} días y hay ${X.length}`)
  }

  const folds = timeSeriesSplit(X.length, nSplits, embargo)
  const yFuera: number[] = []
  const pFuera: number[] = []

  for (const { trainIdx, testIdx } of folds) {
    const yTrain = trainIdx.map((i) => y[i])
    // Un fold sin ningún suceso no puede enseñar nada sobre los sucesos.
    if (yTrain.every((v) => v === yTrain[0])) continue

    const parcial = entrenarLogistica(trainIdx.map((i) => X[i]), yTrain, features, entrenamiento)
    for (const i of testIdx) {
      yFuera.push(y[i])
      pFuera.push(predecir(parcial, X[i]))
    }
  }

  return {
    modelo: entrenarLogistica(X, y, features, entrenamiento),
    metricas: {
      auc: auc(yFuera, pFuera),
      brier: brier(yFuera, pFuera),
      tasaBase: y.reduce((s, v) => s + v, 0) / y.length,
      nEntrenamiento: X.length,
      nPrueba: yFuera.length,
      folds: folds.length,
    },
  }
}

/**
 * Si el modelo nuevo merece sustituir al que está en pie.
 *
 * Un AUC por debajo de 0.55 es una moneda al aire con pretensiones y no se
 * activa aunque no haya nada mejor: es preferible una pantalla que dice
 * «calibrando» a una probabilidad que nadie debería usar.
 */
export function mereceActivarse(nuevas: Metricas, vigentes: Metricas | null): boolean {
  if (nuevas.nPrueba < 20 || nuevas.auc < 0.55) return false
  if (!vigentes) return true
  return nuevas.auc > vigentes.auc
}
