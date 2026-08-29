/**
 * Orquestador del backtest de los agentes de opciones.
 *
 * Uso:
 *   npm run backtest:opciones
 *   npm run backtest:opciones -- --modo=regimen
 *   npm run backtest:opciones -- --skew
 *   npm run backtest:opciones -- --sin-niveles
 *
 * El orden importa y no es negociable:
 *
 *   1. **Calibrar primero.** Se replica `^PUT` —el índice PutWrite del CBOE, que
 *      vende puts ATM sobre el S&P 500 con precios reales— y se busca el `k` que
 *      lo reproduce. Sin este paso, el supuesto de volatilidad sería una
 *      elección a dedo y el resultado de Theta lo decidiría esa elección.
 *   2. **Medir después**, con el `k` calibrado.
 *   3. **Barrer siempre**, para publicar el resultado como curva frente al
 *      supuesto y no como una cifra única.
 *
 * Si la réplica no sigue a `^PUT` de cerca, el modelo de volatilidad no vale y
 * el script lo dice en voz alta en vez de publicar números bonitos.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { computeForecast } from '@/lib/agentes/signals'
import {
  DIR_OPCIONES, UNIVERSO_GAMMA, UNIVERSO_THETA, SERIES_AUXILIARES,
  CAPITAL_GAMMA, CAPITAL_THETA, REJILLA_K, VENTANA_VOL_REALIZADA, SEED,
} from '@/lib/backtest/opciones/config'
import { N_REPLICAS } from '@/lib/backtest/config'
import {
  volatilidadRealizada, volatilidadImplicita, primaDeVarianza, tipoSinRiesgo,
  PENDIENTE_SKEW, type ModoVolatilidad,
} from '@/lib/backtest/opciones/volatilidad'
import {
  fechasDeRebalanceo, elegirContrato, construirContrato, strikeCotizable,
} from '@/lib/backtest/opciones/cadena'
import { simularOpciones, type Orden, type EstadoSubyacente } from '@/lib/backtest/opciones/motor'
import {
  metricasCurva, compararConBenchmark, bootstrapBloques, crearRng,
} from '@/lib/backtest/stats'

/* ── Argumentos ──────────────────────────────────────────────────────────── */

const args = process.argv.slice(2)
const modo = (args.find(a => a.startsWith('--modo='))?.split('=')[1] ?? 'constante') as ModoVolatilidad
const usarSkew = args.includes('--skew')
const usarNiveles = !args.includes('--sin-niveles')

if (modo !== 'constante' && modo !== 'regimen') {
  console.error('--modo debe ser `constante` o `regimen`')
  process.exit(1)
}

/* ── Carga ───────────────────────────────────────────────────────────────── */

interface Serie { fechas: string[]; cierres: number[]; indice: Map<string, number> }

async function cargar(ticker: string): Promise<Serie | null> {
  try {
    const raw = JSON.parse(
      await readFile(path.join(DIR_OPCIONES, `${ticker.replace('^', '_')}.json`), 'utf8'),
    ) as { rows: Array<{ date: string; close: number }> }
    const fechas = raw.rows.map(r => r.date)
    const cierres = raw.rows.map(r => r.close)
    return { fechas, cierres, indice: new Map(fechas.map((f, i) => [f, i])) }
  } catch {
    return null
  }
}

/**
 * Estado de un subyacente en cada fecha: spot, IV modelada y tipo sin riesgo.
 *
 * La IV de la fecha `i` se calcula con las sesiones que **terminan** en `i`, así
 * que no mira hacia adelante. Es la propiedad que hace válido todo lo demás.
 */
interface Panel {
  serie: Serie
  iv: Array<number | null>
}

function construirPanel(serie: Serie, k: number, prima: Array<number | null> | null, indicePrima: Map<string, number> | null): Panel {
  const rv = volatilidadRealizada(serie.cierres, VENTANA_VOL_REALIZADA)
  const iv = rv.map((v, i) => {
    if (v == null) return null
    const p = prima && indicePrima ? prima[indicePrima.get(serie.fechas[i]) ?? -1] ?? null : null
    return volatilidadImplicita({ realizada: v, primaDeMercado: p, k, modo })
  })
  return { serie, iv }
}

/* ── Réplica de ^PUT para calibrar ───────────────────────────────────────── */

/**
 * Replica la metodología de `^PUT`: cada vencimiento vende un put ATM sobre el
 * S&P 500 con vencimiento el mes siguiente, totalmente colateralizado.
 *
 * «Totalmente colateralizado» significa que se reserva el nocional entero
 * (strike × 100), no un margen del 20 %. Es lo que hace el índice y lo que hace
 * comparables las dos curvas: con margen la réplica estaría apalancada cinco
 * veces y no seguiría a `^PUT` ni con el `k` correcto.
 */
function replicarPutWrite(spy: Serie, panel: Panel, irx: Serie, fechas: string[], sesiones: string[]) {
  const estadoEn = (_t: string, fecha: string): EstadoSubyacente | null => {
    const i = spy.indice.get(fecha)
    if (i == null) return null
    const iv = panel.iv[i]
    if (iv == null) return null
    const j = irx.indice.get(fecha)
    return { spot: spy.cierres[i], iv, r: tipoSinRiesgo(j != null ? irx.cierres[j] : null) }
  }

  return simularOpciones({
    capital: 1_000_000,
    fechasRebalanceo: fechas,
    sesiones,
    maxPosiciones: 1,
    // El índice está totalmente colateralizado: reserva el nocional entero.
    margenShortPut: 1,
    // Y mantiene hasta el vencimiento pase lo que pase.
    usarNivelesDeSalida: false,
    estadoEn,
    generarOrdenes: (fecha) => {
      const e = estadoEn('SPY', fecha)
      if (!e) return []
      const venc = fechasDeRebalanceo(fecha, '2099-12-31')[1]
      if (!venc) return []
      const dte = Math.round((new Date(venc).getTime() - new Date(fecha).getTime()) / 86_400_000)
      // ATM: el strike cotizable más cercano al índice.
      const contrato = construirContrato({
        tipo: 'put', spot: e.spot, strike: strikeCotizable(e.spot, e.spot),
        vencimiento: venc, dte, ivBase: e.iv, r: e.r, skew: usarSkew ? PENDIENTE_SKEW : 0,
      })
      return contrato ? [{ ticker: 'SPY', tipo: 'put', lado: 'short', contrato }] : []
    },
  })
}

/** Retornos de una serie en las fechas dadas. */
function retornosEn(serie: Serie, fechas: string[]): number[] {
  const vals = fechas.map(f => {
    const i = serie.indice.get(f)
    return i != null ? serie.cierres[i] : null
  })
  const out: number[] = []
  for (let i = 1; i < vals.length; i++) {
    const a = vals[i - 1], b = vals[i]
    out.push(a != null && b != null && a > 0 ? b / a - 1 : 0)
  }
  return out
}

/** Error de seguimiento anualizado entre dos series de retornos mensuales. */
function errorDeSeguimiento(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  const d = Array.from({ length: n }, (_, i) => a[i] - b[i])
  const m = d.reduce((x, y) => x + y, 0) / n
  const v = d.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, n - 1)
  return Math.sqrt(v * 12)
}

/* ── Cascadas de los agentes ─────────────────────────────────────────────── */

/**
 * Reproduce la cascada de Gamma con las mismas funciones que usa producción.
 *
 * `AgenteGamma.tsx:277` decide el tipo por el forecast: CALL si proyecta ≥ +2 %,
 * PUT si ≤ −3 %, y nada en medio. Después exige |Δ| ∈ [0,30; 0,65] y
 * DTE ∈ [21; 90] (`AgenteGamma.tsx:361-366`).
 *
 * El paso de revisión por IA no se reproduce: no es determinista ni auditable
 * hacia atrás. Se declara en el informe.
 */
function ordenesGamma(fecha: string, paneles: Map<string, Panel>, irx: Serie): Orden[] {
  const out: Orden[] = []

  for (const ticker of UNIVERSO_GAMMA) {
    const p = paneles.get(ticker)
    if (!p) continue
    const i = p.serie.indice.get(fecha)
    if (i == null || i < 60) continue
    const iv = p.iv[i]
    if (iv == null) continue

    // Solo información disponible en la fecha de decisión, cierre incluido.
    const closes = p.serie.cierres.slice(Math.max(0, i - 59), i + 1)
    const f = computeForecast(closes)
    if (!f) continue

    const tipo = f.forecastReturn >= 2 ? 'call' : f.forecastReturn <= -3 ? 'put' : null
    if (!tipo) continue

    const j = irx.indice.get(fecha)
    const r = tipoSinRiesgo(j != null ? irx.cierres[j] : null)

    // Centro de la ventana de delta que exige el agente.
    const contrato = elegirContrato({
      tipo, fecha, spot: p.serie.cierres[i], deltaObjetivo: 0.475,
      dteMin: 21, dteMax: 90, iv, r, skew: usarSkew ? PENDIENTE_SKEW : 0,
    })
    if (!contrato) continue
    const delta = Math.abs(contrato.delta)
    if (delta < 0.30 || delta > 0.65) continue

    out.push({ ticker, tipo, lado: 'long', contrato })
  }

  return out
}

/**
 * Reproduce la cascada de Theta (`AgenteTheta.tsx:376-380`): IV > 30 %,
 * DTE ∈ [21; 45] y |Δ| ∈ [0,15; 0,35]. Vende puts.
 *
 * El corte de score ≥ 60 no se reproduce: `scoreOptionContract` pondera sobre
 * todo el interés abierto y el volumen del contrato, que no existen hacia atrás.
 */
function ordenesTheta(fecha: string, paneles: Map<string, Panel>, irx: Serie): Orden[] {
  const out: Orden[] = []

  for (const ticker of UNIVERSO_THETA) {
    const p = paneles.get(ticker)
    if (!p) continue
    const i = p.serie.indice.get(fecha)
    if (i == null || i < 60) continue
    const iv = p.iv[i]
    if (iv == null || iv <= 0.30) continue

    // Theta evita vender puts sobre lo que se está desplomando: el filtro de
    // producción exige que la proyección no sea muy negativa.
    const closes = p.serie.cierres.slice(Math.max(0, i - 59), i + 1)
    const f = computeForecast(closes)
    if (!f || f.forecastReturn < -5) continue

    const j = irx.indice.get(fecha)
    const r = tipoSinRiesgo(j != null ? irx.cierres[j] : null)

    const contrato = elegirContrato({
      tipo: 'put', fecha, spot: p.serie.cierres[i], deltaObjetivo: 0.25,
      dteMin: 21, dteMax: 45, iv, r, skew: usarSkew ? PENDIENTE_SKEW : 0,
    })
    if (!contrato) continue
    const delta = Math.abs(contrato.delta)
    if (delta < 0.15 || delta > 0.35) continue

    out.push({ ticker, tipo: 'put', lado: 'short', contrato })
  }

  return out
}

/* ── Principal ───────────────────────────────────────────────────────────── */

async function main() {
  console.log(`Modo de volatilidad: ${modo}${usarSkew ? ' · con skew' : ''}${usarNiveles ? '' : ' · sin niveles de salida'}\n`)

  const spy = await cargar('SPY')
  const vix = await cargar(SERIES_AUXILIARES.vix)
  const irx = await cargar(SERIES_AUXILIARES.tipoSinRiesgo)
  const put = await cargar(SERIES_AUXILIARES.putWrite)
  if (!spy || !vix || !irx || !put) {
    console.error('Faltan series base. Ejecuta antes: npm run backtest:fetch-opciones')
    process.exit(1)
  }

  // Prima de varianza del mercado, para el modo `regimen`.
  const rvSpy = volatilidadRealizada(spy.cierres, VENTANA_VOL_REALIZADA)
  const vixAlineado = spy.fechas.map(f => {
    const i = vix.indice.get(f)
    return i != null ? vix.cierres[i] : NaN
  })
  const prima = primaDeVarianza(vixAlineado, rvSpy)

  const sesiones = spy.fechas
  const fechas = fechasDeRebalanceo(sesiones[0], sesiones.at(-1)!)
    .filter(f => spy.indice.has(f))
  console.log(`Ventana: ${fechas[0]} → ${fechas.at(-1)} · ${fechas.length} vencimientos\n`)

  // ── 1. Calibración contra ^PUT ────────────────────────────────────────────
  console.log('Calibrando contra ^PUT (CBOE S&P 500 PutWrite Index)…')
  const retPut = retornosEn(put, fechas)

  let mejor = { k: 1, te: Infinity, correlacion: 0 }
  const calibracion: Array<{ k: number; te: number; correlacion: number }> = []

  for (const k of REJILLA_K) {
    const panel = construirPanel(spy, k, prima, spy.indice)
    const rep = replicarPutWrite(spy, panel, irx, fechas, sesiones)
    const retRep = rep.retornos.map(r => r.retorno)
    const n = Math.min(retRep.length, retPut.length)
    const te = errorDeSeguimiento(retRep.slice(0, n), retPut.slice(0, n))

    const ma = retRep.slice(0, n).reduce((a, b) => a + b, 0) / n
    const mb = retPut.slice(0, n).reduce((a, b) => a + b, 0) / n
    let num = 0, da = 0, db = 0
    for (let i = 0; i < n; i++) {
      num += (retRep[i] - ma) * (retPut[i] - mb)
      da += (retRep[i] - ma) ** 2
      db += (retPut[i] - mb) ** 2
    }
    const correlacion = da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0

    calibracion.push({ k, te, correlacion })
    console.log(`  k=${k.toFixed(2)}  error de seguimiento ${(te * 100).toFixed(2)} %  correlación ${correlacion.toFixed(3)}`)
    if (te < mejor.te) mejor = { k, te, correlacion }
  }

  console.log(`\n  → k* = ${mejor.k.toFixed(2)} (error ${(mejor.te * 100).toFixed(2)} %, correlación ${mejor.correlacion.toFixed(3)})`)
  if (mejor.correlacion < 0.7) {
    console.log('\n  ⚠ La réplica NO sigue a ^PUT. El modelo de volatilidad no es fiable')
    console.log('    y los resultados de abajo no deben publicarse como medida de nada.')
  }

  // ── 2. Paneles del universo con k* ────────────────────────────────────────
  const universo = [...new Set([...UNIVERSO_GAMMA, ...UNIVERSO_THETA])]
  const paneles = new Map<string, Panel>()
  for (const t of universo) {
    const s = await cargar(t)
    if (s) paneles.set(t, construirPanel(s, mejor.k, prima, spy.indice))
  }
  console.log(`\nPaneles construidos: ${paneles.size}/${universo.length} tickers\n`)

  const estadoEn = (ticker: string, fecha: string): EstadoSubyacente | null => {
    const p = paneles.get(ticker)
    if (!p) return null
    const i = p.serie.indice.get(fecha)
    if (i == null) return null
    const iv = p.iv[i]
    if (iv == null) return null
    const j = irx.indice.get(fecha)
    return { spot: p.serie.cierres[i], iv, r: tipoSinRiesgo(j != null ? irx.cierres[j] : null) }
  }

  // ── 3. Los dos agentes ────────────────────────────────────────────────────
  const agentes = [
    {
      id: 'gamma', nombre: 'Gamma', capital: CAPITAL_GAMMA, maxPosiciones: 5,
      benchmark: 'SPY', serieBench: spy,
      ordenes: (f: string) => ordenesGamma(f, paneles, irx),
    },
    {
      id: 'theta', nombre: 'Theta', capital: CAPITAL_THETA, maxPosiciones: 8,
      benchmark: '^PUT', serieBench: put,
      ordenes: (f: string) => ordenesTheta(f, paneles, irx),
    },
  ]

  const rfMedio = fechas.reduce((a, f) => {
    const j = irx.indice.get(f)
    return a + tipoSinRiesgo(j != null ? irx.cierres[j] : null)
  }, 0) / fechas.length

  const salida: Record<string, unknown> = {
    generado: new Date().toISOString(),
    modo, skew: usarSkew, nivelesDeSalida: usarNiveles,
    ventana: { desde: fechas[0], hasta: fechas.at(-1), nVencimientos: fechas.length },
    calibracion: { rejilla: calibracion, kOptimo: mejor.k, errorSeguimiento: mejor.te, correlacion: mejor.correlacion },
    agentes: {},
  }

  for (const a of agentes) {
    const res = simularOpciones({
      capital: a.capital, fechasRebalanceo: fechas, sesiones,
      maxPosiciones: a.maxPosiciones, usarNivelesDeSalida: usarNiveles,
      estadoEn, generarOrdenes: a.ordenes,
    })
    const rets = res.retornos.map(r => r.retorno)
    const retsBench = retornosEn(a.serieBench, fechas)
    const n = Math.min(rets.length, retsBench.length)

    const m = metricasCurva(res.curva, rets, rfMedio)
    const comp = compararConBenchmark(rets.slice(0, n), retsBench.slice(0, n))
    const boot = bootstrapBloques(
      rets.slice(0, n).map((r, i) => r - retsBench[i]), crearRng(SEED), N_REPLICAS,
    )
    const ganadoras = res.operaciones.filter(o => o.resultado > 0).length

    console.log(`── ${a.nombre} ${'─'.repeat(50)}`)
    console.log(`   CAGR ${((m.cagr ?? 0) * 100).toFixed(2)} %   vs ${a.benchmark} ${((metricasCurva(
      fechas.map(f => ({ fecha: f, valor: a.serieBench.cierres[a.serieBench.indice.get(f) ?? 0] })),
      retsBench, rfMedio,
    ).cagr ?? 0) * 100).toFixed(2)} %`)
    console.log(`   Sharpe ${(m.sharpe ?? 0).toFixed(2)}   IR ${(comp.informationRatio ?? 0).toFixed(2)}   t-stat ${(comp.contraste.tStat ?? 0).toFixed(2)}`)
    console.log(`   Caída máxima ${(m.maxDrawdown * 100).toFixed(2)} %   operaciones ${res.operaciones.length}   aciertos ${(ganadoras / Math.max(1, res.operaciones.length) * 100).toFixed(1)} %`)
    console.log(`   Vencimientos sin posiciones: ${res.fechasSinPosiciones}/${fechas.length}\n`)

    // Curva del índice reescalada al mismo capital inicial, para que las dos
    // se puedan leer en el mismo gráfico sin comparar dólares con puntos.
    const base = a.serieBench.cierres[a.serieBench.indice.get(fechas[0]) ?? 0]
    const benchmarkCurva = fechas.map(f => {
      const i = a.serieBench.indice.get(f)
      return { fecha: f, valor: i != null ? (a.serieBench.cierres[i] / base) * a.capital : 0 }
    })
    const benchmarkMetricas = metricasCurva(
      benchmarkCurva.map(p => ({ fecha: p.fecha, valor: p.valor })), retsBench, rfMedio,
    )

    ;(salida.agentes as Record<string, unknown>)[a.id] = {
      nombre: a.nombre, capital: a.capital, benchmark: a.benchmark,
      benchmarkMetricas, benchmarkCurva,
      metricas: m, comparacion: comp, bootstrap: boot,
      nOperaciones: res.operaciones.length,
      hitRate: ganadoras / Math.max(1, res.operaciones.length),
      fechasSinPosiciones: res.fechasSinPosiciones,
      curva: res.curva,
      operaciones: res.operaciones,
    }
  }

  // ── 4. Barrido de k ───────────────────────────────────────────────────────
  console.log('Barrido del supuesto de volatilidad:\n')
  const barrido: Array<Record<string, unknown>> = []

  for (const k of REJILLA_K) {
    const pan = new Map<string, Panel>()
    for (const [t, p] of paneles) pan.set(t, construirPanel(p.serie, k, prima, spy.indice))
    const estadoK = (ticker: string, fecha: string): EstadoSubyacente | null => {
      const p = pan.get(ticker)
      if (!p) return null
      const i = p.serie.indice.get(fecha)
      if (i == null) return null
      const iv = p.iv[i]
      if (iv == null) return null
      const j = irx.indice.get(fecha)
      return { spot: p.serie.cierres[i], iv, r: tipoSinRiesgo(j != null ? irx.cierres[j] : null) }
    }

    const fila: Record<string, unknown> = { k }
    for (const a of agentes) {
      const res = simularOpciones({
        capital: a.capital, fechasRebalanceo: fechas, sesiones,
        maxPosiciones: a.maxPosiciones, usarNivelesDeSalida: usarNiveles,
        estadoEn: estadoK,
        generarOrdenes: (f: string) => (a.id === 'gamma' ? ordenesGamma(f, pan, irx) : ordenesTheta(f, pan, irx)),
      })
      const rets = res.retornos.map(r => r.retorno)
      const retsBench = retornosEn(a.serieBench, fechas)
      const n = Math.min(rets.length, retsBench.length)
      const m = metricasCurva(res.curva, rets, rfMedio)
      const comp = compararConBenchmark(rets.slice(0, n), retsBench.slice(0, n))
      fila[a.id] = {
        cagr: m.cagr, sharpe: m.sharpe, informationRatio: comp.informationRatio,
        tStat: comp.contraste.tStat, nOperaciones: res.operaciones.length,
      }
    }
    barrido.push(fila)
    const g = fila.gamma as { cagr: number | null }
    const t = fila.theta as { cagr: number | null }
    console.log(`  k=${k.toFixed(2)}   Gamma ${((g.cagr ?? 0) * 100).toFixed(2).padStart(7)} %   Theta ${((t.cagr ?? 0) * 100).toFixed(2).padStart(7)} %${k === mejor.k ? '   ← calibrado' : ''}`)
  }
  salida.barridoK = barrido

  await mkdir(DIR_OPCIONES, { recursive: true })
  const destino = path.join(DIR_OPCIONES, `resultados-opciones-${modo}${usarSkew ? '-skew' : ''}${usarNiveles ? '' : '-sin-niveles'}.json`)
  await writeFile(destino, JSON.stringify(salida, null, 2))
  console.log(`\n✓ ${destino}`)
}

main().catch(e => { console.error(e); process.exit(1) })
