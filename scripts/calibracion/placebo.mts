/**
 * El grupo de control del corpus: qué hace el precio en un día cualquiera.
 *
 * Sin esto la calibración no se puede cerrar. Los eventos del corpus se
 * eligieron por haber sido importantes, así que casi todos movieron el mercado
 * y P(movimiento) sale altísima en todos los peldaños. Falta el denominador: si
 * en una fecha al azar la probabilidad de que algún activo supere su umbral es
 * del 55%, un peldaño con el 60% no distingue nada.
 *
 * Por qué al azar y no una lista de titulares anodinos escrita a mano: porque
 * quien escribe esa lista decide qué es anodino, y ese es el mismo sesgo que se
 * quiere eliminar. Un muestreo no opina. Además cada titular inventado traería
 * una fecha sin verificar, que es el error que más daño hace aquí.
 *
 * Las fechas salen de las sesiones que ya están en la caché de precios, así que
 * no se descarga nada nuevo y son todas fechas reales de mercado.
 *
 * Reproducible: la misma semilla da el mismo muestreo. Sin eso, cada ejecución
 * movería la línea base y no se sabría si mejoró el prompt o cambió el control.
 *
 * Ojo con el alcance de esa reproducibilidad: es estable mientras el corpus no
 * cambie. Al añadir eventos cambian las fechas vetadas por cercanía, y con ellas
 * la lista de candidatas y el muestreo, aunque la semilla sea la misma. Añadir
 * diez eventos el 2026-09-02 movió la línea base del 30% al 25%. Es correcto
 * —las fechas pegadas a un evento no son días corrientes— pero significa que la
 * base hay que releerla después de cada ampliación del corpus, y que dos curvas
 * calculadas con corpus distintos no son directamente comparables.
 *
 * Uso:
 *   npm run calibracion:placebo              # 60 fechas, semilla por defecto
 *   npm run calibracion:placebo -- 100 7     # 100 fechas, semilla 7
 */
import { existsSync, readFileSync } from 'node:fs'

import { createAdminClient } from '@/lib/supabase/admin'
import { huboMovimiento } from '@/lib/alertas/calibracion'

import { EVENTOS, TICKERS_MEDIDOS } from './eventos.ts'
import type { Movimiento } from './medir.mts'

const CACHE_DIR = 'scratchpad/calibracion/precios'
const VENTANAS = [1, 3, 5] as const

/**
 * Distancia mínima, en sesiones, entre una fecha de control y un evento real.
 *
 * Una fecha a dos días de la invasión de Ucrania no es un día corriente: mide
 * la misma sacudida. Con 10 sesiones de margen la ventana de cinco cabe entera
 * sin rozar el evento por ninguno de los dos lados.
 */
const MARGEN_SESIONES = 10

/** El activo cuyo calendario manda: el que más sesiones tiene cotizadas. */
const TICKER_CALENDARIO = 'ES=F'

interface Cierre { date: string; close: number; high: number; low: number }

function rutaCache(ticker: string): string {
  return `${CACHE_DIR}/${ticker.replace(/[^A-Za-z0-9]/g, '_')}.json`
}

function historicoCacheado(ticker: string): Cierre[] {
  const ruta = rutaCache(ticker)
  if (!existsSync(ruta)) return []
  return JSON.parse(readFileSync(ruta, 'utf8')) as Cierre[]
}

/**
 * Generador reproducible (mulberry32).
 *
 * `Math.random` no vale: la línea base tiene que ser la misma entre ejecuciones
 * o no se puede comparar un ajuste con el anterior.
 */
function aleatorioCon(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Sesión base: la anterior a la fecha, igual que en `medir.mts`. */
function indiceBase(cierres: Cierre[], fecha: string): number {
  const i = cierres.findIndex((c) => c.date >= fecha)
  if (i === -1) return -1
  return i - 1
}

function medirEnFecha(cierres: Cierre[], ticker: string, fecha: string): Movimiento[] {
  const base = indiceBase(cierres, fecha)
  if (base < 0 || base >= cierres.length - 1) return []

  const precioBase = cierres[base].close
  const salida: Movimiento[] = []

  for (const v of VENTANAS) {
    const ventana = cierres.slice(base + 1, base + 1 + v)
    if (ventana.length < v) continue

    const retorno = ventana.at(-1)!.close / precioBase - 1
    const extremos = ventana.flatMap((c) => [c.high / precioBase - 1, c.low / precioBase - 1])
    const extremo = extremos.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0)

    salida.push({
      ticker,
      ventana: v,
      retorno: Number(retorno.toFixed(5)),
      extremo: Number(extremo.toFixed(5)),
      sesionBase: cierres[base].date,
    })
  }

  return salida
}

async function main(): Promise<void> {
  const cuantas = Number(process.argv[2] ?? 60)
  const semilla = Number(process.argv[3] ?? 20260902)

  if (!Number.isFinite(cuantas) || cuantas < 1) throw new Error('el número de fechas debe ser un entero positivo')

  const series = new Map<string, Cierre[]>()
  for (const t of TICKERS_MEDIDOS) {
    const c = historicoCacheado(t)
    if (c.length) series.set(t, c)
  }
  if (!series.size) {
    throw new Error('no hay precios en caché: ejecuta antes "npm run calibracion:medir"')
  }

  const calendario = series.get(TICKER_CALENDARIO) ?? []
  if (!calendario.length) throw new Error(`falta el histórico de ${TICKER_CALENDARIO}`)

  // Las fechas de los eventos reales quedan fuera, con margen: una sesión
  // pegada a la invasión de Ucrania no es un día corriente.
  const vetadas = new Set<string>()
  for (const evento of EVENTOS) {
    const i = indiceBase(calendario, evento.fecha)
    if (i < 0) continue
    for (let j = i - MARGEN_SESIONES; j <= i + MARGEN_SESIONES; j++) {
      if (calendario[j]) vetadas.add(calendario[j].date)
    }
  }

  // El muestreo se hace desde la primera sesión del corpus para que el control
  // cubra el mismo periodo histórico que los eventos, y no otro régimen.
  const desde = EVENTOS.map((e) => e.fecha).sort()[0]
  const candidatas = calendario
    .slice(0, -Math.max(...VENTANAS))
    .filter((c) => c.date >= desde && !vetadas.has(c.date))
    .map((c) => c.date)

  if (candidatas.length < cuantas) {
    throw new Error(`solo hay ${candidatas.length} sesiones candidatas para ${cuantas} fechas`)
  }

  const rnd = aleatorioCon(semilla)

  /** Baraja una copia con la semilla compartida. Fisher-Yates. */
  function barajar<T>(xs: readonly T[]): T[] {
    const out = [...xs]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  // ── Muestreo emparejado por época ──────────────────────────────────────
  //
  // El muestreo uniforme sobre todo el periodo estaba comparando cosas de
  // décadas distintas: el corpus se concentra en los 2020 (72% de los hechos)
  // y las candidatas están repartidas por igual desde 2001, así que el control
  // caía sobre todo en los 2000 y 2010. La mediana del control quedaba en 2010
  // y la del corpus en 2022, doce años de diferencia.
  //
  // Eso no es un detalle: cada década tiene su régimen de volatilidad, y hay
  // activos que ni existían. Bitcoin cotizaba en el 78% de los hechos y solo en
  // el 40% de las fechas de control, y como la regla es «basta que uno cruce»,
  // un activo solo puede sumar cruces donde existe: el corpus tenía más
  // oportunidades de cruzar que su propio denominador, y la separación salía
  // inflada por disponibilidad y no por señal.
  //
  // Ahora cada evento aporta sus propias fechas de control, tomadas de su mismo
  // periodo. El control pasa a ser «qué hacía el precio en un día cualquiera de
  // aquella época», que es la comparación que la curva necesita.
  const porEvento = Math.max(1, Math.round(cuantas / EVENTOS.length))
  const usadas = new Set<string>()
  const elegidas: string[] = []

  // De más estrecha a más ancha: se prefiere el mismo año y solo se abre la
  // ventana cuando el veto ha dejado sin candidatas ese periodo.
  const VENTANAS_ANIOS = [1, 2, 4, 8] as const
  const aniosDe = (fecha: string, anios: number) => {
    const d = new Date(`${fecha}T00:00:00Z`)
    const desdeF = new Date(d); desdeF.setUTCFullYear(d.getUTCFullYear() - anios)
    const hastaF = new Date(d); hastaF.setUTCFullYear(d.getUTCFullYear() + anios)
    return [desdeF.toISOString().slice(0, 10), hastaF.toISOString().slice(0, 10)] as const
  }

  let ensanchados = 0
  for (const evento of barajar(EVENTOS.map((e) => e.fecha)).sort()) {
    let tomadas = 0
    for (const anios of VENTANAS_ANIOS) {
      if (tomadas >= porEvento) break
      if (anios > VENTANAS_ANIOS[0] && tomadas === 0) ensanchados++
      const [ini, fin] = aniosDe(evento, anios)
      const cerca = barajar(candidatas.filter((f) => f >= ini && f <= fin && !usadas.has(f)))
      for (const f of cerca) {
        if (tomadas >= porEvento) break
        usadas.add(f)
        elegidas.push(f)
        tomadas++
      }
    }
  }

  // El reparto por evento rara vez suma justo lo pedido. Se completa o se
  // recorta al azar sobre lo ya elegido, sin romper el emparejamiento.
  if (elegidas.length > cuantas) {
    const sobran = barajar(elegidas).slice(0, cuantas)
    elegidas.length = 0
    elegidas.push(...sobran)
  } else if (elegidas.length < cuantas) {
    for (const f of barajar(candidatas.filter((x) => !usadas.has(x)))) {
      if (elegidas.length >= cuantas) break
      usadas.add(f)
      elegidas.push(f)
    }
  }
  elegidas.sort()

  console.log(`\nGRUPO DE CONTROL · ${elegidas.length} fechas al azar (semilla ${semilla})`)
  console.log(`Candidatas: ${candidatas.length} sesiones desde ${desde}, excluidas ${vetadas.size} por cercanía a un evento.`)
  console.log(`Emparejado por época: ${porEvento} fecha(s) por cada uno de los ${EVENTOS.length} eventos, del mismo periodo.`)
  if (ensanchados) {
    console.log(`${ensanchados} evento(s) necesitaron ensanchar la ventana: su año no tenía candidatas libres.`)
  }

  // El emparejamiento solo sirve si de verdad acerca las dos distribuciones, y
  // eso se comprueba, no se supone.
  const mediana = (xs: readonly string[]) => [...xs].sort()[Math.floor(xs.length / 2)]
  console.log(`Mediana del control: ${mediana(elegidas)}  ·  mediana del corpus: ${mediana(EVENTOS.map((e) => e.fecha))}`)
  console.log('')

  const admin = createAdminClient()

  // El muestreo anterior se borra antes de escribir el nuevo. Sin esto los dos
  // se acumulan —el upsert va por (fecha, titulo) y las fechas viejas no
  // colisionan con las nuevas—, y la línea base pasa a ser la mezcla de dos
  // muestreos con distinto veto. Ya pasó: 119 fechas donde debía haber 60.
  const { error: errorLimpieza, count } = await admin
    .from('severity_events')
    .delete({ count: 'exact' })
    .eq('tramo', 'placebo')
  if (errorLimpieza) throw new Error(`limpiando el control anterior: ${errorLimpieza.message}`)
  if (count) console.log(`Borradas ${count} fechas del control anterior.\n`)
  let movidas = 0
  let filasMovimiento = 0

  for (const fecha of elegidas) {
    const movimientos: Movimiento[] = []
    for (const [ticker, cierres] of series) {
      movimientos.push(...medirEnFecha(cierres, ticker, fecha))
    }

    const deJuicio = movimientos.filter((m) => m.ventana === 5)
    const movio = huboMovimiento(deJuicio)
    if (movio) movidas++

    const { data, error } = await admin
      .from('severity_events')
      .upsert(
        {
          fecha,
          tramo: 'placebo',
          // El tema no significa nada aquí: una fecha al azar no es de guerra ni
          // de tasas. Se pone `guerra` porque la columna no admite nulo, y el
          // consumidor filtra por tramo, nunca por tema, en el grupo de control.
          tema: 'guerra',
          clase: 'dia-corriente',
          titulo: `Sesión de control ${fecha}`,
          // Siempre 1, y no quiere decir «leve»: quiere decir que no hay hecho
          // que puntuar. Sin esto la media de severidad del placebo se leería
          // como si un analista la hubiera juzgado.
          severidad: 1,
          nota: `Fecha elegida al azar (semilla ${semilla}), sin hecho detrás. Es el denominador: qué hace el precio en un día cualquiera.`,
          verificado: true,
        },
        { onConflict: 'fecha,titulo' },
      )
      .select('id')
      .single()

    if (error) throw new Error(`severity_events ${fecha}: ${error.message}`)
    const eventoId = (data as { id: number }).id

    if (movimientos.length) {
      const { error: errorMov } = await admin.from('severity_event_moves').upsert(
        movimientos.map((m) => ({
          evento_id: eventoId,
          ticker: m.ticker,
          ventana: m.ventana,
          retorno: m.retorno,
          extremo: m.extremo,
          sesion_base: m.sesionBase,
        })),
        { onConflict: 'evento_id,ticker,ventana' },
      )
      if (errorMov) throw new Error(`severity_event_moves ${fecha}: ${errorMov.message}`)
      filasMovimiento += movimientos.length
    }

    console.log(`  ${fecha}  ${String(movimientos.length).padStart(3)} medidas  ${movio ? 'MOVIÓ' : '—'}`)
  }

  const base = movidas / elegidas.length
  console.log(`\nCargadas ${elegidas.length} fechas y ${filasMovimiento} mediciones.`)
  console.log(`\nLÍNEA BASE: en un día cualquiera, algún activo supera su umbral el ${(base * 100).toFixed(1)}% de las veces.`)
  console.log('Un peldaño del clasificador solo distingue algo si su P(movimiento) se separa de esa cifra.')
  console.log('\nSiguiente paso: npm run calibracion:ajustar\n')
}

main().catch((e) => {
  console.error(`error: ${(e as Error).message}`)
  process.exit(1)
})
