/**
 * Orquestación del sistema de alerta temprana.
 *
 * Los scripts del cron solo eligen qué ciclo ejecutar; toda la decisión vive
 * aquí para poder leerla y probarla como código normal del repo.
 *
 * Regla común a los cuatro ciclos: nada de lo que falle puede impedir el resto.
 * Si Yahoo no cotiza la plata, sale la alerta del oro; si el envío falla, la
 * señal se guarda igual con el error, porque el registro es lo que permite
 * saber después qué se perdió.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { atr as calcularAtr } from '@/lib/alertas/atr'
import { calcularNivel } from '@/lib/alertas/niveles'
import { cotizarVarios, type CotizacionActivo } from '@/lib/alertas/precios'
import { simbolosDe, type SimboloAlerta } from '@/lib/alertas/simbolos'
import { clasificarTitulares } from '@/lib/alertas/clasificador'
import { FUENTES_GUERRA, FUENTES_MACRO, leerFuentes, type Titular } from '@/lib/alertas/rss'
import { decidirEnvio } from '@/lib/alertas/dedupe'
import { enviarNexus } from '@/lib/alertas/nexus'
import {
  enviadosUltimaHora,
  estadoDeEvento,
  guardarSnapshot,
  registrarSenal,
  tocarEvento,
  ultimoSnapshot,
  urlsRecientes,
} from '@/lib/alertas/persistencia'
import {
  mensajeAvisoPrevio,
  mensajeDecision,
  mensajeGuerra,
  mensajeMacro,
  mensajeSnapshot,
  type NivelConSimbolo,
} from '@/lib/alertas/mensajes'
import { probabilidadProximaReunion, type ProbabilidadTasas } from '@/lib/alertas/fedwatch'
import { medirDebasement } from '@/lib/alertas/debasement'
import {
  eventoEnCurso,
  formatearFalta,
  hitoAlcanzado,
  proximoEvento,
  type EventoCalendario,
} from '@/lib/alertas/calendario'
import { marketStatus } from '@/lib/market-hours'

export interface OpcionesCiclo {
  /** Calcula y compone el mensaje pero no lo envía ni lo guarda. */
  dryRun?: boolean
  ahora?: Date
}

export interface ResultadoCiclo {
  ciclo: string
  revisados: number
  enviados: number
  omitidos: number
  errores: string[]
  mensajes: string[]
}

const vacio = (ciclo: string): ResultadoCiclo => ({
  ciclo, revisados: 0, enviados: 0, omitidos: 0, errores: [], mensajes: [],
})

/** ATR y nivel de cada activo a partir de una cotización ya descargada. */
function nivelesDesdeCotizaciones(
  cotizaciones: CotizacionActivo[],
  simbolos: SimboloAlerta[],
  direccion: 'buy' | 'sell',
): { niveles: NivelConSimbolo[]; faltantes: string[] } {
  const niveles: NivelConSimbolo[] = []
  const faltantes: string[] = []

  for (const simbolo of simbolos) {
    const cot = cotizaciones.find((c) => c.ticker === simbolo.ticker)
    if (!cot) { faltantes.push(simbolo.ticker); continue }

    const nivel = calcularNivel(direccion, cot.precio, calcularAtr(cot.velas, 14), simbolo)
    if (!nivel) { faltantes.push(simbolo.ticker); continue }

    niveles.push({ simbolo, nivel })
  }

  return { niveles, faltantes }
}

/** Probabilidad de la próxima reunión, tolerando el fallo: es un adorno útil, no el aviso. */
async function probabilidadOpcional(errores: string[]): Promise<ProbabilidadTasas | null> {
  try {
    return await probabilidadProximaReunion()
  } catch (e) {
    errores.push(`fedwatch: ${(e as Error).message}`)
    return null
  }
}

/**
 * Envía y registra una señal.
 *
 * El orden importa: primero se envía, luego se guarda con el resultado. Al
 * revés se podría quedar marcada como enviada una alerta que nunca salió.
 */
async function despachar(params: {
  admin: SupabaseClient
  dryRun: boolean
  mensaje: string
  senal: Parameters<typeof registrarSenal>[1]
  estadoPrevio: Parameters<typeof tocarEvento>[3]
  resultado: ResultadoCiclo
}): Promise<void> {
  const { admin, dryRun, mensaje, senal, estadoPrevio, resultado } = params
  resultado.mensajes.push(mensaje)

  if (dryRun) { resultado.enviados++; return }

  const envio = await enviarNexus(mensaje, senal.tipo)
  if (!envio.ok) resultado.errores.push(`envío: ${envio.error}`)

  await registrarSenal(admin, {
    ...senal,
    mensaje,
    enviadoAt: envio.ok ? new Date().toISOString() : null,
    errorEnvio: envio.error,
  })
  await tocarEvento(admin, senal.eventoKey, senal.severidad, estadoPrevio)

  if (envio.ok) resultado.enviados++
  else resultado.omitidos++
}

// ── Ciclo 1: escalada Rusia–OTAN ────────────────────────────────────────────

export async function cicloGuerra(
  admin: SupabaseClient,
  opciones: OpcionesCiclo = {},
): Promise<ResultadoCiclo> {
  const { dryRun = false, ahora = new Date() } = opciones
  const resultado = vacio('guerra')

  const titulares = await leerFuentes(FUENTES_GUERRA, 180)
  const yaVistas = dryRun ? new Set<string>() : await urlsRecientes(admin, 24)
  const nuevos = titulares.filter((t) => !yaVistas.has(t.url))
  resultado.revisados = nuevos.length
  if (!nuevos.length) return resultado

  const { clasificados, errores } = await clasificarTitulares(nuevos, 'guerra', 12)
  resultado.errores.push(...errores)

  const relevantes = clasificados
    .filter((t) => t.clasificacion.relevante)
    .sort((a, b) => b.clasificacion.severidad - a.clasificacion.severidad)

  if (!relevantes.length) return resultado

  const simbolos = simbolosDe('guerra')
  const { cotizaciones, errores: erroresPrecio } = await cotizarVarios(simbolos.map((s) => s.ticker))
  resultado.errores.push(...erroresPrecio)
  const { niveles, faltantes } = nivelesDesdeCotizaciones(cotizaciones, simbolos, 'buy')
  const mercadoAbierto = marketStatus(ahora).abierto

  for (const titular of relevantes) {
    const { clasificacion } = titular
    const estado = dryRun ? null : await estadoDeEvento(admin, clasificacion.eventoKey)
    const enviados = dryRun ? 0 : await enviadosUltimaHora(admin, ahora)

    const decision = decidirEnvio({
      eventoKey: clasificacion.eventoKey,
      severidad: clasificacion.severidad,
      estado,
      enviadosUltimaHora: enviados,
      ahora,
    })

    if (!decision.enviar) { resultado.omitidos++; continue }

    const principal = niveles[0]
    await despachar({
      admin,
      dryRun,
      mensaje: mensajeGuerra({ titular, clasificacion, niveles, mercadoAbierto, faltantes }),
      senal: {
        tipo: 'guerra',
        severidad: clasificacion.severidad,
        eventoKey: clasificacion.eventoKey,
        titular: titular.titulo,
        url: titular.url,
        fuente: titular.fuente,
        resumen: clasificacion.resumen,
        publishedAt: titular.publicadoAt,
        simbolo: principal?.simbolo.ticker ?? null,
        precioRef: principal?.nivel.precio ?? null,
        direccion: 'buy',
        nivelStop: principal?.nivel.nivel ?? null,
        atr: principal?.nivel.atr ?? null,
        mercadoAbierto,
        mensaje: '',
        payload: {
          motivoEnvio: decision.motivo,
          motivoLlm: clasificacion.motivo,
          niveles: niveles.map((n) => ({ ticker: n.simbolo.ticker, ...n.nivel })),
          faltantes,
        },
      },
      estadoPrevio: estado,
      resultado,
    })
  }

  // El mensaje real se compone arriba; se refleja en la fila para poder releer
  // exactamente lo que llegó al teléfono.
  return resultado
}

// ── Ciclo 2: pulso FED vs Tesoro ────────────────────────────────────────────

export async function cicloMacro(
  admin: SupabaseClient,
  opciones: OpcionesCiclo = {},
): Promise<ResultadoCiclo> {
  const { dryRun = false, ahora = new Date() } = opciones
  const resultado = vacio('fed_tesoro')

  const titulares = await leerFuentes(FUENTES_MACRO, 240)
  const yaVistas = dryRun ? new Set<string>() : await urlsRecientes(admin, 48)
  const nuevos = titulares.filter((t) => !yaVistas.has(t.url))
  resultado.revisados = nuevos.length
  if (!nuevos.length) return resultado

  const { clasificados, errores } = await clasificarTitulares(nuevos, 'fed_tesoro', 10)
  resultado.errores.push(...errores)

  const relevantes = clasificados
    .filter((t) => t.clasificacion.relevante)
    .sort((a, b) => b.clasificacion.severidad - a.clasificacion.severidad)
  if (!relevantes.length) return resultado

  const probabilidad = await probabilidadOpcional(resultado.errores)

  for (const titular of relevantes) {
    const { clasificacion } = titular
    const estado = dryRun ? null : await estadoDeEvento(admin, clasificacion.eventoKey)
    const enviados = dryRun ? 0 : await enviadosUltimaHora(admin, ahora)

    const decision = decidirEnvio({
      eventoKey: clasificacion.eventoKey,
      severidad: clasificacion.severidad,
      estado,
      enviadosUltimaHora: enviados,
      ahora,
    })
    if (!decision.enviar) { resultado.omitidos++; continue }

    await despachar({
      admin,
      dryRun,
      mensaje: mensajeMacro({ titular, clasificacion, probabilidad }),
      senal: {
        tipo: 'fed_tesoro',
        severidad: clasificacion.severidad,
        eventoKey: clasificacion.eventoKey,
        titular: titular.titulo,
        url: titular.url,
        fuente: titular.fuente,
        resumen: clasificacion.resumen,
        publishedAt: titular.publicadoAt,
        mensaje: '',
        payload: {
          motivoEnvio: decision.motivo,
          motivoLlm: clasificacion.motivo,
          probabilidad,
        },
      },
      estadoPrevio: estado,
      resultado,
    })
  }

  return resultado
}

// ── Ciclo 3: foto macro (FedWatch + debasement) ─────────────────────────────

/** Horas de Ecuador en las que sale el resumen aunque no haya novedad. */
export const HORAS_DIGEST = [8, 16]

/** Salto de probabilidad que justifica un aviso fuera de esas horas. */
export const SALTO_PROB_RELEVANTE = 10

export function horaEnEcuador(ahora: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil', hour: '2-digit', hour12: false,
  }).format(ahora)) % 24
}

export function tocaDigest(params: {
  ahora: Date
  ultimoTomadoAt: string | null
  probSubidaActual: number
  probSubidaPrevia: number | null
}): { enviar: boolean; motivo: string } {
  const { ahora, ultimoTomadoAt, probSubidaActual, probSubidaPrevia } = params

  if (probSubidaPrevia != null && Math.abs(probSubidaActual - probSubidaPrevia) >= SALTO_PROB_RELEVANTE) {
    return { enviar: true, motivo: 'salto-probabilidad' }
  }

  const hora = horaEnEcuador(ahora)
  if (!HORAS_DIGEST.includes(hora)) return { enviar: false, motivo: 'fuera-de-horario' }

  // Una sola vez por franja: si la última foto ya es de esta misma hora local,
  // el resumen ya salió.
  if (ultimoTomadoAt) {
    const previa = new Date(ultimoTomadoAt)
    const mismaHora = horaEnEcuador(previa) === hora
    const mismoDia = previa.toISOString().slice(0, 10) === ahora.toISOString().slice(0, 10)
    if (mismaHora && mismoDia) return { enviar: false, motivo: 'ya-enviado-esta-franja' }
  }

  return { enviar: true, motivo: 'digest-programado' }
}

export async function cicloSnapshot(
  admin: SupabaseClient,
  opciones: OpcionesCiclo & { forzar?: boolean } = {},
): Promise<ResultadoCiclo> {
  const { dryRun = false, ahora = new Date(), forzar = false } = opciones
  const resultado = vacio('snapshot')

  const probabilidad = await probabilidadProximaReunion(ahora)
  const debasement = await medirDebasement(ahora)
  resultado.errores.push(...debasement.errores)
  resultado.revisados = 1

  const previo = dryRun ? null : await ultimoSnapshot(admin)
  if (!dryRun) await guardarSnapshot(admin, probabilidad, debasement.metricas)

  const decision = forzar
    ? { enviar: true, motivo: 'forzado' }
    : tocaDigest({
        ahora,
        ultimoTomadoAt: previo?.tomadoAt ?? null,
        probSubidaActual: probabilidad.probSubida,
        probSubidaPrevia: previo?.probSubida ?? null,
      })

  if (!decision.enviar) { resultado.omitidos++; return resultado }

  const proxima = proximoEvento('fomc', ahora)
  const mensaje = mensajeSnapshot({
    probabilidad,
    metricas: debasement.metricas,
    proximaReunionFaltaMin: proxima?.faltanMin ?? null,
  })
  resultado.mensajes.push(mensaje)

  if (dryRun) { resultado.enviados++; return resultado }

  const envio = await enviarNexus(mensaje, 'debasement')
  if (!envio.ok) resultado.errores.push(`envío: ${envio.error}`)

  await registrarSenal(admin, {
    tipo: 'debasement',
    severidad: 1,
    eventoKey: `snapshot-${ahora.toISOString().slice(0, 13)}`,
    titular: `Pulso macro · subida ${probabilidad.probSubida}%`,
    resumen: probabilidad.nota,
    mensaje,
    payload: { probabilidad, metricas: debasement.metricas, motivoEnvio: decision.motivo },
    enviadoAt: envio.ok ? new Date().toISOString() : null,
    errorEnvio: envio.error,
  })

  if (envio.ok) resultado.enviados++
  else resultado.omitidos++

  return resultado
}

// ── Ciclo 4: calendario de tasas ────────────────────────────────────────────

/** Busca el comunicado oficial entre los titulares recientes de la Fed. */
export async function buscarComunicado(evento: EventoCalendario): Promise<Titular | null> {
  const titulares = await leerFuentes(FUENTES_MACRO, 60)
  const patron = evento.tipo === 'fomc'
    ? /federal reserve|fomc|monetary policy|tasa|rate/i
    : /consumer price|cpi|inflaci/i

  return titulares.find((t) => patron.test(t.titulo)) ?? null
}

export async function cicloCalendario(
  admin: SupabaseClient,
  opciones: OpcionesCiclo & { toleranciaMin?: number } = {},
): Promise<ResultadoCiclo> {
  const { dryRun = false, ahora = new Date(), toleranciaMin = 2 } = opciones
  const resultado = vacio('calendario')

  // 1. Publicación en curso: es lo urgente, va primero.
  const enCurso = eventoEnCurso(ahora, 30)
  if (enCurso) {
    const eventoKey = `publicacion-${enCurso.tipo}-${enCurso.fechaET}`
    const estado = dryRun ? null : await estadoDeEvento(admin, eventoKey)
    resultado.revisados++

    if (estado) {
      resultado.omitidos++
    } else {
      const simbolos = simbolosDe('tasas')
      const { cotizaciones, errores } = await cotizarVarios(simbolos.map((s) => s.ticker))
      resultado.errores.push(...errores)

      const venta = nivelesDesdeCotizaciones(cotizaciones, simbolos, 'sell')
      const compra = nivelesDesdeCotizaciones(cotizaciones, simbolos, 'buy')
      const probabilidad = await probabilidadOpcional(resultado.errores)

      let comunicado: Titular | null = null
      try {
        comunicado = await buscarComunicado(enCurso)
      } catch (e) {
        resultado.errores.push(`comunicado: ${(e as Error).message}`)
      }

      await despachar({
        admin,
        dryRun,
        mensaje: mensajeDecision({
          evento: enCurso,
          nivelesVenta: venta.niveles,
          nivelesCompra: compra.niveles,
          probabilidad,
          titularComunicado: comunicado,
        }),
        senal: {
          tipo: 'tasas',
          severidad: 5,
          eventoKey,
          titular: `${enCurso.etiqueta} · publicación`,
          url: comunicado?.url ?? null,
          fuente: comunicado?.fuente ?? null,
          mercadoAbierto: marketStatus(ahora).abierto,
          mensaje: '',
          payload: {
            nivelesVenta: venta.niveles.map((n) => ({ ticker: n.simbolo.ticker, ...n.nivel })),
            nivelesCompra: compra.niveles.map((n) => ({ ticker: n.simbolo.ticker, ...n.nivel })),
            probabilidad,
          },
        },
        estadoPrevio: null,
        resultado,
      })
    }
  }

  // 2. Aviso anticipado del próximo evento.
  const proximo = proximoEvento('todos', ahora)
  if (!proximo) return resultado

  const hito = hitoAlcanzado(proximo.faltanMin, toleranciaMin)
  if (hito == null) return resultado

  const eventoKey = `aviso-${proximo.tipo}-${proximo.fechaET}-h${hito}`
  const estado = dryRun ? null : await estadoDeEvento(admin, eventoKey)
  resultado.revisados++
  if (estado) { resultado.omitidos++; return resultado }

  const probabilidad = await probabilidadOpcional(resultado.errores)

  await despachar({
    admin,
    dryRun,
    mensaje: mensajeAvisoPrevio({ evento: proximo, faltanMin: proximo.faltanMin, probabilidad }),
    senal: {
      tipo: 'tasas',
      severidad: hito === 15 ? 3 : 2,
      eventoKey,
      titular: `${proximo.etiqueta} en ${formatearFalta(proximo.faltanMin)}`,
      mensaje: '',
      payload: { hito, probabilidad },
    },
    estadoPrevio: null,
    resultado,
  })

  return resultado
}
