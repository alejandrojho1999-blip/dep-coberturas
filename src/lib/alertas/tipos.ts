/**
 * Forma de las filas de alerta tal y como las devuelve la API.
 *
 * Vive aparte de los módulos del motor porque la interfaz la importa desde el
 * navegador, y esos módulos arrastran `fetch` de Yahoo, claves de FRED y el
 * cliente de servicio de Supabase.
 */

export interface NivelSerializado {
  ticker: string
  direccion: 'buy' | 'sell'
  precio: number
  nivel: number
  atr: number
  k: number
  distanciaPct: number
}

export interface SenalFila {
  id: string
  tipo: 'guerra' | 'fed_tesoro' | 'tasas' | 'debasement'
  severidad: number
  evento_key: string
  titular: string
  url: string | null
  fuente: string | null
  resumen: string | null
  published_at: string | null
  simbolo: string | null
  precio_ref: number | null
  direccion: 'buy' | 'sell' | null
  nivel_stop: number | null
  atr: number | null
  mercado_abierto: boolean | null
  mensaje: string
  payload: {
    niveles?: NivelSerializado[]
    nivelesVenta?: NivelSerializado[]
    nivelesCompra?: NivelSerializado[]
    motivoEnvio?: string
    motivoLlm?: string
    [k: string]: unknown
  }
  /** El puente aceptó el mensaje. No implica entrega: ver `canal_estado`. */
  aceptado_at: string | null
  canal_estado: 'vivo' | 'caido' | 'desconocido' | null
  canal_detalle: string | null
  error_envio: string | null
  created_at: string
}

export interface MacroFila {
  id: string
  tomado_at: string
  reunion_ref: string | null
  contrato: string | null
  precio_contrato: number | null
  tasa_actual: number | null
  tasa_implicita: number | null
  prob_subida: number | null
  prob_mantener: number | null
  prob_bajada: number | null
  aproximado: boolean
  debasement: {
    metricas?: Array<{
      clave: string
      etiqueta: string
      valor: number
      unidad: string
      var12mPct: number | null
      fecha: string
    }>
  }
  nota: string | null
}

export interface RespuestaAlertas {
  senales: SenalFila[]
  macro: MacroFila[]
}

export const ETIQUETA_TIPO: Record<SenalFila['tipo'], string> = {
  guerra: 'Rusia–OTAN',
  fed_tesoro: 'Fed vs Tesoro',
  tasas: 'Tasas EEUU',
  debasement: 'Debasement',
}
