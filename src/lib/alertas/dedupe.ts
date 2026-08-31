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
  motivo: 'nuevo' | 'escalada' | 'en-enfriamiento' | 'tope-horario'
}

export const COOLDOWN_MIN_POR_DEFECTO = 45
export const MAX_MSG_HORA_POR_DEFECTO = 6

export function cooldownMin(): number {
  const n = Number(process.env.ALERTAS_COOLDOWN_MIN)
  return Number.isFinite(n) && n >= 0 ? n : COOLDOWN_MIN_POR_DEFECTO
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
}): DecisionEnvio {
  const {
    eventoKey,
    severidad,
    estado,
    enviadosUltimaHora,
    ahora = new Date(),
    cooldownMinutos = cooldownMin(),
    maxPorHora = maxMensajesHora(),
  } = params

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
