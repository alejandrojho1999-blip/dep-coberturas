import type { ReactNode } from 'react'

/**
 * Contrato de la ficha técnica de un agente.
 *
 * La ficha existe para que alguien que no ha visto el código pueda decidir si le
 * asigna capital, así que documenta el método y, con el mismo detalle, lo que
 * todavía no está validado. Un panel que solo enseñara el proceso invitaría a
 * confundir "método ordenado" con "método demostrado", y esa confusión se paga
 * en dinero real.
 *
 * Los umbrales de cada ficha están escritos a mano y deben seguir a su fuente si
 * esta cambia; cada archivo de contenido anota en su cabecera qué archivo manda
 * en cada paso.
 */

/** Un filtro del embudo: una fila de la tabla "EL EMBUDO". */
export interface PasoFicha {
  /** Ordinal de dos cifras: '01', '02'… */
  n: string
  titulo: string
  /** De dónde salen los datos del filtro. */
  fuente: string
  /** Qué mide, en castellano llano. */
  criterio: ReactNode
  /** El corte exacto, tal y como lo aplica el código. */
  umbral: string
}

/** Una promesa sobre el tratamiento de los datos que el código sí cumple. */
export interface GarantiaFicha {
  titulo: string
  detalle: ReactNode
}

/** Una forma concreta de perder dinero con este agente. */
export interface RiesgoFicha {
  titulo: string
  detalle: ReactNode
}

export interface Ficha {
  /** Segunda línea de la cabecera plegable. */
  subtitulo: string
  /** Párrafo de apertura: qué es el agente y cómo está organizado. */
  intro: ReactNode
  pasos: PasoFicha[]
  /** Comentario al pie de la tabla del embudo. Opcional. */
  notaEmbudo?: ReactNode
  cuandoVende: ReactNode
  garantias: GarantiaFicha[]
  /**
   * Solo para los agentes de opciones. Las acciones no pueden expirar sin valor
   * ni acabar en asignación, así que Peter y Small no llevan esta sección.
   */
  riesgos?: RiesgoFicha[]
  /**
   * Párrafos del recuadro de estado de validación. Cada uno lleva un `id`
   * estable en vez de apoyarse en el índice del array.
   */
  validacion: Array<{ id: string; texto: ReactNode }>
  /** Cierre en letra pequeña: cómo leer todo lo anterior. */
  lectura: ReactNode
}
