/**
 * Fase 5 — Orquestador del backtest de los agentes Peter y Small.
 *
 * Uso:
 *   npm run backtest:run -- --agente=peter
 *   npm run backtest:run -- --agente=small
 *
 * `--capas` elige qué parte de la cascada se somete a todos los contrastes:
 *   lynch+tecnico  (por defecto) — la cascada de producción
 *   lynch          — solo el screener fundamental, sin forecast ni momentum
 *   tecnico        — solo las señales técnicas, sin filtro fundamental
 *
 *   npm run backtest:run -- --agente=peter --capas=lynch
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  SP500_NASDAQ100_TICKERS, SMALL_CAP_TICKERS, type ScreenerOptions,
} from '@/lib/peter-lynch/screener'
import { RISK_FREE } from '@/lib/portafolios/config'
import { desviacion } from '@/lib/portafolios/metrics'
import {
  DATA_DIR, SECTORS_PATH, BENCHMARK, BENCHMARK_POR_UNIVERSO, COSTE_TRANSACCION_BPS,
  N_REPLICAS, SEED, REPORTING_LAG_DIAS_ANUAL,
} from '@/lib/backtest/config'
import {
  cargarTodo, construirPanel, fechasRebalanceoMensual, indiceEn, construirFila,
} from '@/lib/backtest/panel'
import {
  simular, corteDeProduccion, opcionesDe, muestrear,
  CRITERIOS_TODOS, CRITERIOS_PROXY, type NombreCriterio, type Capas,
  type OpcionesSimulacion, type ResultadoSimulacion,
} from '@/lib/backtest/engine'
import {
  metricasCurva, compararConBenchmark, bootstrapBloques, deflatedSharpe,
  crearRng, percentil, contrastarMedia, PERIODOS_POR_ANIO,
} from '@/lib/backtest/stats'
import { escribirInforme } from '@/lib/backtest/report'
import type { Panel, PanelRow, PriceSeries, Universo } from '@/lib/backtest/types'

const args = process.argv.slice(2)
const agente = (args.find(a => a.startsWith('--agente='))?.split('=')[1] ?? 'peter').toLowerCase()
const universo: Universo = agente === 'small' ? 'small_cap' : 'large_cap'
const etiqueta = universo === 'small_cap' ? 'Small' : 'Peter'

const CAPAS_VALIDAS = ['lynch+tecnico', 'lynch', 'tecnico'] as const
const capasArg = args.find(a => a.startsWith('--capas='))?.split('=')[1] ?? 'lynch+tecnico'
if (!(CAPAS_VALIDAS as readonly string[]).includes(capasArg)) {
  console.error(`--capas debe ser una de: ${CAPAS_VALIDAS.join(', ')}`)
  process.exit(1)
}
const capas = capasArg as Capas

const NOMBRE_CAPAS: Record<Capas, string> = {
  'lynch+tecnico': 'cascada completa (Lynch + forecast + momentum)',
  'lynch': 'solo screener Lynch (sin capas técnicas)',
  'tecnico': 'solo señales técnicas (sin filtro fundamental)',
}

/** Sufijo de los ficheros de salida, para no pisar corridas de otra variante. */
const sufijo = capas === 'lynch+tecnico' ? agente : `${agente}-${capas.replace('+', '-')}`

/**
 * Cobertura mínima para empezar: por debajo el panel es demasiado ralo.
 *
 * Se exige que la fila sea **utilizable**, no solo que exista. El criterio de
 * crecimiento necesita dos ejercicios publicados, y Yahoo solo da cinco: al
 * principio de la serie hay filas con precio y capitalización pero con
 * `earningsGrowth` nulo, que nunca pueden alcanzar el corte de score. Contarlas
 * como cobertura arrancaba la ventana casi dos años antes de que el backtest
 * pudiera abrir la primera posición, y esos meses en liquidez diluían el CAGR y
 * contaminaban todos los contrastes.
 */
const COBERTURA_MINIMA = 0.5

function log(...xs: unknown[]) { console.log('[backtest]', ...xs) }

// ── Utilidades ──────────────────────────────────────────────────────────────

function retornosBenchmark(spy: PriceSeries, fechas: string[]): number[] {
  const out: number[] = []
  for (let i = 1; i < fechas.length; i++) {
    const a = indiceEn(spy.rows, fechas[i - 1])
    const b = indiceEn(spy.rows, fechas[i])
    out.push(a >= 0 && b > a ? spy.rows[b].adjClose / spy.rows[a].adjClose - 1 : 0)
  }
  return out
}

function curvaDe(retornos: number[], fechas: string[]) {
  let v = 1
  const curva = [{ fecha: fechas[0], valor: 1 }]
  retornos.forEach((r, i) => { v *= 1 + r; curva.push({ fecha: fechas[i + 1], valor: v }) })
  return curva
}

function resumen(res: ResultadoSimulacion, benchRet: number[]) {
  const rets = res.retornos.map(r => r.retorno)
  const m = metricasCurva(res.curva, rets, RISK_FREE)
  const vs = compararConBenchmark(rets, benchRet)
  const cerradas = res.operaciones.filter(op => op.retorno != null)
  return {
    ...m,
    ...vs,
    nOperaciones: cerradas.length,
    hitRate: cerradas.length ? cerradas.filter(op => op.retorno! > 0).length / cerradas.length : null,
    retornoMedioOperacion: cerradas.length
      ? cerradas.reduce((a, op) => a + op.retorno!, 0) / cerradas.length
      : null,
    posicionesMedias: res.posicionesPorFecha.length
      ? res.posicionesPorFecha.reduce((a, p) => a + p.n, 0) / res.posicionesPorFecha.length
      : 0,
  }
}

function escalar(opts: ScreenerOptions, k: number): ScreenerOptions {
  // Un umbral más laxo significa multiplicar los máximos y dividir el mínimo
  // de crecimiento: `k` > 1 afloja el filtro, `k` < 1 lo aprieta.
  return {
    ...opts,
    peTrailing: opts.peTrailing * k,
    peForward: opts.peForward * k,
    debtRatio: opts.debtRatio * k,
    pegMax: opts.pegMax * k,
    epsGrowth: opts.epsGrowth / k,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const universoTickers = [...new Set(universo === 'small_cap' ? SMALL_CAP_TICKERS : SP500_NASDAQ100_TICKERS)]
  const sectores: Record<string, string> = JSON.parse(await readFile(SECTORS_PATH, 'utf8'))

  log(`agente ${etiqueta} · ${NOMBRE_CAPAS[capas]}`)
  log(`universo declarado: ${universoTickers.length} tickers`)

  // Dos referencias: el índice de la clase de activo del universo (la
  // comparación justa) y el S&P 500 (la referencia de coste de oportunidad).
  const tickerBench = BENCHMARK_POR_UNIVERSO[universo]
  const benchRaw = await cargarTodo([...new Set([tickerBench, BENCHMARK])], '2015-01-01')
  const spy = benchRaw.series.get(tickerBench)
  const mercado = benchRaw.series.get(BENCHMARK)
  if (!spy) throw new Error(`falta la serie del benchmark ${tickerBench}; corre antes npm run backtest:fetch`)
  if (!mercado) throw new Error(`falta la serie de ${BENCHMARK}; corre antes npm run backtest:fetch`)

  const hoy = new Date().toISOString().slice(0, 10)
  const candidatasFechas = fechasRebalanceoMensual(spy.rows, '2018-01-01', hoy)

  const { series, fundamentales } = await cargarTodo(universoTickers, '2018-01-01')
  log(`con datos en caché: ${series.size} con precios, ${fundamentales.size} con fundamentales`)

  // Yahoo devuelve 5 ejercicios anuales pero el más antiguo viene siempre sin
  // `netIncome`: la profundidad real con datos es 4, y como el crecimiento
  // necesita dos ejercicios, solo 3 puntos sirven de arranque.
  const profundidadReal = [...fundamentales.values()]
    .map(f => f.annual.filter(r => r.netIncome != null).length)
  const medianaReal = mediana(profundidadReal)
  log(`ejercicios anuales con datos: mediana ${medianaReal} (Yahoo devuelve ${mediana([...fundamentales.values()].map(f => f.annual.length))} fechas, la más antigua viene vacía)`)

  // Primera fecha con cobertura suficiente: antes de eso Yahoo no tiene aún
  // ejercicios publicados para la mayoría del universo.
  const conFund = [...fundamentales.keys()].filter(t => series.has(t))
  const utilizable = (t: string, f: string) => {
    const fila = construirFila(t, f, series.get(t)!, fundamentales.get(t)!)
    return fila != null && fila.earningsGrowth != null
  }

  let fechas: string[] = []
  for (const f of candidatasFechas) {
    const n = conFund.filter(t => utilizable(t, f)).length
    if (n / conFund.length >= COBERTURA_MINIMA) { fechas = candidatasFechas.slice(candidatasFechas.indexOf(f)); break }
  }
  if (fechas.length < 6) throw new Error('no hay suficientes fechas con cobertura de fundamentales')

  log(`ventana: ${fechas[0]} → ${fechas[fechas.length - 1]} (${fechas.length} rebalanceos mensuales)`)
  log(`benchmark: ${tickerBench}${tickerBench === BENCHMARK ? '' : ` (y ${BENCHMARK} como mercado amplio)`}`)

  const panel = construirPanel({ universo, tickers: conFund, fechas, series, fundamentales })
  const benchRet = retornosBenchmark(spy, fechas)
  const benchCurva = curvaDe(benchRet, fechas)
  const metricasBench = metricasCurva(benchCurva, benchRet, RISK_FREE)

  const mercadoRet = retornosBenchmark(mercado, fechas)
  const mercadoCurva = curvaDe(mercadoRet, fechas)
  const metricasMercado = metricasCurva(mercadoCurva, mercadoRet, RISK_FREE)

  const opts = opcionesDe(universo)
  const criteriosLimpios = CRITERIOS_TODOS.filter(c => !CRITERIOS_PROXY.includes(c as never)) as NombreCriterio[]

  // `capas` viaja en el escenario base y en todas las variantes, para que los
  // contrastes se apliquen a la configuración que se está evaluando.
  const corre = (o: Partial<OpcionesSimulacion>) => simular(panel, series, { universo, capas, ...o })

  // ── Escenario base: la cascada completa reproducible ─────────────────────
  const base = corre({})
  log(`base: ${base.operaciones.length} operaciones, ${resumen(base, benchRet).posicionesMedias.toFixed(1)} posiciones medias`)

  // Meses iniciales sin ninguna posición: son liquidez, no selección, y si son
  // muchos arrastran el CAGR y los contrastes hacia cero.
  const mesesVacios = base.posicionesPorFecha.findIndex(p => p.n > 0)
  const vaciosIniciales = mesesVacios < 0 ? base.posicionesPorFecha.length : mesesVacios
  if (vaciosIniciales > 0) {
    log(`AVISO: ${vaciosIniciales} de ${fechas.length} meses iniciales sin posiciones (cartera en liquidez)`)
  }

  // ── 1 · Ventaja estadística ──────────────────────────────────────────────
  const retsBase = base.retornos.map(r => r.retorno)
  const activos = retsBase.map((r, i) => r - benchRet[i])
  const rng = crearRng(SEED)
  const bootstrap = bootstrapBloques(activos, rng, N_REPLICAS)

  // ── 2 · Test de control: carteras aleatorias emparejadas ─────────────────
  // Empareja por sector y decil de capitalización para que la comparación no
  // sea "el filtro" contra "otro sesgo de sector/tamaño".
  const seleccionReal = new Map(base.posicionesPorFecha.map(p => [p.fecha, p.n]))
  const perfilPorFecha = perfilDeSeleccion(panel, base, sectores)

  const distribucionControl: number[] = []
  for (let k = 0; k < 200; k++) {
    const rngK = crearRng(SEED + k * 7919)
    const ctrl = corre({
      aleatorio: {
        elegir: (filas, fecha) => elegirEmparejado(filas, fecha, perfilPorFecha, seleccionReal, sectores, rngK),
      },
    })
    const r = ctrl.retornos.map(x => x.retorno)
    distribucionControl.push(metricasCurva(ctrl.curva, r, RISK_FREE).cagr ?? 0)
  }
  const cagrBase = metricasCurva(base.curva, retsBase, RISK_FREE).cagr ?? 0
  const percentilControl = percentil(distribucionControl, cagrBase)

  // ── 3 · Atribución por criterio ──────────────────────────────────────────
  const porScore: Record<string, ReturnType<typeof resumen>> = {}
  for (let s = 3; s <= 6; s++) {
    const r = corre({ capas: 'lynch', corteScore: s })
    porScore[`score>=${s}`] = resumen(r, benchRet)
  }

  const leaveOneOut: Record<string, ReturnType<typeof resumen>> = {}
  for (const c of (capas === 'tecnico' ? [] : CRITERIOS_TODOS)) {
    const restantes = CRITERIOS_TODOS.filter(x => x !== c) as NombreCriterio[]
    const r = corre({ criterios: restantes, corteScore: corteDeProduccion(universo, restantes.length) })
    leaveOneOut[`sin_${c}`] = resumen(r, benchRet)
  }

  const porCapa = {
    solo_lynch: resumen(corre({ capas: 'lynch' }), benchRet),
    solo_tecnico: resumen(corre({ capas: 'tecnico' }), benchRet),
    cascada: resumen(base, benchRet),
  }

  // ── 4 · Robustez ─────────────────────────────────────────────────────────
  const robustez = {
    sin_costes: resumen(corre({ costeBps: 0 }), benchRet),
    ponderado_por_capitalizacion: resumen(corre({ pesos: 'cap' }), benchRet),
    criterios_limpios_sin_proxy: resumen(
      corre({ criterios: criteriosLimpios, corteScore: corteDeProduccion(universo, criteriosLimpios.length) }),
      benchRet,
    ),
    umbrales_20pct_mas_laxos: resumen(corre({ opts: escalar(opts, 1.2) }), benchRet),
    umbrales_20pct_mas_estrictos: resumen(corre({ opts: escalar(opts, 0.8) }), benchRet),
  }

  // ── Barrido de umbrales ──────────────────────────────────────────────────
  // Responde a "¿conviene aflojar o apretar los filtros?". Un pico aislado es
  // sobreajuste; solo una relación monótona sugiere señal real. Cada variante
  // se desglosa además por subperiodo: si el resultado sale de un solo tramo,
  // no es una regla, es una racha.
  const multiplicadores = capas === 'tecnico' ? [] : [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4]
  const barridoUmbrales = multiplicadores.map(k => {
    const r = corre({ opts: escalar(opts, k) })
    const rr = r.retornos.map(x => x.retorno)
    return {
      multiplicador: k,
      etiqueta: k < 1 ? `${Math.round((1 - k) * 100)} % más estricto`
        : k > 1 ? `${Math.round((k - 1) * 100)} % más laxo`
        : 'umbrales de producción',
      ...resumen(r, benchRet),
      subperiodos: calcularSubperiodos(fechas, rr, benchRet),
    }
  })

  // Mismo barrido sobre el corte de score, que es el otro eje de "aflojar".
  const barridoCorte = (capas === 'tecnico' ? [] : [3, 4, 5, 6]).map(c => {
    const r = corre({ corteScore: c })
    const rr = r.retornos.map(x => x.retorno)
    return {
      corteScore: c,
      ...resumen(r, benchRet),
      subperiodos: calcularSubperiodos(fechas, rr, benchRet),
    }
  })

  const subperiodos = calcularSubperiodos(fechas, retsBase, benchRet)

  // ── Sharpe deflactado ────────────────────────────────────────────────────
  // Nº de configuraciones probadas en este mismo script: hay que penalizarlas.
  const sharpesProbados = [
    ...Object.values(porScore), ...Object.values(leaveOneOut),
    ...Object.values(porCapa), ...Object.values(robustez),
  ].map(v => v.sharpe).filter((x): x is number => x != null)

  const nPruebas = 1 + sharpesProbados.length
  const sharpeBase = metricasCurva(base.curva, retsBase, RISK_FREE).sharpe ?? 0
  // Varianza empírica de los Sharpe (por periodo) entre las configuraciones
  // realmente probadas: es la dispersión que hay que descontar.
  const sdEntrePruebas = desviacion(sharpesProbados.map(x => x / Math.sqrt(PERIODOS_POR_ANIO)))
  const dsr = deflatedSharpe(
    retsBase, sharpeBase, nPruebas, PERIODOS_POR_ANIO,
    sdEntrePruebas != null ? sdEntrePruebas ** 2 : null,
  )

  // ── Prueba de look-ahead ─────────────────────────────────────────────────
  // Con retardo de publicación 0 el backtest usa datos que nadie tenía: el
  // Sharpe debe SUBIR. Si no sube, el lag no se está aplicando.
  const panelSinLag = construirPanel({
    universo, tickers: conFund, fechas, series, fundamentales, lagDias: 0,
  })
  const baseSinLag = simular(panelSinLag, series, { universo, capas })
  const retsSinLag = baseSinLag.retornos.map(r => r.retorno)
  const sharpeSinLag = metricasCurva(baseSinLag.curva, retsSinLag, RISK_FREE).sharpe
  const sinLag = {
    sharpeConLag: sharpeBase,
    sharpeSinLag,
    /** Si el Sharpe no sube al quitar el retardo, el retardo no está actuando. */
    lagEfectivo: sharpeSinLag != null && sharpeSinLag > sharpeBase,
  }

  const manifest = JSON.parse(await readFile(path.join(DATA_DIR, '_manifest.json'), 'utf8'))

  // Calibración frente al screener en vivo, si se ha corrido `backtest:paridad`.
  const paridad = await leerJson(path.join(DATA_DIR, `paridad-${universo}.json`))

  const salida = {
    generado: new Date().toISOString(),
    agente: etiqueta,
    universo,
    capas,
    capasDescripcion: NOMBRE_CAPAS[capas],
    parametros: {
      umbrales: opts,
      corteScore: corteDeProduccion(universo, CRITERIOS_TODOS.length),
      reportingLagDias: REPORTING_LAG_DIAS_ANUAL,
      costeBps: COSTE_TRANSACCION_BPS,
      riskFree: RISK_FREE,
      periodosPorAnio: PERIODOS_POR_ANIO,
      replicas: N_REPLICAS,
      semilla: SEED,
    },
    muestra: {
      tickersDeclarados: universoTickers.length,
      tickersConDatos: conFund.length,
      tickersSinPrecios: manifest.sinPrecios?.length ?? 0,
      sesgoSupervivenciaPct: manifest.total
        ? ((manifest.sinPrecios?.length ?? 0) / manifest.total) * 100
        : null,
      medianaEjerciciosAnuales: manifest.medianaEjerciciosAnuales ?? null,
      medianaEjerciciosConDatos: medianaReal,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      nRebalanceos: fechas.length,
      mesesInicialesEnLiquidez: vaciosIniciales,
    },
    base: resumen(base, benchRet),
    benchmark: { ticker: tickerBench, ...metricasBench },
    mercadoAmplio: tickerBench === BENCHMARK
      ? null
      : { ticker: BENCHMARK, ...metricasMercado, ...compararConBenchmark(retsBase, mercadoRet) },
    ventajaEstadistica: {
      contrasteRetornoActivo: contrastarMedia(activos),
      bootstrapBloques: bootstrap,
      deflatedSharpe: dsr,
      nConfiguracionesProbadas: nPruebas,
    },
    testDeControl: {
      nCarteras: distribucionControl.length,
      cagrBase,
      cagrControlMediano: mediana(distribucionControl),
      percentilDeLaCarteraReal: percentilControl,
    },
    atribucion: { porScore, leaveOneOut, porCapa },
    robustez: { ...robustez, subperiodos, pruebaLookAhead: sinLag },
    sensibilidad: { barridoUmbrales, barridoCorte },
    paridadConElScreenerEnVivo: paridad,
    curvas: {
      cartera: base.curva,
      benchmark: benchCurva,
      mercadoAmplio: tickerBench === BENCHMARK ? null : mercadoCurva,
    },
    operaciones: base.operaciones,
  }

  await mkdir(DATA_DIR, { recursive: true })
  const jsonPath = path.join(DATA_DIR, `resultados-${sufijo}.json`)
  await writeFile(jsonPath, JSON.stringify(salida, null, 2))

  const mdPath = path.join(DATA_DIR, `informe-${sufijo}.md`)
  await writeFile(mdPath, escribirInforme(salida))

  log(`listo → ${path.relative(process.cwd(), jsonPath)}`)
  log(`informe → ${path.relative(process.cwd(), mdPath)}`)
}

// ── Auxiliares del test de control ──────────────────────────────────────────

interface PerfilFecha { sectores: string[]; decilesCap: number[] }

function decilCap(fila: PanelRow, ordenadas: number[]): number {
  if (fila.marketCap == null || !ordenadas.length) return -1
  const pos = ordenadas.findIndex(v => v >= fila.marketCap!)
  return Math.min(9, Math.floor(((pos < 0 ? ordenadas.length - 1 : pos) / ordenadas.length) * 10))
}

/** Sectores y deciles de tamaño que tenía la cartera real en cada fecha. */
function perfilDeSeleccion(
  panel: Panel, base: ResultadoSimulacion, sectores: Record<string, string>,
): Map<string, PerfilFecha> {
  const abiertasEn = new Map<string, Set<string>>()
  for (const fecha of panel.fechas) {
    const vivas = base.operaciones
      .filter(op => op.fechaEntrada <= fecha && (op.fechaSalida == null || op.fechaSalida > fecha))
      .map(op => op.ticker)
    abiertasEn.set(fecha, new Set(vivas))
  }

  const out = new Map<string, PerfilFecha>()
  for (const fecha of panel.fechas) {
    const filas = panel.porFecha.get(fecha) ?? []
    const ordenadas = filas.map(f => f.marketCap ?? 0).filter(v => v > 0).sort((a, b) => a - b)
    const vivas = abiertasEn.get(fecha) ?? new Set()
    const seleccion = filas.filter(f => vivas.has(f.ticker))
    out.set(fecha, {
      sectores: seleccion.map(f => sectores[f.ticker] ?? '—'),
      decilesCap: seleccion.map(f => decilCap(f, ordenadas)),
    })
  }
  return out
}

/** Elige al azar respetando el reparto por sector y decil de tamaño del original. */
function elegirEmparejado(
  filas: PanelRow[],
  fecha: string,
  perfil: Map<string, PerfilFecha>,
  nPorFecha: Map<string, number>,
  sectores: Record<string, string>,
  rng: () => number,
): string[] {
  const p = perfil.get(fecha)
  const n = nPorFecha.get(fecha) ?? 0
  if (!p || n === 0) return []

  const ordenadas = filas.map(f => f.marketCap ?? 0).filter(v => v > 0).sort((a, b) => a - b)
  const elegidos: string[] = []
  const usados = new Set<string>()

  for (let i = 0; i < p.sectores.length; i++) {
    const sector = p.sectores[i]
    const decil = p.decilesCap[i]
    const pool = filas.filter(f =>
      !usados.has(f.ticker) &&
      (sectores[f.ticker] ?? '—') === sector &&
      decilCap(f, ordenadas) === decil,
    )
    // Si el estrato exacto se agota, se relaja primero el decil y luego el sector.
    const fallback = pool.length ? pool
      : filas.filter(f => !usados.has(f.ticker) && (sectores[f.ticker] ?? '—') === sector)
    const final = fallback.length ? fallback : filas.filter(f => !usados.has(f.ticker))
    const [elegido] = muestrear(final.map(f => f.ticker), 1, rng)
    if (elegido) { elegidos.push(elegido); usados.add(elegido) }
  }
  return elegidos
}

// ── Subperiodos y look-ahead ────────────────────────────────────────────────

function calcularSubperiodos(fechas: string[], rets: number[], bench: number[]) {
  // Tramos de calendario fijos. Con la ventana corta que permite Yahoo, los
  // primeros quedan vacíos y el informe los omite en vez de pintarlos con
  // guiones.
  const tramos: Array<{ nombre: string; desde: string; hasta: string }> = [
    { nombre: '2022 (mercado bajista)', desde: '2022-01-01', hasta: '2022-12-31' },
    { nombre: '2023', desde: '2023-01-01', hasta: '2023-12-31' },
    { nombre: '2024', desde: '2024-01-01', hasta: '2024-12-31' },
    { nombre: '2025', desde: '2025-01-01', hasta: '2025-12-31' },
    { nombre: '2026 en adelante', desde: '2026-01-01', hasta: '2099-12-31' },
  ]
  return tramos.map(t => {
    const idx = rets.map((_, i) => i).filter(i => fechas[i + 1] >= t.desde && fechas[i + 1] <= t.hasta)
    if (idx.length < 3) return { ...t, nPeriodos: idx.length, retornoAcumulado: null, retornoActivoMedio: null }
    const r = idx.map(i => rets[i])
    const b = idx.map(i => bench[i])
    return {
      ...t,
      nPeriodos: r.length,
      retornoAcumulado: r.reduce((a, x) => a * (1 + x), 1) - 1,
      retornoAcumuladoBenchmark: b.reduce((a, x) => a * (1 + x), 1) - 1,
      retornoActivoMedio: r.reduce((a, x, i) => a + (x - b[i]), 0) / r.length,
    }
  })
}

async function leerJson(p: string): Promise<unknown | null> {
  try { return JSON.parse(await readFile(p, 'utf8')) } catch { return null }
}

function mediana(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

main().catch((e) => { console.error(e); process.exit(1) })
