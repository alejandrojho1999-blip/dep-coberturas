/**
 * Comprobación de paridad: ¿cuánto se parece el panel reconstruido a lo que el
 * screener ve hoy en vivo?
 *
 * No puede haber coincidencia perfecta: en vivo Yahoo da PER y crecimiento TTM,
 * mientras que el panel los reconstruye del último ejercicio anual publicado.
 * Lo que mide esto es cuánto se desvía esa aproximación, criterio a criterio.
 * Un acuerdo bajo invalida la lectura del backtest.
 *
 * Uso: npm run backtest:paridad -- --universo=large_cap
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  runScreener, SP500_NASDAQ100_TICKERS, SMALL_CAP_TICKERS,
} from '@/lib/peter-lynch/screener'
import { DATA_DIR } from '@/lib/backtest/config'
import { cargarTodo, construirFila } from '@/lib/backtest/panel'
import { evaluarSubconjunto, opcionesDe, corteDeProduccion, CRITERIOS_TODOS } from '@/lib/backtest/engine'
import type { Universo } from '@/lib/backtest/types'

const arg = process.argv.slice(2).find(a => a.startsWith('--universo='))?.split('=')[1]
const universo: Universo = arg === 'small_cap' ? 'small_cap' : 'large_cap'

async function main(): Promise<void> {
  const hoy = new Date().toISOString().slice(0, 10)
  const tickers = [...new Set(universo === 'small_cap' ? SMALL_CAP_TICKERS : SP500_NASDAQ100_TICKERS)]

  console.log(`[paridad] ${universo} · descargando el screener en vivo…`)
  const vivo = await runScreener(true, universo)
  const vivoPorTicker = new Map(vivo.map(r => [r.ticker, r]))

  const { series, fundamentales } = await cargarTodo(tickers, '2024-01-01')
  const opts = opcionesDe(universo)
  const corte = corteDeProduccion(universo, CRITERIOS_TODOS.length)

  const acuerdos: Record<string, { igual: number; total: number }> = {}
  for (const c of CRITERIOS_TODOS) acuerdos[c] = { igual: 0, total: 0 }

  const pasaPanel = new Set<string>()
  const pasaVivo = new Set(vivo.filter(r => r.score >= corte).map(r => r.ticker))
  let comparados = 0

  for (const ticker of tickers) {
    const serie = series.get(ticker)
    const fund = fundamentales.get(ticker)
    const enVivo = vivoPorTicker.get(ticker)
    if (!serie || !fund || !enVivo) continue

    const fila = construirFila(ticker, hoy, serie, fund)
    if (!fila) continue

    const { criteria, score } = evaluarSubconjunto(fila, opts, CRITERIOS_TODOS)
    if (score >= corte) pasaPanel.add(ticker)
    comparados++

    for (const c of CRITERIOS_TODOS) {
      acuerdos[c].total++
      if (criteria[c] === enVivo.criteria[c]) acuerdos[c].igual++
    }
  }

  const interseccion = [...pasaPanel].filter(t => pasaVivo.has(t))
  const union = new Set([...pasaPanel, ...pasaVivo])

  const salida = {
    generado: new Date().toISOString(),
    universo,
    comparados,
    seleccionEnVivo: [...pasaVivo].sort(),
    seleccionDelPanel: [...pasaPanel].sort(),
    jaccard: union.size ? interseccion.length / union.size : null,
    acuerdoPorCriterio: Object.fromEntries(
      Object.entries(acuerdos).map(([c, a]) => [c, a.total ? a.igual / a.total : null]),
    ),
  }

  const out = path.join(DATA_DIR, `paridad-${universo}.json`)
  await writeFile(out, JSON.stringify(salida, null, 2))

  console.log(`[paridad] tickers comparados: ${comparados}`)
  console.log(`[paridad] pasan en vivo: ${pasaVivo.size} · pasan en el panel: ${pasaPanel.size} · en ambos: ${interseccion.length}`)
  for (const [c, v] of Object.entries(salida.acuerdoPorCriterio)) {
    console.log(`[paridad]   ${c.padEnd(16)} ${v != null ? (v * 100).toFixed(1) + ' %' : '—'}`)
  }
  console.log(`[paridad] → ${path.relative(process.cwd(), out)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
