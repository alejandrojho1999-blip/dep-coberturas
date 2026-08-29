import { describe, it, expect } from 'vitest'
import {
  CAMPOS_CONTRATO, FILTRO_ARCHIVO, contratoArchivable, aContratoArchivado,
  desdeContratoArchivado, prepararSnapshot, bytesAproximados,
} from './chain-archive'
import { UNIVERSO_ARCHIVO } from './chain-archive-run'
import type { EnrichedOptionContract } from './yahoo-options'

/** Contrato de ejemplo, dentro del filtro salvo que se diga otra cosa. */
function contrato(over: Partial<EnrichedOptionContract> = {}): EnrichedOptionContract {
  return {
    symbol: 'AAPL260918C00320000', type: 'call', strike: 320,
    expiration: '2026-09-18', dte: 30,
    bid: 5.1, ask: 5.4, lastPrice: 5.2, mid: 5.25, spreadPct: 0.057,
    impliedVolatility: 0.2841, delta: 0.4812, gamma: 0.02, theta: -0.1, vega: 0.3,
    openInterest: 1200, volume: 340,
    fairValue: 5.3, premiumStatus: 'justa', probabilityITM: 0.48, inTheMoney: false,
    ...over,
  }
}

describe('formato de almacenamiento', () => {
  it('congela el orden de los campos', () => {
    // Las filas archivadas son tuplas posicionales sin nombres. Reordenar o
    // insertar un campo reinterpretaría en silencio todo lo grabado hasta la
    // fecha, y eso no se detecta hasta que alguien lee el histórico meses
    // después. Un campo nuevo va al final; este test lo obliga.
    expect(CAMPOS_CONTRATO).toEqual([
      'tipo', 'strike', 'vencimiento', 'bid', 'ask', 'iv', 'delta', 'openInterest', 'volume',
    ])
  })

  it('la tupla tiene tantas posiciones como campos declarados', () => {
    expect(aContratoArchivado(contrato())).toHaveLength(CAMPOS_CONTRATO.length)
  })

  it('ida y vuelta conserva el contrato', () => {
    const t = aContratoArchivado(contrato())
    const v = desdeContratoArchivado(t)
    expect(v.tipo).toBe('call')
    expect(v.strike).toBe(320)
    expect(v.vencimiento).toBe('2026-09-18')
    expect(v.bid).toBe(5.1)
    expect(v.iv).toBeCloseTo(0.2841, 6)
    expect(v.delta).toBeCloseTo(0.4812, 6)
    expect(v.openInterest).toBe(1200)
  })

  it('distingue calls de puts en un solo carácter', () => {
    expect(aContratoArchivado(contrato({ type: 'call' }))[0]).toBe('C')
    expect(aContratoArchivado(contrato({ type: 'put', delta: -0.3 }))[0]).toBe('P')
    expect(desdeContratoArchivado(aContratoArchivado(contrato({ type: 'put', delta: -0.3 }))).tipo).toBe('put')
  })

  it('guarda los huecos como null y no como cero', () => {
    // Un cero es un precio; un hueco es la ausencia de precio. Confundirlos
    // haría que un contrato sin cotizar pareciera valer nada.
    const t = aContratoArchivado(contrato({ bid: null, openInterest: null }))
    expect(t[3]).toBeNull()
    expect(t[7]).toBeNull()
  })
})

describe('filtro de archivo', () => {
  it('acepta lo que está dentro de la ventana', () => {
    expect(contratoArchivable(contrato())).toBe(true)
  })

  it('descarta por plazo fuera de rango', () => {
    expect(contratoArchivable(contrato({ dte: 3 }))).toBe(false)
    expect(contratoArchivable(contrato({ dte: 200 }))).toBe(false)
  })

  it('descarta lo muy dentro y muy fuera del dinero', () => {
    expect(contratoArchivable(contrato({ delta: 0.97 }))).toBe(false)
    expect(contratoArchivable(contrato({ delta: 0.01 }))).toBe(false)
  })

  it('mide el delta en valor absoluto, para que los puts entren igual', () => {
    expect(contratoArchivable(contrato({ type: 'put', delta: -0.30 }))).toBe(true)
    expect(contratoArchivable(contrato({ type: 'put', delta: -0.95 }))).toBe(false)
  })

  it('descarta contratos sin delta', () => {
    // Sin delta no se puede situar el contrato en la superficie, que es justo lo
    // que un estudio de volatilidad necesita.
    expect(contratoArchivable(contrato({ delta: null }))).toBe(false)
  })

  it('descarta contratos sin ninguna cotización', () => {
    expect(contratoArchivable(contrato({ bid: null, ask: null, lastPrice: null }))).toBe(false)
    expect(contratoArchivable(contrato({ bid: null, ask: 5.4, lastPrice: null }))).toBe(true)
  })

  it('es más ancho que lo que usan los agentes hoy', () => {
    // Gamma pide DTE 21-90 y |Δ| 0,30-0,65; Theta, DTE 21-45 y |Δ| 0,15-0,35.
    // El archivo debe cubrirlos con holgura para que un estudio futuro pueda
    // mover los umbrales sin descubrir que el dato no se guardó.
    expect(FILTRO_ARCHIVO.dteMin).toBeLessThan(21)
    expect(FILTRO_ARCHIVO.dteMax).toBeGreaterThan(90)
    expect(FILTRO_ARCHIVO.deltaMin).toBeLessThan(0.15)
    expect(FILTRO_ARCHIVO.deltaMax).toBeGreaterThan(0.65)
  })
})

describe('preparación del snapshot', () => {
  const base = { fecha: '2026-08-31', ticker: 'AAPL', spot: 319.7 }

  it('archiva solo los contratos que pasan el filtro', () => {
    const s = prepararSnapshot({
      ...base,
      contratos: [contrato(), contrato({ dte: 2 }), contrato({ delta: 0.99 })],
    })!
    expect(s.n_contratos).toBe(1)
    expect(s.contratos).toHaveLength(1)
  })

  it('deja constancia del filtro aplicado', () => {
    // Dentro de un año hay que poder saber qué hay y qué no sin leer el código
    // de hoy.
    const s = prepararSnapshot({ ...base, contratos: [contrato()] })!
    expect(s.filtro).toEqual(FILTRO_ARCHIVO)
  })

  it('devuelve null en vez de archivar una fila vacía', () => {
    // Una fila vacía haría creer que ese día se capturó algo. Al reconstruir el
    // histórico, un hueco silencioso es peor que una ausencia declarada.
    expect(prepararSnapshot({ ...base, contratos: [] })).toBeNull()
    expect(prepararSnapshot({ ...base, contratos: [contrato({ dte: 2 })] })).toBeNull()
  })

  it('rechaza un subyacente sin precio', () => {
    // Sin spot los contratos no se pueden situar en moneyness ni recalcular.
    expect(prepararSnapshot({ ...base, spot: 0, contratos: [contrato()] })).toBeNull()
    expect(prepararSnapshot({ ...base, spot: NaN, contratos: [contrato()] })).toBeNull()
  })

  it('el formato compacto pesa mucho menos que los objetos', () => {
    // Es la razón de guardar tuplas: sin esto el archivo no cabe en el plan.
    const contratos = Array.from({ length: 500 }, (_, i) => contrato({ strike: 300 + i }))
    const s = prepararSnapshot({ ...base, contratos })!
    const comoObjetos = Buffer.byteLength(JSON.stringify(contratos))
    expect(bytesAproximados(s)).toBeLessThan(comoObjetos * 0.2)
  })
})

describe('universo archivado', () => {
  it('cubre el universo que miran los agentes de opciones', async () => {
    // La lista se declara dos veces —aquí y en la config del backtest— porque
    // aquel es código de análisis que no debe entrar en el bundle del servidor.
    // Si divergen, el archivo dejaría de cubrir a un agente en silencio.
    const { UNIVERSO_THETA, UNIVERSO_GAMMA } = await import('@/lib/backtest/opciones/config')
    const archivado = new Set<string>(UNIVERSO_ARCHIVO)
    for (const t of [...UNIVERSO_THETA, ...UNIVERSO_GAMMA]) {
      expect(archivado.has(t), `${t} no se archiva`).toBe(true)
    }
  })

  it('no repite tickers', () => {
    expect(new Set(UNIVERSO_ARCHIVO).size).toBe(UNIVERSO_ARCHIVO.length)
  })
})
