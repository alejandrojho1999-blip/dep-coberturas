import { describe, it, expect } from 'vitest'
import {
  evaluarSubconjunto, corteDeProduccion, opcionesDe, mesesEntre, muestrear,
  simular, CRITERIOS_TODOS,
} from '@/lib/backtest/engine'
import { LARGE_CAP_OPTIONS, SMALL_CAP_OPTIONS } from '@/lib/peter-lynch/screener'
import { crearRng } from '@/lib/backtest/stats'
import type { Panel, PanelRow, PriceRow, PriceSeries } from '@/lib/backtest/types'

const filaBase = (over: Partial<PanelRow> = {}): PanelRow => ({
  ticker: 'AAA',
  fecha: '2024-01-31',
  close: 100,
  adjClose: 100,
  reporteAsOf: '2022-12-31',
  reportePublicoDesde: '2023-03-31',
  trailingPE: 10,
  forwardPE: 8,
  debtToEquity: 0.1,
  earningsGrowth: 0.5,
  pegRatio: 1,
  marketCap: 10_000_000_000,
  ...over,
})

describe('opcionesDe', () => {
  it('devuelve los umbrales de producción de cada universo', () => {
    expect(opcionesDe('large_cap')).toBe(LARGE_CAP_OPTIONS)
    expect(opcionesDe('small_cap')).toBe(SMALL_CAP_OPTIONS)
  })
})

describe('corteDeProduccion', () => {
  it('Peter exige todos los criterios', () => {
    expect(corteDeProduccion('large_cap', 6)).toBe(6)
    expect(corteDeProduccion('large_cap', 4)).toBe(4)
  })

  it('Small mantiene la proporción 4 de 6 al reducir criterios', () => {
    expect(corteDeProduccion('small_cap', 6)).toBe(4)
    expect(corteDeProduccion('small_cap', 4)).toBe(3)
  })
})

describe('evaluarSubconjunto', () => {
  it('puntúa 6 sobre 6 cuando la acción cumple todo', () => {
    const { score } = evaluarSubconjunto(filaBase(), LARGE_CAP_OPTIONS, CRITERIOS_TODOS)
    expect(score).toBe(6)
  })

  it('no cuenta los criterios excluidos del subconjunto', () => {
    const fila = filaBase({ pegRatio: 99, forwardPE: 99 })   // falla PEG y forwardPE
    const todos = evaluarSubconjunto(fila, LARGE_CAP_OPTIONS, CRITERIOS_TODOS)
    const limpios = evaluarSubconjunto(fila, LARGE_CAP_OPTIONS, ['pe_historico', 'deuda_capital', 'crecimiento_eps', 'market_cap'])
    expect(todos.score).toBe(4)
    expect(limpios.score).toBe(4)   // los 4 restantes siguen cumpliéndose
  })

  it('un dato ausente nunca cuenta como criterio cumplido', () => {
    const { criteria } = evaluarSubconjunto(filaBase({ trailingPE: null }), LARGE_CAP_OPTIONS, CRITERIOS_TODOS)
    expect(criteria.pe_historico).toBe(false)
  })

  it('una capitalización de small cap no pasa el filtro de tamaño de Peter', () => {
    const { criteria } = evaluarSubconjunto(filaBase({ marketCap: 5e8 }), LARGE_CAP_OPTIONS, CRITERIOS_TODOS)
    expect(criteria.market_cap).toBe(false)
  })
})

describe('mesesEntre', () => {
  it('cuenta meses de calendario', () => {
    expect(mesesEntre('2024-01-31', '2025-01-01')).toBe(12)
    expect(mesesEntre('2024-01-01', '2024-01-31')).toBe(0)
  })
})

describe('muestrear', () => {
  it('es reproducible con la misma semilla', () => {
    const xs = ['a', 'b', 'c', 'd', 'e']
    expect(muestrear(xs, 3, crearRng(1))).toEqual(muestrear(xs, 3, crearRng(1)))
  })

  it('no repite elementos', () => {
    const out = muestrear(['a', 'b', 'c'], 3, crearRng(7))
    expect(new Set(out).size).toBe(3)
  })

  it('no devuelve más elementos de los que hay', () => {
    expect(muestrear(['a', 'b'], 5, crearRng(7))).toHaveLength(2)
  })
})

// ── Simulación sobre un mercado sintético ───────────────────────────────────

/** Serie diaria con retorno constante, para que el resultado sea predecible. */
function serieConstante(ticker: string, fechas: string[], r: number): PriceSeries {
  const rows: PriceRow[] = []
  let p = 100
  for (const date of fechas) {
    rows.push({ date, close: p, adjClose: p, volume: 1_000_000 })
    p *= 1 + r
  }
  return { ticker, rows, splits: [] }
}

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  const d = new Date(`${desde}T00:00:00Z`)
  const fin = new Date(`${hasta}T00:00:00Z`)
  while (d <= fin) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

describe('simular', () => {
  const fechasRebalanceo = ['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30']
  const dias = diasEntre('2023-09-01', '2024-05-31')

  const ganador = serieConstante('WIN', dias, 0.002)
  const perdedor = serieConstante('LOSE', dias, -0.002)
  const series = new Map<string, PriceSeries>([['WIN', ganador], ['LOSE', perdedor]])

  function panelCon(cumple: (t: string) => boolean): Panel {
    const porFecha = new Map<string, PanelRow[]>()
    for (const fecha of fechasRebalanceo) {
      porFecha.set(fecha, ['WIN', 'LOSE'].map(t => {
        const serie = series.get(t)!
        const row = serie.rows.find(r => r.date === fecha)!
        return filaBase({
          ticker: t, fecha, close: row.close, adjClose: row.adjClose,
          // El perdedor incumple todo salvo el tamaño.
          trailingPE: cumple(t) ? 10 : 999,
          forwardPE: cumple(t) ? 8 : 999,
          debtToEquity: cumple(t) ? 0.1 : 9,
          earningsGrowth: cumple(t) ? 0.5 : -0.5,
          pegRatio: cumple(t) ? 1 : 99,
        })
      }))
    }
    return { universo: 'large_cap', fechas: fechasRebalanceo, porFecha }
  }

  it('solo abre posiciones en los tickers que pasan el corte', () => {
    const res = simular(panelCon(t => t === 'WIN'), series, { universo: 'large_cap', capas: 'lynch' })
    expect(new Set(res.operaciones.map(o => o.ticker))).toEqual(new Set(['WIN']))
  })

  it('la curva sube si el seleccionado sube', () => {
    const res = simular(panelCon(t => t === 'WIN'), series, { universo: 'large_cap', capas: 'lynch' })
    expect(res.curva[res.curva.length - 1].valor).toBeGreaterThan(1)
  })

  it('vende cuando el ticker deja de pasar el screener y las señales técnicas', () => {
    // El perdedor entra en la primera fecha y luego incumple: sale por señal.
    const panel = panelCon(() => true)
    const res = simular(panel, series, { universo: 'large_cap', capas: 'lynch' })
    const perdedorOps = res.operaciones.filter(o => o.ticker === 'LOSE')
    expect(perdedorOps.length).toBeGreaterThan(0)
  })

  it('los costes reducen el retorno', () => {
    const panel = panelCon(t => t === 'WIN')
    const conCoste = simular(panel, series, { universo: 'large_cap', capas: 'lynch', costeBps: 200 })
    const sinCoste = simular(panel, series, { universo: 'large_cap', capas: 'lynch', costeBps: 0 })
    const ultimo = (r: typeof conCoste) => r.curva[r.curva.length - 1].valor
    expect(ultimo(conCoste)).toBeLessThan(ultimo(sinCoste))
  })

  it('no abre dos veces el mismo ticker', () => {
    const res = simular(panelCon(() => true), series, { universo: 'large_cap', capas: 'lynch' })
    const aperturas = res.operaciones.filter(o => o.ticker === 'WIN').map(o => o.fechaEntrada)
    expect(new Set(aperturas).size).toBe(aperturas.length)
  })

  it('sin candidatos la curva se queda plana', () => {
    const res = simular(panelCon(() => false), series, { universo: 'large_cap', capas: 'lynch' })
    expect(res.curva.every(p => p.valor === 1)).toBe(true)
  })

  it('el gancho aleatorio sustituye por completo al filtro', () => {
    const res = simular(panelCon(() => false), series, {
      universo: 'large_cap', capas: 'lynch',
      aleatorio: { elegir: () => ['LOSE'] },
    })
    expect(res.operaciones.some(o => o.ticker === 'LOSE')).toBe(true)
  })
})
