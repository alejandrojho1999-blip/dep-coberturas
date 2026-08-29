/**
 * Publica en el repositorio el resumen del backtest de opciones.
 *
 * Uso:
 *   npm run backtest:publicar-opciones
 *
 * Igual que su hermano de acciones, destila los `resultados-opciones-*.json` de
 * `data/backtest/opciones/` —que no se versiona— en un JSON pequeño que la
 * pantalla importa estáticamente. No recalcula nada: copia campo a campo.
 *
 * Requiere haber corrido antes las cuatro variantes:
 *   npm run backtest:opciones
 *   npm run backtest:opciones -- --modo=regimen
 *   npm run backtest:opciones -- --skew
 *   npm run backtest:opciones -- --sin-niveles
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DIR_OPCIONES, VENTANA_VOL_REALIZADA } from '@/lib/backtest/opciones/config'
import { volatilidadRealizada, primaDeVarianza } from '@/lib/backtest/opciones/volatilidad'
import type {
  AgenteOpciones, PuntoBarrido, PuntoCalibracion, ResumenOpciones, VarianteOpciones,
} from '@/lib/backtest/opciones-publicado'

const SALIDA = path.resolve(process.cwd(), 'src/lib/backtest/opciones-resumen-publicado.json')

/** Las corridas que se publican, en el orden en que aparecen en pantalla. */
const CORRIDAS = [
  { id: 'constante', fichero: 'resultados-opciones-constante.json', etiqueta: 'IV proporcional a la realizada' },
  { id: 'regimen', fichero: 'resultados-opciones-regimen.json', etiqueta: 'IV escalada por el régimen del VIX' },
  { id: 'skew', fichero: 'resultados-opciones-constante-skew.json', etiqueta: 'Con sesgo por moneyness' },
  { id: 'sin-niveles', fichero: 'resultados-opciones-constante-sin-niveles.json', etiqueta: 'Sin niveles de salida' },
] as const

const DESCRIPCION_AGENTE: Record<string, string> = {
  gamma: 'Compra opciones. Paga la prima y gana si el subyacente se mueve a su favor.',
  theta: 'Vende opciones. Cobra la prima y gana si el subyacente no se desploma.',
}

const r = (x: unknown, d = 6): number => {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  const f = 10 ** d
  return Math.round(n * f) / f
}

/* eslint-disable @typescript-eslint/no-explicit-any -- el JSON del motor es
   dinámico por diseño; los tipos publicados se fijan al salir, no al entrar. */
type Crudo = any

function metricas(a: Crudo, sinPos: number) {
  const m = a.metricas ?? {}
  const c = a.comparacion ?? {}
  return {
    nPeriodos: m.nPeriodos ?? 0,
    retornoTotal: r(m.retornoTotal),
    cagr: r(m.cagr),
    volatilidadAnual: r(m.volatilidadAnual),
    sharpe: r(m.sharpe),
    maxDrawdown: r(m.maxDrawdown),
    retornoActivoMedio: r(c.retornoActivoMedio),
    trackingError: r(c.trackingError),
    informationRatio: r(c.informationRatio),
    beta: r(c.beta),
    alphaAnual: r(c.alphaAnual),
    tStat: r(c.contraste?.tStat, 4),
    pValor: r(c.contraste?.pValor, 4),
    bootstrapPValor: r(a.bootstrap?.pValor, 4),
    nOperaciones: a.nOperaciones ?? 0,
    hitRate: r(a.hitRate),
    vencimientosSinPosiciones: sinPos,
  }
}

async function main() {
  // ── Prima de varianza observada ──────────────────────────────────────────
  // Se publica porque es lo que impide leer mal el parámetro calibrado: su
  // mediana está muy por encima de 1, así que un ajuste por debajo de 1 no
  // significa que la implícita cotice barata.
  const leerSerie = async (t: string) => JSON.parse(
    await readFile(path.join(DIR_OPCIONES, `${t.replace('^', '_')}.json`), 'utf8'),
  ) as { rows: Array<{ date: string; close: number }> }

  const spy = await leerSerie('SPY')
  const vix = await leerSerie('^VIX')
  const idxVix = new Map(vix.rows.map((x, i) => [x.date, i]))
  const rv = volatilidadRealizada(spy.rows.map(x => x.close), VENTANA_VOL_REALIZADA)
  const vixAl = spy.rows.map(x => { const i = idxVix.get(x.date); return i != null ? vix.rows[i].close : NaN })
  const vals = primaDeVarianza(vixAl, rv).filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b)

  const primaObservada = {
    media: r(vals.reduce((a, b) => a + b, 0) / vals.length, 3),
    mediana: r(vals[Math.floor(vals.length / 2)], 3),
    p10: r(vals[Math.floor(vals.length * 0.1)], 3),
    p90: r(vals[Math.floor(vals.length * 0.9)], 3),
  }

  // ── Corridas ─────────────────────────────────────────────────────────────
  const variantes: VarianteOpciones[] = []
  const benchmarkCurvas: Record<string, Array<{ fecha: string; valor: number }>> = {}
  let ventana = { desde: '', hasta: '', nVencimientos: 0 }

  for (const corrida of CORRIDAS) {
    let crudo: Crudo
    try {
      crudo = JSON.parse(await readFile(path.join(DIR_OPCIONES, corrida.fichero), 'utf8'))
    } catch {
      console.error(`✗ Falta ${corrida.fichero}. Corre antes la variante que lo produce.`)
      process.exit(1)
    }

    ventana = {
      desde: crudo.ventana.desde, hasta: crudo.ventana.hasta,
      nVencimientos: crudo.ventana.nVencimientos,
    }

    const kOptimo = crudo.calibracion.kOptimo
    const rejilla: PuntoCalibracion[] = crudo.calibracion.rejilla.map((p: Crudo) => ({
      k: p.k,
      errorSeguimiento: r(p.te, 4),
      correlacion: r(p.correlacion, 4),
      calibrado: p.k === kOptimo,
    }))

    const agentes: AgenteOpciones[] = (['gamma', 'theta'] as const).map(id => {
      const a = crudo.agentes[id]
      const barrido: PuntoBarrido[] = crudo.barridoK.map((fila: Crudo) => ({
        k: fila.k,
        cagr: r(fila[id].cagr),
        sharpe: r(fila[id].sharpe),
        informationRatio: r(fila[id].informationRatio),
        tStat: r(fila[id].tStat, 4),
        nOperaciones: fila[id].nOperaciones ?? 0,
        calibrado: fila.k === kOptimo,
      }))

      // Curva del índice, reescalada al mismo capital inicial que el agente
      // para que las dos se puedan leer en el mismo gráfico.
      const curva = a.curva.map((p: Crudo) => ({ fecha: p.fecha, valor: r(p.valor, 2) }))

      // El índice es el mismo en las cuatro corridas: se guarda una sola vez.
      if (!benchmarkCurvas[id]) {
        benchmarkCurvas[id] = (a.benchmarkCurva ?? []).map((p: Crudo) => ({
          fecha: p.fecha, valor: r(p.valor, 2),
        }))
      }

      return {
        id,
        nombre: a.nombre,
        descripcion: DESCRIPCION_AGENTE[id],
        capital: a.capital,
        metricas: metricas(a, a.fechasSinPosiciones ?? 0),
        benchmark: {
          ticker: a.benchmark,
          cagr: r(a.benchmarkMetricas?.cagr ?? 0),
          volatilidadAnual: r(a.benchmarkMetricas?.volatilidadAnual ?? 0),
          sharpe: r(a.benchmarkMetricas?.sharpe ?? 0),
          maxDrawdown: r(a.benchmarkMetricas?.maxDrawdown ?? 0),
        },
        curva,
        barrido,
      }
    })

    variantes.push({
      id: corrida.id,
      modo: crudo.modo,
      descripcionModo: corrida.etiqueta,
      conSkew: crudo.skew,
      conNivelesDeSalida: crudo.nivelesDeSalida,
      calibracion: {
        kOptimo,
        errorSeguimiento: r(crudo.calibracion.errorSeguimiento, 4),
        correlacion: r(crudo.calibracion.correlacion, 4),
        rejilla,
      },
      agentes,
    })

    console.log(`· ${corrida.id.padEnd(12)} k*=${kOptimo}  corr ${crudo.calibracion.correlacion.toFixed(3)}  ` +
      agentes.map(a => `${a.nombre} ${(a.metricas.cagr * 100).toFixed(2)} %`).join('  '))
  }

  const resumen: ResumenOpciones = {
    generado: new Date().toISOString(),
    ventana,
    primaDeVarianzaObservada: primaObservada,
    benchmarkCurvas,
    variantes,
  }

  await writeFile(SALIDA, JSON.stringify(resumen, null, 2) + '\n', 'utf8')
  const kb = (Buffer.byteLength(JSON.stringify(resumen)) / 1024).toFixed(0)
  console.log(`\n✓ ${SALIDA} (${kb} kB) — ${ventana.desde} → ${ventana.hasta}, ${ventana.nVencimientos} vencimientos`)
  console.log(`  Prima de varianza observada: mediana ${primaObservada.mediana}`)
}

main().catch(e => { console.error(e); process.exit(1) })
