import type { SupabaseClient } from '@supabase/supabase-js'
import { runScreener, type ScreenerResult } from '@/lib/peter-lynch/screener'
import { forecastDeTickers, momentumDeTickers } from './historicos'
import { analizarTicker, apruebaAnalisis, AnalisisError } from './analisis'
import { CATEGORIA_PETER, CATEGORIA_SMALL } from './types'

/**
 * Ejecución de la cascada de Peter y Small contra la base de datos.
 *
 * Es la versión sin sesión de lo que hacían `AgentePeter.tsx` y
 * `AgenteSmall.tsx` a golpe de botón: los mismos cinco pasos, en el mismo
 * orden, con los mismos cortes. Cambia quién dispara y de dónde sale el
 * `user_id`; el camino de los datos es el mismo, o las recomendaciones del cron
 * y las del botón dejarían de ser comparables.
 *
 * La cascada existe para que los pasos caros trabajen sobre listas ya cortas.
 * El orden no es decorativo: el screener es determinista y barato en dinero,
 * el forecast y el momentum solo cuestan cuota de Yahoo, y únicamente el paso 4
 * gasta tokens, sobre lo poco que sobrevivió a los tres filtros anteriores.
 */

export type CascadaCategory = typeof CATEGORIA_PETER | typeof CATEGORIA_SMALL

export const CASCADA_CATEGORIES: readonly CascadaCategory[] = [
  CATEGORIA_PETER,
  CATEGORIA_SMALL,
] as const

export function isCascadaCategory(v: string): v is CascadaCategory {
  return (CASCADA_CATEGORIES as readonly string[]).includes(v)
}

/**
 * Lo que distingue a los dos agentes.
 *
 * Comparten pipeline entero. Solo cambian el universo del screener y el corte
 * de score: Peter exige los seis criterios de Lynch, Small se conforma con
 * cuatro porque con umbrales perfectos la lista de small caps queda vacía.
 */
interface PerfilAgente {
  universe: 'large_cap' | 'small_cap'
  scoreMinimo: number
  etiqueta: string
}

const PERFILES: Record<CascadaCategory, PerfilAgente> = {
  [CATEGORIA_PETER]: { universe: 'large_cap', scoreMinimo: 6, etiqueta: 'AGENTE PETER' },
  [CATEGORIA_SMALL]: { universe: 'small_cap', scoreMinimo: 4, etiqueta: 'AGENTE SMALL' },
}

/** Fallos de 3 señales que disparan la venta de una posición viva. */
const FALLOS_PARA_VENDER = 2

/** Pausa entre llamadas al modelo, para no castigar al proveedor. */
const PAUSA_ENTRE_ANALISIS_MS = 600

/**
 * Tiempo máximo que se dedica al paso 4 antes de cortar por lo sano.
 *
 * El plan Hobby de Vercel mata la función a los 300 s. Medido el 2026-09-06,
 * Small saca 15 candidatos vivos al paso 4 y el screener ya consume 30 s, así
 * que un día con el proveedor lento se pasa del límite. Cortar aquí es mejor
 * que que lo corte la plataforma: lo ya guardado se escribe candidato a
 * candidato, pero un corte externo se lleva la respuesta y el planificador solo
 * ve un error sin saber qué se llegó a hacer.
 *
 * Lo que no se analiza hoy se analizará mañana: el screener es determinista y
 * los fundamentales no cambian de un día para otro.
 */
const PRESUPUESTO_ANALISIS_MS = 210_000

export interface CascadaResult {
  category: CascadaCategory
  /** Candidatos que salieron del screener con score suficiente. */
  candidatos: number
  trasForecast: number
  trasMomentum: number
  aprobadas: number
  /** Recomendaciones nuevas escritas en la tabla. */
  creadas: number
  /** Candidatos que ya tenían una posición viva y no se duplicaron. */
  omitidas: number
  /** Posiciones vivas marcadas como 'Vender' en el paso 0. */
  vendidas: number
  /** Escrituras que la base de datos rechazó. */
  fallidos: number
  /** Candidatos que se quedaron sin analizar por agotarse el presupuesto. */
  truncadas: number
  log: string[]
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

interface PickVivo {
  id: string
  ticker: string
  precio_entrada: number
  estado: string
}

/**
 * Ejecuta la cascada completa de un agente y guarda lo que la supere.
 *
 * El `userId` se pasa siempre explícito y filtra todas las consultas. Con el
 * cliente de servicio no hay RLS que respalde el filtro, así que este parámetro
 * es la única frontera entre cuentas.
 */
export async function ejecutarCascada(
  supabase: SupabaseClient,
  userId: string,
  category: CascadaCategory,
): Promise<CascadaResult> {
  const perfil = PERFILES[category]
  const r: CascadaResult = {
    category, candidatos: 0, trasForecast: 0, trasMomentum: 0,
    aprobadas: 0, creadas: 0, omitidas: 0, vendidas: 0, fallidos: 0,
    truncadas: 0, log: [],
  }
  const arranque = Date.now()
  const log = (m: string) => { r.log.push(m) }

  // ── PASO 0: re-evaluación de posiciones vivas ────────────────────────────
  const { data: picksRaw, error: picksError } = await supabase
    .from('agent_recommendations')
    .select('id, ticker, precio_entrada, estado')
    .eq('user_id', userId)
    .eq('category', category)
    .neq('estado', 'Vender')

  if (picksError) {
    log(`⚠ no se pudieron leer las posiciones vivas: ${picksError.message}`)
    r.fallidos++
  }
  const vivos = (picksRaw ?? []) as PickVivo[]

  // Se piden las señales de las posiciones vivas antes del screener porque la
  // decisión de vender necesita las tres, y el screener es el paso lento.
  let forecastVivos: Record<string, { lastPrice: number; pass: boolean }> = {}
  let momentumVivos: Record<string, { pass: boolean }> = {}
  if (vivos.length) {
    log(`📋 ${vivos.length} posición(es) viva(s): ${vivos.map(p => p.ticker).join(', ')}`)
    const tickersVivos = vivos.map(p => p.ticker)
    const [f, m] = await Promise.all([
      forecastDeTickers(tickersVivos),
      momentumDeTickers(tickersVivos),
    ])
    forecastVivos = f
    momentumVivos = m
  } else {
    log('✓ sin posiciones vivas que re-evaluar')
  }

  // ── PASO 1: screener de Lynch ────────────────────────────────────────────
  let todos: ScreenerResult[]
  try {
    todos = await runScreener(false, perfil.universe)
  } catch (e) {
    log(`✗ screener falló: ${(e as Error).message}`)
    r.fallidos++
    return r
  }

  const candidatos = todos.filter(s => s.score >= perfil.scoreMinimo)
  r.candidatos = candidatos.length
  log(`🔍 screener ${perfil.universe}: ${candidatos.length} con score ≥${perfil.scoreMinimo}/6 de ${todos.length} evaluados`)

  // La venta se decide aquí porque necesita saber si el ticker sigue pasando
  // Lynch, y eso solo se sabe con el screener ya resuelto. Una señal sin datos
  // cuenta como aprobada: una caída de Yahoo no debe vender por accidente.
  const enScreener = new Set(candidatos.map(s => s.ticker))
  for (const pick of vivos) {
    const lynchPass = enScreener.has(pick.ticker)
    const forecastPass = forecastVivos[pick.ticker]?.pass ?? true
    const momentumPass = momentumVivos[pick.ticker]?.pass ?? true
    const fallos = (!lynchPass ? 1 : 0) + (!forecastPass ? 1 : 0) + (!momentumPass ? 1 : 0)

    if (fallos < FALLOS_PARA_VENDER) {
      log(`✓ ${pick.ticker}: posición OK — falla ${fallos}/3 (umbral: ${FALLOS_PARA_VENDER})`)
      continue
    }

    const salida = forecastVivos[pick.ticker]?.lastPrice ?? pick.precio_entrada
    const rent = pick.precio_entrada > 0
      ? ((salida - pick.precio_entrada) / pick.precio_entrada) * 100
      : 0
    const { error } = await supabase
      .from('agent_recommendations')
      .update({
        estado: 'Vender',
        precio_venta: parseFloat(salida.toFixed(2)),
        rentabilidad: parseFloat(rent.toFixed(2)),
        closed_at: new Date().toISOString(),
      })
      .eq('id', pick.id)
      .eq('user_id', userId)

    if (error) {
      log(`⚠ ${pick.ticker}: no se pudo registrar la venta — ${error.message}`)
      r.fallidos++
    } else {
      const signo = rent >= 0 ? '+' : ''
      log(`⬇ ${pick.ticker}: VENDER — falla ${fallos}/3 | $${pick.precio_entrada.toFixed(2)} → $${salida.toFixed(2)} | ${signo}${rent.toFixed(1)}%`)
      r.vendidas++
    }
  }

  if (!candidatos.length) {
    log(`⚠ ningún candidato supera el score mínimo; ${perfil.etiqueta} termina sin recomendar`)
    return r
  }

  // ── PASO 2: proyección a 30 sesiones ─────────────────────────────────────
  const forecast = await forecastDeTickers(candidatos.map(s => s.ticker))
  const trasForecast = candidatos.filter(s => forecast[s.ticker]?.pass)
  r.trasForecast = trasForecast.length
  log(`📊 forecast 30d: pasan ${trasForecast.length} de ${candidatos.length}`)
  if (!trasForecast.length) return r

  // ── PASO 3: momentum ─────────────────────────────────────────────────────
  const momentum = await momentumDeTickers(trasForecast.map(s => s.ticker))
  const trasMomentum = trasForecast.filter(s => momentum[s.ticker]?.pass)
  r.trasMomentum = trasMomentum.length
  log(`⚡ momentum: pasan ${trasMomentum.length} de ${trasForecast.length}`)
  if (!trasMomentum.length) return r

  // ── PASO 4 y 5: dictamen del modelo y guardado ───────────────────────────
  // Se recorre en serie a propósito: es el único paso que cuesta tokens, y en
  // paralelo se perdería la pausa que protege al proveedor.
  for (const [i, cand] of trasMomentum.entries()) {
    if (Date.now() - arranque > PRESUPUESTO_ANALISIS_MS) {
      r.truncadas = trasMomentum.length - i
      log(`⏱ presupuesto agotado: quedan ${r.truncadas} candidato(s) sin analizar, se retoman mañana`)
      break
    }

    const f = forecast[cand.ticker]
    const m = momentum[cand.ticker]

    // Sin precio real de mercado no se analiza: el objetivo y el stop se
    // derivan de él, y el precio de entrada quedaría inventado.
    if (f == null || !Number.isFinite(f.lastPrice) || f.lastPrice <= 0) {
      log(`⚠ ${cand.ticker}: sin precio de mercado fiable — descartado`)
      continue
    }

    let ai
    try {
      ai = await analizarTicker({
        ticker: cand.ticker,
        lastPrice: f.lastPrice,
        category,
        score: cand.score,
        forecastReturn: f.forecastReturn,
        momentumScore: m?.score,
        rsi: m?.rsi,
        macd: m?.macd,
        macdSignal: m?.signal,
      })
    } catch (e) {
      const detalle = e instanceof AnalisisError ? e.message : (e as Error).message
      log(`⚠ ${cand.ticker}: error del modelo — ${detalle}`)
      r.fallidos++
      await sleep(PAUSA_ENTRE_ANALISIS_MS)
      continue
    }

    const veredicto = apruebaAnalisis(ai as unknown as Record<string, unknown>)
    log(`${veredicto.pass ? '✓' : '✗'} ${cand.ticker}: conviction ${veredicto.conviction}/10 · ${veredicto.direction}${veredicto.motivo}`)

    if (!veredicto.pass) {
      await sleep(PAUSA_ENTRE_ANALISIS_MS)
      continue
    }
    r.aprobadas++

    // Dedupe: la misma regla que aplica `api/agentes/picks`. Una posición viva
    // conserva su recomendación original sin modificar, para que el precio de
    // entrada y la tesis con la que se abrió sigan siendo los de entonces.
    const { data: existente } = await supabase
      .from('agent_recommendations')
      .select('id')
      .eq('user_id', userId)
      .eq('ticker', cand.ticker)
      .eq('category', category)
      .neq('estado', 'Vender')
      .limit(1)
      .maybeSingle()

    if (existente) {
      log(`↩ ${cand.ticker}: ya tiene posición viva — se conserva la recomendación original`)
      r.omitidas++
      await sleep(PAUSA_ENTRE_ANALISIS_MS)
      continue
    }

    const { error } = await supabase.from('agent_recommendations').insert({
      user_id: userId,
      ticker: cand.ticker,
      empresa: ai.empresa ?? cand.name,
      category,
      // Precio real de mercado del paso 2. Nunca la proyección: una entrada
      // inventada falsea el rendimiento durante toda la vida de la posición.
      precio_entrada: parseFloat(f.lastPrice.toFixed(2)),
      precio_objetivo: ai.precio_objetivo,
      stop_loss: ai.stop_loss,
      // Constante a propósito: el paso 4 solo deja pasar COMPRA, y así no se
      // cuela un 'compra' en minúsculas del modelo.
      direction: 'COMPRA',
      riesgo: ai.riesgo,
      timeframe: ai.timeframe,
      resumen: ai.resumen,
      score: cand.score,
      ai_report: {
        ...ai,
        conviction: veredicto.conviction,
        forecastReturn: f.forecastReturn,
        momentumScore: m?.score,
        origen: 'cron',
      },
    })

    if (error) {
      log(`⚠ ${cand.ticker}: no se pudo guardar — ${error.message}`)
      r.fallidos++
    } else {
      log(`✓ ${cand.ticker}: guardado — ${ai.empresa ?? cand.ticker} (conviction ${veredicto.conviction}/10)`)
      r.creadas++
    }

    await sleep(PAUSA_ENTRE_ANALISIS_MS)
  }

  log(`✅ ${perfil.etiqueta}: ${r.creadas} recomendación(es) de ${r.candidatos} candidatos iniciales`)
  return r
}
