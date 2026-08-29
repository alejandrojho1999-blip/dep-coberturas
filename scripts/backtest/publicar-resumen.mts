/**
 * Fase 6 — Publica en el repositorio el resumen del backtest.
 *
 * Uso:
 *   npm run backtest:publicar
 *
 * `data/backtest/` está en `.gitignore`: es caché regenerable de cientos de
 * megas, y los `resultados-*.json` que produce el orquestador llevan las 3.838
 * operaciones una a una. La página `/agentes/backtest` no puede leer de ahí en
 * producción, así que este script destila lo que la interfaz necesita en
 * `src/lib/backtest/resumen-publicado.json`, que sí se versiona.
 *
 * No recalcula nada: copia campo a campo. Si una cifra de la pantalla no cuadra
 * con su informe, el fallo está aquí y no en la presentación.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_DIR } from '@/lib/backtest/config'
import type {
  CorteMetricas, IndicePublicado, MetricasPublicadas, ResumenPublicado,
  VariantePublicada,
} from '@/lib/backtest/publicado'
import { exportarDataset, rutaPublica, type BrutoExportable } from './dataset.mts'

/** Variantes que se publican, en el orden en que aparecen en pantalla. */
const VARIANTES = [
  { id: 'peter', fichero: 'resultados-peter.json' },
  { id: 'peter-lynch', fichero: 'resultados-peter-lynch.json' },
  { id: 'small', fichero: 'resultados-small.json' },
  { id: 'small-lynch', fichero: 'resultados-small-lynch.json' },
] as const

const SALIDA = path.resolve(process.cwd(), 'src/lib/backtest/resumen-publicado.json')

/** Forma mínima que este script necesita del `resultados-*.json`. */
interface Bruto {
  generado: string
  agente: string
  universo: string
  capas: string
  capasDescripcion: string
  muestra: Record<string, number | string>
  base: Record<string, number> & { contraste: { tStat: number; pValor: number } }
  benchmark: Record<string, number> & { ticker: string }
  mercadoAmplio: (Record<string, number> & { ticker: string }) | null
  ventajaEstadistica: {
    contrasteRetornoActivo: { tStat: number; pValor: number }
    bootstrapBloques: { pValor: number }
    deflatedSharpe: { probabilidad: number; sharpeEsperadoPorAzar: number }
    nConfiguracionesProbadas: number
  }
  testDeControl: {
    nCarteras: number
    cagrBase: number
    cagrControlMediano: number
    percentilDeLaCarteraReal: number
  }
  atribucion: {
    porCapa: Record<string, Record<string, number>>
    leaveOneOut: Record<string, Record<string, number>>
  }
  robustez: Record<string, unknown> & {
    subperiodos: Array<{
      nombre: string
      nPeriodos: number
      retornoAcumulado: number | null
      retornoActivoMedio: number | null
    }>
  }
  paridadConElScreenerEnVivo?: {
    comparados: number
    jaccard: number
    acuerdoPorCriterio: Record<string, number>
  }
  curvas: {
    cartera: Array<{ fecha: string; valor: number }>
    benchmark: Array<{ fecha: string; valor: number }>
    mercadoAmplio: Array<{ fecha: string; valor: number }> | null
  }
}

/** Redondea a los decimales que la interfaz llega a mostrar, no más. */
function r(x: number | null | undefined, decimales = 6): number {
  if (x == null || !Number.isFinite(x)) return 0
  const f = 10 ** decimales
  return Math.round(x * f) / f
}

function corte(m: Record<string, number> | undefined): CorteMetricas {
  return {
    cagr: r(m?.cagr),
    sharpe: r(m?.sharpe),
    informationRatio: r(m?.informationRatio),
  }
}

function indice(m: Record<string, number> & { ticker: string }): IndicePublicado {
  return {
    ticker: m.ticker,
    retornoTotal: r(m.retornoTotal),
    cagr: r(m.cagr),
    volatilidadAnual: r(m.volatilidadAnual),
    sharpe: r(m.sharpe),
    maxDrawdown: r(m.maxDrawdown),
  }
}

function metricas(b: Bruto['base']): MetricasPublicadas {
  return {
    nPeriodos: b.nPeriodos,
    retornoTotal: r(b.retornoTotal),
    cagr: r(b.cagr),
    volatilidadAnual: r(b.volatilidadAnual),
    sharpe: r(b.sharpe),
    maxDrawdown: r(b.maxDrawdown),
    retornoActivoMedio: r(b.retornoActivoMedio),
    trackingError: r(b.trackingError),
    informationRatio: r(b.informationRatio),
    beta: r(b.beta),
    alphaAnual: r(b.alphaAnual),
    tStat: r(b.contraste.tStat, 4),
    pValor: r(b.contraste.pValor, 4),
    nOperaciones: b.nOperaciones,
    hitRate: r(b.hitRate),
    posicionesMedias: r(b.posicionesMedias, 2),
  }
}

/** Las claves de robustez que se publican; el resto es ruido para la pantalla. */
const ROBUSTEZ_PUBLICADA = [
  'sin_costes',
  'ponderado_por_capitalizacion',
  'criterios_limpios_sin_proxy',
  'umbrales_20pct_mas_laxos',
  'umbrales_20pct_mas_estrictos',
] as const

function publicar(id: string, b: Bruto): VariantePublicada {
  const robustez: Record<string, CorteMetricas> = {}
  for (const clave of ROBUSTEZ_PUBLICADA) {
    const m = b.robustez[clave] as Record<string, number> | undefined
    if (m) robustez[clave] = corte(m)
  }

  // `cascada` solo es la cascada de producción en la corrida que la simula. En
  // una corrida `--capas=lynch` el motor la rellena con la propia variante, así
  // que publicarla ahí duplicaría la fila base bajo otro nombre.
  const porCapa: Record<string, CorteMetricas> = {}
  for (const [k, v] of Object.entries(b.atribucion.porCapa)) {
    if (k === 'cascada' && b.capas !== 'lynch+tecnico') continue
    porCapa[k] = corte(v)
  }

  const leaveOneOut: Record<string, CorteMetricas> = {}
  for (const [k, v] of Object.entries(b.atribucion.leaveOneOut)) leaveOneOut[k] = corte(v)

  return {
    id,
    agente: b.agente,
    universo: b.universo as VariantePublicada['universo'],
    capas: b.capas,
    capasDescripcion: b.capasDescripcion,
    generado: b.generado,

    muestra: {
      tickersDeclarados: Number(b.muestra.tickersDeclarados),
      tickersConDatos: Number(b.muestra.tickersConDatos),
      tickersSinPrecios: Number(b.muestra.tickersSinPrecios),
      sesgoSupervivenciaPct: r(Number(b.muestra.sesgoSupervivenciaPct), 2),
      medianaEjerciciosConDatos: Number(b.muestra.medianaEjerciciosConDatos),
      desde: String(b.muestra.desde),
      hasta: String(b.muestra.hasta),
      nRebalanceos: Number(b.muestra.nRebalanceos),
      mesesInicialesEnLiquidez: Number(b.muestra.mesesInicialesEnLiquidez),
    },

    base: metricas(b.base),
    benchmark: indice(b.benchmark),
    // En gran capitalización el benchmark ya es el mercado amplio: el motor
    // deja `mercadoAmplio` a null en vez de duplicar la misma serie.
    mercadoAmplio: b.mercadoAmplio ? indice(b.mercadoAmplio) : null,

    ventaja: {
      tStat: r(b.ventajaEstadistica.contrasteRetornoActivo.tStat, 4),
      pValor: r(b.ventajaEstadistica.contrasteRetornoActivo.pValor, 4),
      bootstrapPValor: r(b.ventajaEstadistica.bootstrapBloques.pValor, 4),
      deflatedSharpeProbabilidad: r(b.ventajaEstadistica.deflatedSharpe.probabilidad, 4),
      sharpeEsperadoPorAzar: r(b.ventajaEstadistica.deflatedSharpe.sharpeEsperadoPorAzar, 4),
      nConfiguracionesProbadas: b.ventajaEstadistica.nConfiguracionesProbadas,
    },

    control: {
      nCarteras: b.testDeControl.nCarteras,
      cagrBase: r(b.testDeControl.cagrBase),
      cagrControlMediano: r(b.testDeControl.cagrControlMediano),
      percentil: r(b.testDeControl.percentilDeLaCarteraReal, 2),
    },

    // Los tramos sin datos utilizables llegan con `retornoAcumulado: null` y se
    // publican así: la pantalla debe poder decir "no hay datos" en vez de un 0
    // que se leería como "no ganó nada".
    subperiodos: b.robustez.subperiodos.map(s => ({
      nombre: s.nombre,
      nPeriodos: s.nPeriodos,
      retornoAcumulado: s.retornoAcumulado == null ? null : r(s.retornoAcumulado),
      retornoActivoMedio: s.retornoActivoMedio == null ? null : r(s.retornoActivoMedio),
    })),

    porCapa,
    leaveOneOut,
    robustez,

    curvas: {
      cartera: b.curvas.cartera.map(p => ({ fecha: p.fecha, valor: r(p.valor, 4) })),
      benchmark: b.curvas.benchmark.map(p => ({ fecha: p.fecha, valor: r(p.valor, 4) })),
      mercadoAmplio: b.curvas.mercadoAmplio?.map(p => ({ fecha: p.fecha, valor: r(p.valor, 4) })) ?? null,
    },

    paridad: b.paridadConElScreenerEnVivo
      ? {
          comparados: b.paridadConElScreenerEnVivo.comparados,
          jaccard: r(b.paridadConElScreenerEnVivo.jaccard, 4),
          acuerdoPorCriterio: Object.fromEntries(
            Object.entries(b.paridadConElScreenerEnVivo.acuerdoPorCriterio).map(([k, v]) => [k, r(v, 4)]),
          ),
        }
      : null,
  }
}

async function main() {
  const variantes: VariantePublicada[] = []
  const brutos: BrutoExportable[] = []

  for (const v of VARIANTES) {
    const ruta = path.join(DATA_DIR, v.fichero)
    let bruto: Bruto
    try {
      bruto = JSON.parse(await readFile(ruta, 'utf8')) as Bruto
    } catch {
      console.error(
        `✗ Falta ${v.fichero}. Ejecuta antes el backtest que lo produce:\n` +
        `  npm run backtest:run -- --agente=${v.id.startsWith('small') ? 'small' : 'peter'}` +
        `${v.id.endsWith('-lynch') ? ' --capas=lynch' : ''}`,
      )
      process.exit(1)
    }
    variantes.push(publicar(v.id, bruto))
    brutos.push({ ...(bruto as unknown as BrutoExportable), id: v.id })
    console.log(`· ${v.id.padEnd(12)} ${bruto.muestra.nRebalanceos} rebalanceos, CAGR ${(bruto.base.cagr * 100).toFixed(2)} %`)
  }

  // La ventana común es la intersección: publicar la más larga de las cuatro
  // haría creer que todas se midieron sobre ese periodo.
  const desde = variantes.map(v => v.muestra.desde).sort().at(-1)!
  const hasta = variantes.map(v => v.muestra.hasta).sort()[0]
  const nMeses = Math.min(...variantes.map(v => v.base.nPeriodos))

  // El dataset descargable sale de la misma pasada: si se generara aparte,
  // pantalla y descargas podrían acabar contando corridas distintas.
  const exportados = await exportarDataset(brutos)
  for (const f of exportados) console.log(`· ${f.fichero.padEnd(30)} ${(f.bytes / 1024).toFixed(0)} kB`)

  const resumen: ResumenPublicado = {
    generado: new Date().toISOString(),
    ventana: { desde, hasta, nMeses },
    variantes,
    descargas: exportados.map(f => ({ ...f, ruta: rutaPublica(f.fichero) })),
  }

  await writeFile(SALIDA, JSON.stringify(resumen, null, 2) + '\n', 'utf8')
  const kb = (Buffer.byteLength(JSON.stringify(resumen)) / 1024).toFixed(0)
  console.log(`\n✓ ${SALIDA} (${kb} kB) — ventana ${desde} → ${hasta}, ${nMeses} meses`)
}

main().catch((e) => { console.error(e); process.exit(1) })
