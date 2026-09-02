/**
 * Control de repetición de avisos.
 *
 * Un solo hecho —un dron derribado en Polonia— genera decenas de titulares en
 * media hora. Sin freno, el teléfono se vuelve inútil justo el día en que hay
 * que mirarlo. Reglas:
 *
 *  1. Un mismo `eventoKey` no vuelve a avisar antes del enfriamiento.
 *  2. Salvo que suba de severidad: si el incidente escala, eso sí es noticia.
 *  3. Tope global por hora, para que un día caótico no sepulte lo importante.
 *
 * La decisión es una función pura sobre el estado leído de la base; quien
 * consulta y escribe es el script, para poder probar esto sin red.
 */

export interface EstadoEvento {
  eventoKey: string
  ultimaVez: string
  maxSeveridad: number
}

export interface DecisionEnvio {
  enviar: boolean
  motivo: 'nuevo' | 'escalada' | 'en-enfriamiento' | 'tope-horario' | 'bajo-umbral'
}

export const COOLDOWN_MIN_POR_DEFECTO = 45
export const MAX_MSG_HORA_POR_DEFECTO = 6

/**
 * Peldaño por debajo del cual el hecho se registra pero no suena el teléfono.
 *
 * Un 1 o un 2 son contexto, no aviso: se guardan en `alert_signals` para poder
 * medir después qué se dejó pasar, pero interrumpir a las tres de la mañana por
 * una declaración tensa es lo que enseña a ignorar el canal.
 */
export const SEVERIDAD_MINIMA_POR_DEFECTO = 3

export function cooldownMin(): number {
  const n = Number(process.env.ALERTAS_COOLDOWN_MIN)
  return Number.isFinite(n) && n >= 0 ? n : COOLDOWN_MIN_POR_DEFECTO
}

export function severidadMinimaEnvio(): number {
  const n = Number(process.env.ALERTAS_SEVERIDAD_MINIMA)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : SEVERIDAD_MINIMA_POR_DEFECTO
}

export function maxMensajesHora(): number {
  const n = Number(process.env.ALERTAS_MAX_MSG_HORA)
  return Number.isFinite(n) && n > 0 ? n : MAX_MSG_HORA_POR_DEFECTO
}

export function decidirEnvio(params: {
  eventoKey: string
  severidad: number
  estado: EstadoEvento | null
  enviadosUltimaHora: number
  ahora?: Date
  cooldownMinutos?: number
  maxPorHora?: number
  severidadMinima?: number
}): DecisionEnvio {
  const {
    eventoKey,
    severidad,
    estado,
    enviadosUltimaHora,
    ahora = new Date(),
    cooldownMinutos = cooldownMin(),
    maxPorHora = maxMensajesHora(),
    severidadMinima = severidadMinimaEnvio(),
  } = params

  // El suelo manda sobre todo lo demás: un hecho menor no despierta a nadie
  // aunque sea nuevo y aunque quede cupo en la hora.
  if (severidad < severidadMinima) return { enviar: false, motivo: 'bajo-umbral' }

  const esNuevo = !estado || estado.eventoKey !== eventoKey
  const escala = !esNuevo && severidad > estado!.maxSeveridad

  // El tope horario cede ante una escalada: si el suceso empeora, el aviso sale
  // aunque ya se hayan gastado los mensajes de la hora.
  if (enviadosUltimaHora >= maxPorHora && !escala) {
    return { enviar: false, motivo: 'tope-horario' }
  }

  if (esNuevo) return { enviar: true, motivo: 'nuevo' }
  if (escala) return { enviar: true, motivo: 'escalada' }

  const transcurridoMin = (ahora.getTime() - Date.parse(estado!.ultimaVez)) / 60_000
  if (Number.isNaN(transcurridoMin) || transcurridoMin >= cooldownMinutos) {
    return { enviar: true, motivo: 'nuevo' }
  }

  return { enviar: false, motivo: 'en-enfriamiento' }
}
