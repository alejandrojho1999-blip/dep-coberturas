/**
 * Los dos ciclos del modelo: entrenar y predecir.
 *
 * Viven aquí y no en el script del cron porque el script solo debe elegir qué
 * se ejecuta e imprimir el resultado, como ya hace con los ciclos de alertas.
 *
 * El orden dentro de `entrenar` no es casual: primero se construyen los
 * vectores del día, después las etiquetas de los días cuya ventana ya cerró, y
 * solo entonces se entrena. Un día no se puede etiquetar hasta que han pasado
 * las cinco sesiones que mira su etiqueta, así que siempre hay una cola de días
 * recientes con vector y sin etiqueta: eso es correcto, no un hueco.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { cotizar } from '@/lib/alertas/precios'
import { comoFila, construirVectores, FEATURES } from '@/lib/pulso/features'
import { etiquetasGeopoliticas, etiquetasMercado } from '@/lib/pulso/labels'
import {
  contribuciones,
  entrenarYEvaluar,
  mereceActivarse,
  MINIMO_DIAS,
  predecir,
  type Metricas,
  type ModeloLogistico,
} from '@/lib/pulso/modelo'
import {
  etiquetasDe,
  featuresDesde,
  guardarEtiquetas,
  guardarFeatures,
  guardarModelo,
  guardarPrediccion,
  keywordsDesde,
  modeloActivo,
  observacionesDesde,
} from '@/lib/pulso/persistencia'

export type TipoModelo = 'mercado' | 'geopolitico'
export const TIPOS: readonly TipoModelo[] = ['mercado', 'geopolitico'] as const

/** Ventana de historia con la que se trabaja. Un año es lo que da Yahoo de una vez. */
const DIAS_HISTORIA = 365

export interface ResultadoEntrenamiento {
  tipo: TipoModelo
  /** Null cuando todavía no hay días suficientes: el modelo se queda callado. */
  metricas: Metricas | null
  activado: boolean
  diasEtiquetados: number
  faltan: number
  nota: string
}

async function entrenarUno(
  admin: SupabaseClient,
  tipo: TipoModelo,
  vectores: Array<{ dia: string; vector: Record<string, number> }>,
): Promise<ResultadoEntrenamiento> {
  const etiquetas = await etiquetasDe(admin, tipo)

  // Solo sirven los días que tienen las dos cosas.
  const emparejados = vectores
    .filter((v) => etiquetas.has(v.dia))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  const base: Omit<ResultadoEntrenamiento, 'nota'> = {
    tipo,
    metricas: null,
    activado: false,
    diasEtiquetados: emparejados.length,
    faltan: Math.max(0, MINIMO_DIAS - emparejados.length),
  }

  if (emparejados.length < MINIMO_DIAS) {
    return { ...base, nota: `calibrando: faltan ${base.faltan} días etiquetados` }
  }

  const X = emparejados.map((v) => comoFila(v.vector))
  const y = emparejados.map((v) => etiquetas.get(v.dia) as number)

  // Sin variedad en la etiqueta no hay nada que aprender, y el entrenamiento
  // devolvería un modelo que siempre dice lo mismo con aire de certeza.
  if (y.every((v) => v === y[0])) {
    return { ...base, nota: `sin variedad: los ${y.length} días etiquetados valen ${y[0]}` }
  }

  const { modelo, metricas } = entrenarYEvaluar(X, y, [...FEATURES])
  const vigente = await modeloActivo(admin, tipo)
  const metricasVigentes = vigente ? (vigente.metricas as unknown as Metricas) : null
  const activar = mereceActivarse(metricas, metricasVigentes)

  await guardarModelo(
    admin,
    tipo,
    {
      features: modelo.features,
      coeficientes: {
        pesos: modelo.pesos,
        sesgo: modelo.sesgo,
        medias: modelo.medias,
        desviaciones: modelo.desviaciones,
      },
      metricas: metricas as unknown as Record<string, number>,
    },
    activar,
  )

  return {
    ...base,
    metricas,
    activado: activar,
    nota: activar
      ? `activado con AUC ${metricas.auc.toFixed(3)} fuera de muestra`
      : `guardado sin activar: AUC ${metricas.auc.toFixed(3)} no mejora lo vigente`,
  }
}

/**
 * Construye vectores y etiquetas del histórico y reentrena los dos modelos.
 *
 * Se recalcula todo el histórico en cada pasada en lugar de ir añadiendo el
 * último día. Cuesta unos segundos más y evita la clase de error más difícil de
 * detectar aquí: un cambio en la definición de una feature que deja la mitad de
 * la serie calculada con la regla vieja y la otra mitad con la nueva.
 */
export async function cicloEntrenar(admin: SupabaseClient): Promise<{
  vectores: number
  etiquetasMercado: number
  etiquetasGeopoliticas: number
  resultados: ResultadoEntrenamiento[]
}> {
  const observaciones = await observacionesDesde(admin, DIAS_HISTORIA)
  const vectores = construirVectores(observaciones)
  await guardarFeatures(admin, vectores)

  const [spy, vix] = await Promise.all([cotizar('SPY'), cotizar('^VIX')])
  const mercado = etiquetasMercado(spy.velas, vix.velas)
  // Solo se etiquetan días de los que hay vector: etiquetar un día sin
  // observaciones sería enseñar al modelo a predecir desde la nada.
  const diasConVector = new Set(vectores.map((v) => v.dia))
  const mercadoUtil = mercado.filter((e) => diasConVector.has(e.dia))
  await guardarEtiquetas(admin, 'mercado', mercadoUtil)

  const keywords = await keywordsDesde(admin, DIAS_HISTORIA)
  const geopoliticas = etiquetasGeopoliticas([...diasConVector], keywords)
  await guardarEtiquetas(admin, 'geopolitico', geopoliticas)

  const resultados: ResultadoEntrenamiento[] = []
  for (const tipo of TIPOS) resultados.push(await entrenarUno(admin, tipo, vectores))

  return {
    vectores: vectores.length,
    etiquetasMercado: mercadoUtil.length,
    etiquetasGeopoliticas: geopoliticas.length,
    resultados,
  }
}

export interface ResultadoPrediccion {
  tipo: TipoModelo
  dia: string
  probabilidad: number | null
  nota: string
}

function reconstruir(fila: {
  features: string[]
  coeficientes: Record<string, unknown>
}): ModeloLogistico | null {
  const { pesos, sesgo, medias, desviaciones } = fila.coeficientes as {
    pesos?: number[]; sesgo?: number; medias?: number[]; desviaciones?: number[]
  }
  if (!Array.isArray(pesos) || !Array.isArray(medias) || !Array.isArray(desviaciones)) return null
  if (typeof sesgo !== 'number') return null
  return { features: fila.features, pesos, sesgo, medias, desviaciones }
}

/**
 * Probabilidad de hoy con el modelo en pie, para cada tipo de riesgo.
 *
 * Sin modelo activo no se escribe nada. Es la decisión importante de todo el
 * módulo: antes que una probabilidad inventada, una pantalla que dice que
 * todavía está calibrando.
 */
export async function ciclopredecir(admin: SupabaseClient): Promise<ResultadoPrediccion[]> {
  const hoy = new Date().toISOString().slice(0, 10)
  const desde = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString().slice(0, 10)
  const recientes = await featuresDesde(admin, desde)
  const ultima = recientes.at(-1)

  const resultados: ResultadoPrediccion[] = []

  for (const tipo of TIPOS) {
    if (!ultima) {
      resultados.push({ tipo, dia: hoy, probabilidad: null, nota: 'sin vector reciente que puntuar' })
      continue
    }

    const fila = await modeloActivo(admin, tipo)
    const modelo = fila ? reconstruir(fila) : null
    if (!fila || !modelo) {
      resultados.push({ tipo, dia: ultima.dia, probabilidad: null, nota: 'todavía sin modelo activo' })
      continue
    }

    const x = comoFila(ultima.vector)
    const probabilidad = predecir(modelo, x)

    await guardarPrediccion(admin, {
      dia: ultima.dia,
      modelo: tipo,
      probabilidad,
      modelId: fila.id,
      contribuciones: contribuciones(modelo, x),
    })

    resultados.push({
      tipo,
      dia: ultima.dia,
      probabilidad,
      nota: `AUC del modelo ${Number(fila.metricas.auc ?? 0).toFixed(3)}`,
    })
  }

  return resultados
}
