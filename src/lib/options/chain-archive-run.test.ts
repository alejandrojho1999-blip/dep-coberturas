import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { archivarCadenas } from './chain-archive-run'
import * as yahoo from './yahoo-options'
import type { EnrichedOptionContract, OptionsChainData } from './yahoo-options'

/** Contrato dentro del filtro de archivo. */
function contrato(over: Partial<EnrichedOptionContract> = {}): EnrichedOptionContract {
  return {
    symbol: 'X', type: 'call', strike: 100, expiration: '2026-09-18', dte: 30,
    bid: 5.1, ask: 5.4, lastPrice: 5.2, mid: 5.25, spreadPct: 0.05,
    impliedVolatility: 0.28, delta: 0.48, gamma: 0.02, theta: -0.1, vega: 0.3,
    openInterest: 1200, volume: 340,
    fairValue: 5.3, premiumStatus: 'justa', probabilityITM: 0.48, inTheMoney: false,
    ...over,
  }
}

function cadena(over: Partial<OptionsChainData> = {}): OptionsChainData {
  return {
    underlyingPrice: 100,
    calls: [contrato()],
    puts: [contrato({ type: 'put', delta: -0.3 })],
    ...over,
  } as OptionsChainData
}

/** Supabase falso que registra lo que se le pide escribir. */
function supabaseFalso(errorAlEscribir?: string) {
  const escrituras: unknown[][] = []
  const opciones: unknown[] = []
  const client = {
    from(tabla: string) {
      expect(tabla).toBe('options_chain_snapshots')
      return {
        upsert(filas: unknown[], opts: unknown) {
          escrituras.push(filas)
          opciones.push(opts)
          return Promise.resolve({ error: errorAlEscribir ? { message: errorAlEscribir } : null })
        },
      }
    },
  }
  return { client: client as never, escrituras, opciones }
}

describe('archivarCadenas', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(yahoo, 'fetchYahooOptionsAnalysis')
  })
  afterEach(() => spy.mockRestore())

  it('escribe una fila por ticker con la fecha de mercado', async () => {
    spy.mockResolvedValue(cadena())
    const { client, escrituras } = supabaseFalso()

    const r = await archivarCadenas(client, '2026-09-01', ['AAPL', 'MSFT'])

    expect(r.archivados).toBe(2)
    expect(r.fallidos).toEqual([])
    const filas = escrituras.flat() as Array<{ fecha: string; ticker: string; n_contratos: number }>
    expect(filas.map(f => f.ticker).sort()).toEqual(['AAPL', 'MSFT'])
    for (const f of filas) {
      expect(f.fecha).toBe('2026-09-01')
      expect(f.n_contratos).toBeGreaterThan(0)
    }
  })

  it('sobrescribe en vez de duplicar cuando se repite el día', async () => {
    // El cron puede dispararse dos veces; acumular duplicados falsearía
    // cualquier recuento posterior del histórico.
    spy.mockResolvedValue(cadena())
    const { client, opciones } = supabaseFalso()

    await archivarCadenas(client, '2026-09-01', ['AAPL'])
    expect(opciones[0]).toEqual({ onConflict: 'fecha,ticker' })
  })

  it('un ticker que falla no arrastra a los demás', async () => {
    spy.mockImplementation(async (t: string) => {
      if (t === 'ROTO') throw new Error('Yahoo 404')
      return cadena()
    })
    const { client } = supabaseFalso()

    const r = await archivarCadenas(client, '2026-09-01', ['AAPL', 'ROTO', 'MSFT'])
    expect(r.archivados).toBe(2)
    expect(r.fallidos).toEqual([{ ticker: 'ROTO', error: 'Yahoo 404' }])
  })

  it('distingue un ticker sin contratos utilizables de uno que falla', async () => {
    // No es lo mismo «Yahoo no responde» que «hoy no había contratos dentro del
    // filtro». Mezclarlos escondería una avería detrás de un dato ausente.
    spy.mockImplementation(async (t: string) => (
      t === 'VACIO' ? cadena({ calls: [contrato({ dte: 2 })], puts: [] }) : cadena()
    ))
    const { client } = supabaseFalso()

    const r = await archivarCadenas(client, '2026-09-01', ['AAPL', 'VACIO'])
    expect(r.archivados).toBe(1)
    expect(r.vacios).toEqual(['VACIO'])
    expect(r.fallidos).toEqual([])
  })

  it('no cuenta como archivado un lote que la base de datos rechazó', async () => {
    // Contarlo haría creer que hay datos que quizá no están, y el hueco solo
    // aparecería meses después al leer el histórico.
    spy.mockResolvedValue(cadena())
    const { client } = supabaseFalso('permiso denegado')

    const r = await archivarCadenas(client, '2026-09-01', ['AAPL'])
    expect(r.archivados).toBe(0)
    expect(r.fallidos).toEqual([{ ticker: 'AAPL', error: 'permiso denegado' }])
  })

  it('no escribe nada cuando ningún ticker devuelve datos', async () => {
    spy.mockRejectedValue(new Error('red caída'))
    const { client, escrituras } = supabaseFalso()

    const r = await archivarCadenas(client, '2026-09-01', ['AAPL', 'MSFT'])
    expect(escrituras).toEqual([])
    expect(r.archivados).toBe(0)
    expect(r.fallidos).toHaveLength(2)
  })

  it('informa del tamaño para poder vigilar el crecimiento', async () => {
    spy.mockResolvedValue(cadena())
    const { client } = supabaseFalso()

    const r = await archivarCadenas(client, '2026-09-01', ['AAPL'])
    expect(r.bytes).toBeGreaterThan(0)
    expect(r.contratos).toBeGreaterThan(0)
    expect(r.log.join(' ')).toContain('archivadas')
  })
})
