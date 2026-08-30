/**
 * Convierte los CSV de operaciones exportados del Strategy Analyzer de
 * NinjaTrader en los JSON que consume la sección de Estrategias.
 *
 * Se ejecuta a mano cuando se actualizan los backtests:
 *
 *     node scripts/build-estrategias.mjs
 *
 * El script no inventa nada: todo lo que emite sale de las operaciones
 * individuales. Las cifras publicadas en cada tesis se usan solo para
 * CONTRASTAR el resultado, nunca para sustituirlo. Si un número no cuadra, el
 * script lo dice en voz alta en vez de taparlo.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(RAIZ, 'public/estrategias/docs')
const SALIDA = join(RAIZ, 'public/estrategias/data')

/** El backtest está en NQ; la cartera opera el micro, que vale la décima parte. */
const FACTOR_MNQ = 10

/**
 * Corte de régimen. Las seis tesis lo sitúan en julio de 2020: antes de esa
 * fecha cinco de las seis estrategias son estadísticamente nulas.
 */
const CORTE_REGIMEN = '2020-07-01'

/**
 * Catálogo de entrada. `esperado` son las cifras publicadas en cada tesis, en
 * NQ, que sirven de control del parser.
 */
const ESTRATEGIAS = [
  {
    slug: 'overnight-drift',
    nombre: 'Overnight Drift',
    esperado: { operaciones: 2076, neto: 244197, drawdown: -41951 },
  },
  {
    slug: 'rsi2-reversion',
    nombre: 'RSI2 Reversion',
    esperado: { operaciones: 131, neto: 188295, drawdown: -20407 },
  },
  {
    slug: 'zigzag-breakout',
    nombre: 'ZigZag Breakout',
    esperado: { operaciones: 532, neto: 180470, drawdown: -38630 },
  },
  {
    slug: 'weekend-effect',
    nombre: 'Weekend Effect',
    esperado: { operaciones: 443, neto: 153638, drawdown: -23172 },
  },
  {
    slug: 'momentum-apertura',
    nombre: 'Momentum de Apertura',
    esperado: { operaciones: 327, neto: 63686, drawdown: -9831 },
  },
  {
    slug: 'ibs-reversion',
    nombre: 'IBS Reversion',
    esperado: { operaciones: 329, neto: 63115, drawdown: -25946 },
  },
]

// ─────────────────────────────── Parseo ────────────────────────────────

/**
 * Los importes vienen como `$-1.155,76`: símbolo de dólar, punto de millares y
 * coma decimal. `Number()` los lee como NaN, así que hay que normalizarlos.
 */
export function parseImporte(txt) {
  if (txt == null) return NaN
  const limpio = String(txt).trim().replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.')
  if (limpio === '' || limpio === '-') return NaN
  return Number(limpio)
}

/** Las fechas son `d/m/YYYY H:MM:SS`, con día primero. Devuelve `YYYY-MM-DD`. */
export function parseFecha(txt) {
  if (!txt) return null
  const [fecha] = String(txt).trim().split(' ')
  const [dia, mes, anio] = fecha.split('/')
  if (!dia || !mes || !anio) return null
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

/** Lee el CSV del Strategy Analyzer y devuelve las operaciones normalizadas. */
export function parseTrades(csv) {
  const lineas = csv.split(/\r?\n/).filter(l => l.trim() !== '')
  const cabecera = lineas[0].split(';').map(c => c.trim())
  const col = nombre => cabecera.indexOf(nombre)

  const iEntrada = col('Entry time')
  const iSalida = col('Exit time')
  const iProfit = col('Profit')
  const iPrecioEntrada = col('Entry price')
  const iPrecioSalida = col('Exit price')
  const iNombreSalida = col('Exit name')
  const iMae = col('MAE')
  const iBarras = col('Bars')

  if (iSalida < 0 || iProfit < 0) {
    throw new Error('El CSV no tiene las columnas "Exit time" y "Profit" esperadas')
  }

  return lineas.slice(1).map(linea => {
    const c = linea.split(';')
    return {
      entrada: parseFecha(c[iEntrada]),
      salida: parseFecha(c[iSalida]),
      // El resultado se atribuye a la fecha de SALIDA: es el criterio con el
      // que el expediente construye la curva combinada de la cartera.
      pnl: parseImporte(c[iProfit]) / FACTOR_MNQ,
      precioEntrada: parseImporte(c[iPrecioEntrada]),
      precioSalida: parseImporte(c[iPrecioSalida]),
      motivoSalida: (c[iNombreSalida] ?? '').trim(),
      mae: parseImporte(c[iMae]) / FACTOR_MNQ,
      barras: Number(c[iBarras]) || 0,
    }
  }).filter(t => t.salida && Number.isFinite(t.pnl))
}

// ───────────────────────────── Cálculos ─────────────────────────────────

/** Suma el resultado de todas las operaciones cerradas cada día. */
export function pnlDiario(trades) {
  const porDia = new Map()
  for (const t of trades) {
    porDia.set(t.salida, (porDia.get(t.salida) ?? 0) + t.pnl)
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, pnl]) => ({ fecha, pnl }))
}

/**
 * Curva acumulada y serie underwater a partir del PnL diario.
 *
 * El drawdown se MIDE sobre la curva, nunca se estima: es la distancia al
 * máximo previo en cada punto.
 */
export function curva(diario) {
  let acumulado = 0
  let pico = 0
  let maxDrawdown = 0
  let fechaMaxDrawdown = null

  const equity = []
  const drawdown = []

  for (const { fecha, pnl } of diario) {
    acumulado += pnl
    if (acumulado > pico) pico = acumulado
    const bajoElAgua = acumulado - pico
    if (bajoElAgua < maxDrawdown) {
      maxDrawdown = bajoElAgua
      fechaMaxDrawdown = fecha
    }
    equity.push({ fecha, valor: redondear(acumulado) })
    drawdown.push({ fecha, valor: redondear(bajoElAgua) })
  }

  return { equity, drawdown, maxDrawdown, fechaMaxDrawdown, neto: acumulado }
}

/** Resultado por año natural, atribuido por fecha de salida. */
export function porAnio(trades) {
  const acc = new Map()
  for (const t of trades) {
    const anio = t.salida.slice(0, 4)
    const fila = acc.get(anio) ?? { anio, pnl: 0, operaciones: 0, ganadoras: 0 }
    fila.pnl += t.pnl
    fila.operaciones += 1
    if (t.pnl > 0) fila.ganadoras += 1
    acc.set(anio, fila)
  }
  return [...acc.values()]
    .sort((a, b) => a.anio.localeCompare(b.anio))
    .map(f => ({ ...f, pnl: redondear(f.pnl) }))
}

/**
 * Histograma de resultados por operación.
 *
 * Los extremos se agrupan en un cubo abierto a cada lado para que las colas no
 * estiren el eje y aplasten el centro de la distribución.
 */
export function distribucion(trades, cubos = 21) {
  const valores = trades.map(t => t.pnl).sort((a, b) => a - b)
  if (valores.length === 0) return []

  const p = q => valores[Math.min(valores.length - 1, Math.floor(q * valores.length))]
  const min = p(0.02)
  const max = p(0.98)
  const ancho = (max - min) / cubos || 1

  const bins = Array.from({ length: cubos }, (_, i) => ({
    desde: redondear(min + i * ancho),
    hasta: redondear(min + (i + 1) * ancho),
    operaciones: 0,
  }))

  let colaIzquierda = 0
  let colaDerecha = 0
  for (const v of valores) {
    if (v < min) { colaIzquierda += 1; continue }
    if (v > max) { colaDerecha += 1; continue }
    const i = Math.min(cubos - 1, Math.floor((v - min) / ancho))
    bins[i].operaciones += 1
  }

  return [
    ...(colaIzquierda ? [{ desde: null, hasta: redondear(min), operaciones: colaIzquierda, cola: 'izquierda' }] : []),
    ...bins,
    ...(colaDerecha ? [{ desde: redondear(max), hasta: null, operaciones: colaDerecha, cola: 'derecha' }] : []),
  ]
}

/**
 * Concentración del beneficio.
 *
 * Es la métrica que distingue una ventaja repetible de una cola derecha
 * afortunada, así que se calcula siempre aunque el resultado incomode.
 */
export function concentracion(trades, neto) {
  const ordenadas = [...trades].sort((a, b) => b.pnl - a.pnl)
  const tramos = [1, 3, 5, 10, 20]
  return tramos
    .filter(n => n <= ordenadas.length)
    .map(n => {
      const suma = ordenadas.slice(0, n).reduce((s, t) => s + t.pnl, 0)
      return {
        top: n,
        suma: redondear(suma),
        porcentajeDelNeto: neto === 0 ? null : redondear((suma / neto) * 100, 1),
        resto: redondear(neto - suma),
      }
    })
}

/** Estadístico t del beneficio medio por operación. */
export function tStat(valores) {
  const n = valores.length
  if (n < 2) return null
  const media = valores.reduce((s, v) => s + v, 0) / n
  const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)
  const desviacion = Math.sqrt(varianza)
  if (desviacion === 0) return null
  return redondear(media / (desviacion / Math.sqrt(n)), 2)
}

/**
 * Duración de una serie diaria, en años.
 *
 * Se mide de punta a punta y no contando años naturales distintos: la cartera
 * arranca el 14 de enero de 2015 y termina el 14 de agosto de 2026, que son
 * 11,58 años y no 12. Contar etiquetas de año inflaba el denominador un 3,6 % y
 * hundía el beneficio anual publicado por debajo del que fija el expediente.
 */
export function aniosCubiertos(diario) {
  if (diario.length < 2) return 0
  const dias = (new Date(`${diario.at(-1).fecha}T00:00:00Z`) - new Date(`${diario[0].fecha}T00:00:00Z`)) / 86_400_000
  return dias / 365.25
}

/**
 * Calmar: cuántas veces cabe el peor drawdown en el beneficio de un año medio.
 *
 * A diferencia del Net/DD, que crece solo con la longitud del backtest, esta
 * cifra está normalizada por tiempo y sí se puede comparar con la de fuera.
 * Se calcula de forma aritmética —beneficio anual medio sobre drawdown— porque
 * la cartera opera a tamaño fijo: no hay reinversión que un CAGR pudiera
 * capturar. El resultado es el mismo se mida en dólares o en porcentaje de la
 * cuenta, ya que ambos términos se escalan por la misma base.
 */
export function calmar(neto, anios, maxDrawdown) {
  if (anios === 0 || maxDrawdown === 0) return null
  return redondear(Math.abs(neto / anios / maxDrawdown), 2)
}

/** Profit factor: cuánto gana el sistema por cada dólar que pierde. */
export function profitFactor(trades) {
  const ganado = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const perdido = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0))
  if (perdido === 0) return null
  return redondear(ganado / perdido, 2)
}

/** Corte pre/post julio de 2020, el eje del análisis de régimen. */
export function regimen(trades) {
  const bloque = subset => {
    if (subset.length === 0) return null
    const neto = subset.reduce((s, t) => s + t.pnl, 0)
    return {
      operaciones: subset.length,
      neto: redondear(neto),
      profitFactor: profitFactor(subset),
      tStat: tStat(subset.map(t => t.pnl)),
      porOperacion: redondear(neto / subset.length),
    }
  }
  return {
    corte: CORTE_REGIMEN,
    anterior: bloque(trades.filter(t => t.salida < CORTE_REGIMEN)),
    posterior: bloque(trades.filter(t => t.salida >= CORTE_REGIMEN)),
  }
}

function mediana(valores) {
  if (valores.length === 0) return null
  const o = [...valores].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/**
 * Reduce una serie conservando su forma.
 *
 * `modo: 'minimo'` se queda con el punto más bajo de cada tramo, que es lo
 * correcto para una serie underwater: el peor momento de la ventana es el dato
 * que interesa, no uno cualquiera.
 */
function submuestrear(serie, maximo, modo = 'ultimo') {
  if (serie.length <= maximo) return serie
  const paso = serie.length / maximo
  const salida = []
  for (let i = 0; i < maximo; i++) {
    const desde = Math.floor(i * paso)
    const hasta = Math.min(serie.length, Math.floor((i + 1) * paso))
    let elegido = serie[desde]
    if (modo === 'minimo') {
      for (let j = desde; j < hasta; j++) {
        if (serie[j].valor < elegido.valor) elegido = serie[j]
      }
    } else {
      elegido = serie[hasta - 1] ?? elegido
    }
    salida.push(elegido)
  }
  // El último punto siempre: es el neto final y no puede perderse.
  if (salida.at(-1) !== serie.at(-1)) salida.push(serie[serie.length - 1])
  return salida
}

function redondear(n, decimales = 2) {
  if (!Number.isFinite(n)) return null
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

/** Construye el bloque completo de una estrategia a partir de sus operaciones. */
export function construir(trades) {
  const diario = pnlDiario(trades)
  const { equity, drawdown, maxDrawdown, fechaMaxDrawdown, neto } = curva(diario)
  const pnls = trades.map(t => t.pnl)
  const ganadoras = trades.filter(t => t.pnl > 0)
  const anios = aniosCubiertos(diario)

  return {
    resumen: {
      operaciones: trades.length,
      neto: redondear(neto),
      drawdown: redondear(maxDrawdown),
      fechaDrawdown: fechaMaxDrawdown,
      netoSobreDrawdown: maxDrawdown === 0 ? null : redondear(Math.abs(neto / maxDrawdown), 2),
      anios: redondear(anios, 2),
      netoPorAnio: anios === 0 ? 0 : redondear(neto / anios),
      calmar: calmar(neto, anios, maxDrawdown),
      profitFactor: profitFactor(trades),
      tStat: tStat(pnls),
      aciertos: redondear((ganadoras.length / trades.length) * 100, 1),
      porOperacion: redondear(neto / trades.length),
      medianaOperacion: redondear(mediana(pnls)),
      mejor: redondear(Math.max(...pnls)),
      peor: redondear(Math.min(...pnls)),
      desde: diario[0]?.fecha ?? null,
      hasta: diario.at(-1)?.fecha ?? null,
    },
    equity,
    drawdown,
    anual: porAnio(trades),
    distribucion: distribucion(trades),
    concentracion: concentracion(trades, neto),
    regimen: regimen(trades),
  }
}

// ─────────────────────────────── Salida ────────────────────────────────

function contrastar(nombre, calculado, esperadoNQ) {
  // Las tesis publican en NQ; aquí se trabaja en MNQ.
  const esperado = {
    operaciones: esperadoNQ.operaciones,
    neto: esperadoNQ.neto / FACTOR_MNQ,
    drawdown: esperadoNQ.drawdown / FACTOR_MNQ,
  }
  const desvio = (a, b) => (b === 0 ? 0 : Math.abs((a - b) / b) * 100)

  const filas = [
    ['operaciones', calculado.operaciones, esperado.operaciones],
    ['neto', calculado.neto, esperado.neto],
    ['drawdown', calculado.drawdown, esperado.drawdown],
  ]

  const avisos = []
  for (const [campo, obtenido, referencia] of filas) {
    const d = desvio(obtenido, referencia)
    // El drawdown de la tesis se mide sobre la curva de operaciones y aquí
    // sobre la diaria, así que un desvío pequeño es esperable.
    const tolerancia = campo === 'operaciones' ? 0 : 12
    const marca = d <= tolerancia ? 'ok' : 'REVISAR'
    if (marca === 'REVISAR') avisos.push({ campo, obtenido, esperado: referencia, desvio: redondear(d, 1) })
    console.log(
      `    ${campo.padEnd(12)} ${String(obtenido).padStart(12)}  tesis ${String(redondear(referencia)).padStart(12)}  ${marca}`
    )
  }
  return avisos
}

function main() {
  if (!existsSync(SALIDA)) mkdirSync(SALIDA, { recursive: true })

  const seriesDiarias = []
  const componentes = []

  for (const est of ESTRATEGIAS) {
    const ruta = join(DOCS, `${est.slug}-trades.csv`)
    if (!existsSync(ruta)) {
      console.log(`\n${est.nombre}: SIN CSV (${est.slug}-trades.csv) — se omite`)
      continue
    }

    const trades = parseTrades(readFileSync(ruta, 'utf8'))
    const datos = construir(trades)

    console.log(`\n${est.nombre}  (${est.slug})`)
    const avisos = contrastar(est.nombre, datos.resumen, est.esperado)
    datos.verificacion = {
      contrastadoCon: 'las cifras publicadas en la tesis, escaladas a MNQ',
      avisos,
    }
    datos.slug = est.slug
    datos.nombre = est.nombre

    writeFileSync(join(SALIDA, `${est.slug}.json`), JSON.stringify(datos))
    seriesDiarias.push({ slug: est.slug, nombre: est.nombre, diario: pnlDiario(trades) })
    componentes.push({
      slug: est.slug,
      nombre: est.nombre,
      neto: datos.resumen.neto,
      drawdown: datos.resumen.drawdown,
      netoSobreDrawdown: datos.resumen.netoSobreDrawdown,
      calmar: datos.resumen.calmar,
      operaciones: datos.resumen.operaciones,
    })
  }

  // ── La cartera: se suma el PnL diario real de las seis series ──────────
  const combinado = new Map()
  for (const { diario } of seriesDiarias) {
    for (const { fecha, pnl } of diario) {
      combinado.set(fecha, (combinado.get(fecha) ?? 0) + pnl)
    }
  }
  const diarioCartera = [...combinado.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, pnl]) => ({ fecha, pnl }))

  const cartera = curva(diarioCartera)
  const netoTotal = cartera.neto
  const sumaDrawdowns = componentes.reduce((s, c) => s + c.drawdown, 0)

  // Meses en positivo: el expediente lo publica como medida de regularidad.
  const porMes = new Map()
  for (const { fecha, pnl } of diarioCartera) {
    const mes = fecha.slice(0, 7)
    porMes.set(mes, (porMes.get(mes) ?? 0) + pnl)
  }
  const meses = [...porMes.values()]
  const mesesPositivos = meses.filter(v => v > 0).length

  const anios = aniosCubiertos(diarioCartera)

  const datosCartera = {
    resumen: {
      estrategias: componentes.length,
      operaciones: componentes.reduce((s, c) => s + c.operaciones, 0),
      neto: redondear(netoTotal),
      drawdown: redondear(cartera.maxDrawdown),
      fechaDrawdown: cartera.fechaMaxDrawdown,
      netoSobreDrawdown: redondear(Math.abs(netoTotal / cartera.maxDrawdown), 2),
      calmar: calmar(netoTotal, anios, cartera.maxDrawdown),
      tStat: tStat(diarioCartera.map(d => d.pnl)),
      sumaDrawdownsIndividuales: redondear(sumaDrawdowns),
      reduccionDrawdown: redondear((1 - Math.abs(cartera.maxDrawdown / sumaDrawdowns)) * 100, 1),
      mesesPositivos: redondear((mesesPositivos / meses.length) * 100, 1),
      mesesTotales: meses.length,
      mesesEnPositivo: mesesPositivos,
      porAnio: redondear(netoTotal / anios),
      desde: diarioCartera[0]?.fecha ?? null,
      hasta: diarioCartera.at(-1)?.fecha ?? null,
    },
    // La cartera se sirve por props desde el servidor, así que sus curvas se
    // recortan a la resolución que los gráficos van a dibujar de todas formas.
    equity: submuestrear(cartera.equity, 420),
    drawdown: submuestrear(cartera.drawdown, 420, 'minimo'),
    anual: (() => {
      const acc = new Map()
      for (const { fecha, pnl } of diarioCartera) {
        const anio = fecha.slice(0, 4)
        acc.set(anio, (acc.get(anio) ?? 0) + pnl)
      }
      return [...acc.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([anio, pnl]) => ({ anio, pnl: redondear(pnl), operaciones: 0, ganadoras: 0 }))
    })(),
    componentes: componentes.map(c => ({
      ...c,
      porcentajeDelNeto: redondear((c.neto / netoTotal) * 100, 1),
    })),
    // Curvas individuales para dibujarlas detrás de la combinada.
    curvasIndividuales: seriesDiarias.map(({ slug, nombre, diario }) => ({
      slug,
      nombre,
      // Van de fondo en trazo fino: 180 puntos bastan y evitan que el JSON de
      // la cartera pese más que todo lo demás junto.
      equity: submuestrear(curva(diario).equity, 180),
    })),
    regimen: (() => {
      const bloque = subset => {
        if (subset.length === 0) return null
        const c = curva(subset)
        return {
          neto: redondear(c.neto),
          drawdown: redondear(c.maxDrawdown),
          netoSobreDrawdown: c.maxDrawdown === 0 ? null : redondear(Math.abs(c.neto / c.maxDrawdown), 2),
          calmar: calmar(c.neto, aniosCubiertos(subset), c.maxDrawdown),
        }
      }
      return {
        corte: CORTE_REGIMEN,
        anterior: bloque(diarioCartera.filter(d => d.fecha < CORTE_REGIMEN)),
        posterior: bloque(diarioCartera.filter(d => d.fecha >= CORTE_REGIMEN)),
      }
    })(),
  }

  writeFileSync(join(SALIDA, 'cartera.json'), JSON.stringify(datosCartera))

  console.log('\n── Cartera combinada ──────────────────────────────')
  console.log(`    estrategias        ${datosCartera.resumen.estrategias}`)
  console.log(`    operaciones        ${datosCartera.resumen.operaciones}   (expediente: 3838)`)
  console.log(`    neto               ${datosCartera.resumen.neto}   (expediente: 89341)`)
  console.log(`    drawdown           ${datosCartera.resumen.drawdown}   (expediente: -4099)`)
  console.log(`    Net/DD             ${datosCartera.resumen.netoSobreDrawdown}   (expediente: 21,79)`)
  console.log(`    por año            ${datosCartera.resumen.porAnio}   (expediente: 7714)`)
  console.log(`    Calmar             ${datosCartera.resumen.calmar}   (expediente: 1,88)`)
  console.log(`    suma de DD indiv.  ${datosCartera.resumen.sumaDrawdownsIndividuales}   (expediente: -15994)`)
  console.log(`    reducción del DD   ${datosCartera.resumen.reduccionDrawdown} %   (expediente: 74 %)`)
  console.log(`    meses positivos    ${datosCartera.resumen.mesesPositivos} %`)
  console.log('\nListo.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
