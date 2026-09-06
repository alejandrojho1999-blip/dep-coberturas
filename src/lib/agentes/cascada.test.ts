import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Pruebas de la cascada programada de Peter y Small.
 *
 * Fijan lo que distingue a los dos agentes y lo que la hace segura de repetir
 * todos los días: el corte de score, la regla de venta, el dedupe y —lo más
 * caro de equivocar— que el paso 4 no se llame cuando no queda nadie a quien
 * analizar. Todo lo que sale de la máquina está simulado: estas pruebas no
 * tocan Yahoo, ni OpenRouter, ni Supabase.
 */

const runScreener = vi.hoisted(() => vi.fn())
const forecastDeTickers = vi.hoisted(() => vi.fn())
const momentumDeTickers = vi.hoisted(() => vi.fn())
const analizarTicker = vi.hoisted(() => vi.fn())

vi.mock('@/lib/peter-lynch/screener', () => ({ runScreener }))
vi.mock('./historicos', () => ({ forecastDeTickers, momentumDeTickers }))
vi.mock('./analisis', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  analizarTicker,
}))

const { ejecutarCascada, CASCADA_CATEGORIES, isCascadaCategory } = await import('./cascada')

// ── Dobles ──────────────────────────────────────────────────────────────────

interface Escritura { tabla: string; op: 'insert' | 'update'; datos: Record<string, unknown> }

/**
 * Supabase de mentira que registra lo que se le escribe.
 *
 * `vivos` son las posiciones abiertas que devuelve el paso 0; `existentes` los
 * tickers que el dedupe debe encontrar ya vivos en el paso 5.
 */
function supabaseFalso(opts: {
  vivos?: Array<{ id: string; ticker: string; precio_entrada: number; estado: string }>
  existentes?: string[]
} = {}) {
  const escrituras: Escritura[] = []
  const vivos = opts.vivos ?? []
  const existentes = new Set(opts.existentes ?? [])

  function from(tabla: string) {
    const estado: { op?: 'insert' | 'update'; ticker?: string; select?: string } = {}

    const q: Record<string, unknown> = {
      select(cols: string) { estado.select = cols; return q },
      insert(datos: Record<string, unknown>) {
        escrituras.push({ tabla, op: 'insert', datos })
        return Promise.resolve({ data: datos, error: null })
      },
      update(datos: Record<string, unknown>) {
        estado.op = 'update'
        escrituras.push({ tabla, op: 'update', datos })
        return q
      },
      eq(col: string, val: unknown) {
        if (col === 'ticker') estado.ticker = String(val)
        return q
      },
      neq() { return q },
      limit() { return q },
      maybeSingle() {
        // Dedupe del paso 5.
        const hit = estado.ticker != null && existentes.has(estado.ticker)
        return Promise.resolve({ data: hit ? { id: `existente-${estado.ticker}` } : null, error: null })
      },
      // El paso 0 espera directamente la cadena, sin `maybeSingle`.
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve({ data: estado.op === 'update' ? null : vivos, error: null }).then(resolve)
      },
    }
    return q
  }

  return { cliente: { from } as unknown as SupabaseClient, escrituras }
}

function candidato(ticker: string, score: number) {
  return { ticker, name: `${ticker} Inc`, score }
}

function forecastOk(lastPrice = 100) {
  return { lastPrice, forecastPrice: lastPrice * 1.1, forecastReturn: 10, pass: true }
}

function momentumOk() {
  return { rsi: 60, macd: 1, signal: 0.5, volumeTrend: 1.3, score: 3, pass: true }
}

function dictamenAprobado() {
  return {
    empresa: 'Ejemplo SA', direction: 'COMPRA', riesgo: 'MEDIO', timeframe: 'MEDIANO',
    precio_objetivo: 130, stop_loss: 92, resumen: 'Tesis.', conviction: 8, consensus: 'ALCISTA',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  forecastDeTickers.mockResolvedValue({})
  momentumDeTickers.mockResolvedValue({})
  analizarTicker.mockResolvedValue(dictamenAprobado())
})

// ── Pruebas ─────────────────────────────────────────────────────────────────

describe('categorías de la cascada', () => {
  it('solo reconoce a Peter y a Small', () => {
    expect(isCascadaCategory('PETER_LYNCH')).toBe(true)
    expect(isCascadaCategory('SMALL_CAPS')).toBe(true)
    // Gamma y Theta operan contratos: su ciclo es `runExitReview`, no este.
    expect(isCascadaCategory('OPTIONS_GAMMA')).toBe(false)
    expect(isCascadaCategory('')).toBe(false)
    expect(CASCADA_CATEGORIES).toHaveLength(2)
  })
})

describe('el corte de score separa a los dos agentes', () => {
  it('Peter exige los seis criterios y descarta un 5/6', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 6), candidato('BBB', 5)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk(), BBB: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk(), BBB: momentumOk() })
    const { cliente, escrituras } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(r.candidatos).toBe(1)
    expect(escrituras.filter(e => e.op === 'insert').map(e => e.datos.ticker)).toEqual(['AAA'])
  })

  it('Small acepta desde 4/6 y descarta un 3/6', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 4), candidato('BBB', 3)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk(), BBB: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk(), BBB: momentumOk() })
    const { cliente, escrituras } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'SMALL_CAPS')

    expect(r.candidatos).toBe(1)
    expect(escrituras.filter(e => e.op === 'insert').map(e => e.datos.ticker)).toEqual(['AAA'])
  })

  it('pide a Yahoo el universo que le toca a cada agente', async () => {
    runScreener.mockResolvedValue([])
    const { cliente } = supabaseFalso()

    await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')
    expect(runScreener).toHaveBeenCalledWith(false, 'large_cap')

    await ejecutarCascada(cliente, 'u1', 'SMALL_CAPS')
    expect(runScreener).toHaveBeenCalledWith(false, 'small_cap')
  })
})

describe('el paso 4 solo se llama sobre supervivientes', () => {
  it('no gasta un solo token si nadie pasa el forecast', async () => {
    // Es la garantía de coste de toda la cascada: el único paso que se paga va
    // detrás de tres filtros deterministas. Si alguien reordenara los pasos,
    // esta prueba es la que lo delata.
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: { ...forecastOk(), pass: false } })
    const { cliente, escrituras } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(analizarTicker).not.toHaveBeenCalled()
    expect(momentumDeTickers).not.toHaveBeenCalledWith(['AAA'])
    expect(r.trasForecast).toBe(0)
    expect(escrituras.filter(e => e.op === 'insert')).toHaveLength(0)
  })

  it('tampoco lo gasta si nadie pasa el momentum', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: { ...momentumOk(), pass: false } })
    const { cliente } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(analizarTicker).not.toHaveBeenCalled()
    expect(r.trasMomentum).toBe(0)
  })

  it('descarta sin analizar al candidato sin precio de mercado fiable', async () => {
    // El precio de entrada sale de aquí. Analizar sobre un precio ausente
    // produciría un objetivo y un stop construidos sobre una cifra inventada.
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: { ...forecastOk(), lastPrice: 0 } })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk() })
    const { cliente, escrituras } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(analizarTicker).not.toHaveBeenCalled()
    expect(escrituras.filter(e => e.op === 'insert')).toHaveLength(0)
    expect(r.creadas).toBe(0)
  })
})

describe('guardado y dedupe', () => {
  it('guarda el precio real de mercado como entrada, nunca la proyección', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk(50) })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk() })
    const { cliente, escrituras } = supabaseFalso()

    await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    const insert = escrituras.find(e => e.op === 'insert')
    expect(insert?.datos.precio_entrada).toBe(50)
    // La proyección era 55; si acabara aquí, el rendimiento nacería falseado.
    expect(insert?.datos.precio_entrada).not.toBe(55)
    expect(insert?.datos.user_id).toBe('u1')
    expect(insert?.datos.direction).toBe('COMPRA')
  })

  it('no duplica un ticker que ya tiene posición viva', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk() })
    const { cliente, escrituras } = supabaseFalso({ existentes: ['AAA'] })

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(r.omitidas).toBe(1)
    expect(r.creadas).toBe(0)
    expect(escrituras.filter(e => e.op === 'insert')).toHaveLength(0)
  })

  it('no guarda un dictamen con convicción insuficiente', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk() })
    analizarTicker.mockResolvedValue({ ...dictamenAprobado(), conviction: 6 })
    const { cliente, escrituras } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(r.aprobadas).toBe(0)
    expect(escrituras.filter(e => e.op === 'insert')).toHaveLength(0)
  })

  it('no guarda un dictamen bajista aunque venga con convicción alta', async () => {
    // La cartera es solo larga: un pick bajista invertiría el signo del P&L.
    runScreener.mockResolvedValue([candidato('AAA', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk() })
    analizarTicker.mockResolvedValue({ ...dictamenAprobado(), direction: 'VENTA', conviction: 9 })
    const { cliente, escrituras } = supabaseFalso()

    await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(escrituras.filter(e => e.op === 'insert')).toHaveLength(0)
  })

  it('sigue con el resto de candidatos cuando el modelo falla en uno', async () => {
    runScreener.mockResolvedValue([candidato('AAA', 6), candidato('BBB', 6)])
    forecastDeTickers.mockResolvedValue({ AAA: forecastOk(), BBB: forecastOk() })
    momentumDeTickers.mockResolvedValue({ AAA: momentumOk(), BBB: momentumOk() })
    analizarTicker
      .mockRejectedValueOnce(new Error('OpenRouter 503'))
      .mockResolvedValueOnce(dictamenAprobado())
    const { cliente, escrituras } = supabaseFalso()

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(r.fallidos).toBe(1)
    expect(escrituras.filter(e => e.op === 'insert').map(e => e.datos.ticker)).toEqual(['BBB'])
  })
})

describe('paso 0: re-evaluación de posiciones vivas', () => {
  const vivo = { id: 'p1', ticker: 'ZZZ', precio_entrada: 100, estado: 'Comprar' }

  it('vende cuando fallan dos de las tres señales', async () => {
    // ZZZ no está en el screener (falla Lynch) y falla el forecast: 2 de 3.
    runScreener.mockResolvedValue([])
    forecastDeTickers.mockResolvedValue({ ZZZ: { ...forecastOk(80), pass: false } })
    momentumDeTickers.mockResolvedValue({ ZZZ: momentumOk() })
    const { cliente, escrituras } = supabaseFalso({ vivos: [vivo] })

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(r.vendidas).toBe(1)
    const update = escrituras.find(e => e.op === 'update')
    expect(update?.datos.estado).toBe('Vender')
    expect(update?.datos.precio_venta).toBe(80)
    // Entrada 100, salida 80: una pérdida del 20 %, registrada como tal.
    expect(update?.datos.rentabilidad).toBe(-20)
    expect(update?.datos.closed_at).toBeTruthy()
  })

  it('mantiene la posición cuando solo falla una señal', async () => {
    runScreener.mockResolvedValue([candidato('ZZZ', 6)])
    forecastDeTickers.mockResolvedValue({ ZZZ: { ...forecastOk(), pass: false } })
    momentumDeTickers.mockResolvedValue({ ZZZ: momentumOk() })
    const { cliente, escrituras } = supabaseFalso({ vivos: [vivo] })

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    expect(r.vendidas).toBe(0)
    expect(escrituras.filter(e => e.op === 'update')).toHaveLength(0)
  })

  it('una caída de Yahoo no vende: la señal sin datos cuenta como aprobada', async () => {
    // Sin este trato, un corte de datos marcaría fallo en forecast y momentum a
    // la vez y liquidaría la cartera entera de una pasada.
    runScreener.mockResolvedValue([])
    forecastDeTickers.mockResolvedValue({})
    momentumDeTickers.mockResolvedValue({})
    const { cliente, escrituras } = supabaseFalso({ vivos: [vivo] })

    const r = await ejecutarCascada(cliente, 'u1', 'PETER_LYNCH')

    // Solo falla Lynch (1 de 3), porque las otras dos se dan por buenas.
    expect(r.vendidas).toBe(0)
    expect(escrituras.filter(e => e.op === 'update')).toHaveLength(0)
  })
})
