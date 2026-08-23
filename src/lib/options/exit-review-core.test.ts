import { describe, it, expect } from 'vitest'
import { contractKey } from './occ-symbol'
import {
  contractsToQuote,
  planExitReview,
  yaVencido,
  type ReviewablePick,
} from './exit-review-core'

const AHORA = new Date('2026-03-10T15:00:00.000Z')

function pick(over: Partial<ReviewablePick> = {}): ReviewablePick {
  return {
    id: 'id-1',
    ticker: 'AAPL',
    precio_entrada: 4,
    ai_report: { strike: 200, expiration: '2026-06-19', optionType: 'CALL' },
    ...over,
  }
}

const KEY = contractKey({ ticker: 'AAPL', expiration: '2026-06-19', strike: 200, type: 'CALL' })

describe('yaVencido', () => {
  it('el contrato sigue vivo antes del cierre de su día de vencimiento', () => {
    expect(yaVencido('2026-03-10', new Date('2026-03-10T20:59:00.000Z'))).toBe(false)
  })

  it('vence al cierre del propio día, no el día siguiente', () => {
    expect(yaVencido('2026-03-10', new Date('2026-03-10T21:00:00.000Z'))).toBe(true)
  })

  it('una fecha ilegible no se da por vencida', () => {
    expect(yaVencido('no-es-fecha', AHORA)).toBe(false)
  })
})

describe('contractsToQuote', () => {
  it('pide solo los contratos vivos y legibles', () => {
    const picks = [
      pick(),
      pick({ id: 'sin-contrato', ai_report: {} }),
      pick({ id: 'vencido', ai_report: { strike: 200, expiration: '2026-01-16', optionType: 'CALL' } }),
    ]
    const refs = contractsToQuote(picks, AHORA)
    expect(refs).toHaveLength(1)
    expect(refs[0].expiration).toBe('2026-06-19')
  })
})

describe('planExitReview', () => {
  it('cierra por objetivo y deja el patch listo', () => {
    const { closures, held } = planExitReview([pick()], 'long', { [KEY]: 10 }, AHORA)
    expect(held).toHaveLength(0)
    expect(closures).toHaveLength(1)
    expect(closures[0].motivo).toBe('objetivo')
    expect(closures[0].patch).toMatchObject({
      estado: 'Vender',
      precio_venta: 10,
      rentabilidad: 150,
      closed_at: AHORA.toISOString(),
    })
    expect(closures[0].patch.ai_report).toMatchObject({ strike: 200, salida: 'objetivo' })
  })

  it('un short cierra por objetivo cuando la prima baja', () => {
    const p = pick({ ai_report: { strike: 200, expiration: '2026-06-19', strategy: 'SELL_PUT' } })
    const key = contractKey({ ticker: 'AAPL', expiration: '2026-06-19', strike: 200, type: 'PUT' })
    const { closures } = planExitReview([p], 'short', { [key]: 2 }, AHORA)
    expect(closures[0].motivo).toBe('objetivo')
    expect(closures[0].pnlPct).toBeCloseTo(50)
  })

  it('conserva el informe original al cerrar', () => {
    const p = pick({ ai_report: { strike: 200, expiration: '2026-06-19', optionType: 'CALL', conviction: 8 } })
    const { closures } = planExitReview([p], 'long', { [KEY]: 2 }, AHORA)
    expect(closures[0].patch.ai_report).toMatchObject({ conviction: 8, salida: 'stop' })
  })

  it('sin cotización se deja viva y se informa del nivel', () => {
    const { closures, held } = planExitReview([pick()], 'long', {}, AHORA)
    expect(closures).toHaveLength(0)
    expect(held[0]).toMatchObject({ razon: 'sin-cotizacion', objetivo: 10, stop: 2 })
  })

  it('nunca cierra un contrato ya vencido: eso es cosa de la liquidación', () => {
    const p = pick({ ai_report: { strike: 200, expiration: '2026-01-16', optionType: 'CALL' } })
    const key = contractKey({ ticker: 'AAPL', expiration: '2026-01-16', strike: 200, type: 'CALL' })
    const { closures, held } = planExitReview([p], 'long', { [key]: 0.01 }, AHORA)
    expect(closures).toHaveLength(0)
    expect(held[0].razon).toBe('vencido')
  })

  it('una prima de entrada inutilizable no cierra nada', () => {
    const { closures, held } = planExitReview([pick({ precio_entrada: 0 })], 'long', { [KEY]: 10 }, AHORA)
    expect(closures).toHaveLength(0)
    expect(held[0].razon).toBe('prima-invalida')
  })

  it('entre niveles informa del pnl sin cerrar', () => {
    const { closures, held } = planExitReview([pick()], 'long', { [KEY]: 5 }, AHORA)
    expect(closures).toHaveLength(0)
    expect(held[0]).toMatchObject({ razon: 'entre-niveles', primaViva: 5 })
    expect(held[0].pnlPct).toBeCloseTo(25)
  })
})
