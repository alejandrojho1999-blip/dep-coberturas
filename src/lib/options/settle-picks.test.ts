import { describe, it, expect } from 'vitest'
import {
  pickPositionsToSettle,
  settlementQueries,
  settlementKey,
  computeSettlements,
  describeSettlement,
  type AgentPickForSettlement,
} from './settle-picks'

const NOW = new Date('2026-08-20T12:00:00.000Z')

function pick(over: Partial<AgentPickForSettlement> = {}): AgentPickForSettlement {
  return {
    id: 'id-1',
    ticker: 'FSLR',
    estado: 'Comprar',
    precio_entrada: 15.75,
    ai_report: { optionType: 'CALL', strike: 230, expiration: '2026-06-18' },
    ...over,
  }
}

describe('pickPositionsToSettle()', () => {
  it('incluye posiciones abiertas cuyo contrato ya venció', () => {
    const { pending } = pickPositionsToSettle([pick()], NOW)
    expect(pending).toHaveLength(1)
  })

  it('ignora posiciones abiertas todavía vigentes', () => {
    const vigente = pick({ ai_report: { optionType: 'CALL', strike: 230, expiration: '2026-12-18' } })
    const { pending } = pickPositionsToSettle([vigente], NOW)
    expect(pending).toHaveLength(0)
  })

  it('re-liquida las cerradas con el −100% cableado de Gamma', () => {
    const { pending } = pickPositionsToSettle(
      [pick({ estado: 'Vender', rentabilidad: -100 })], NOW
    )
    expect(pending).toHaveLength(1)
  })

  it('re-liquida las cerradas con el +100% cableado de Theta', () => {
    const { pending } = pickPositionsToSettle(
      [pick({ estado: 'Vender', rentabilidad: 100 })], NOW
    )
    expect(pending).toHaveLength(1)
  })

  it('respeta las cerradas que ya anotaron su precio de liquidación', () => {
    const { pending } = pickPositionsToSettle(
      [pick({
        estado: 'Vender',
        rentabilidad: -42.5,
        ai_report: { optionType: 'CALL', strike: 230, expiration: '2026-06-18', underlyingAtExpiry: 257.70 },
      })], NOW
    )
    expect(pending).toHaveLength(0)
  })

  it('re-liquida las cerradas sin precio de liquidación anotado', () => {
    // Se cerraron con una versión que podía usar el cierre del día anterior
    // al vencimiento, así que hay que rehacerlas.
    const { pending } = pickPositionsToSettle(
      [pick({ estado: 'Vender', rentabilidad: 57.46 })], NOW
    )
    expect(pending).toHaveLength(1)
  })

  it('reporta las que no traen fecha de vencimiento', () => {
    const { pending, skipped } = pickPositionsToSettle(
      [pick({ ai_report: { optionType: 'CALL', strike: 230 } })], NOW
    )
    expect(pending).toHaveLength(0)
    expect(skipped[0].reason).toContain('vencimiento')
  })
})

describe('settlementQueries()', () => {
  it('deduplica ticker + vencimiento', () => {
    const qs = settlementQueries([pick(), pick({ id: 'id-2' })])
    expect(qs).toEqual([{ ticker: 'FSLR', expiration: '2026-06-18' }])
  })

  it('separa vencimientos distintos del mismo ticker', () => {
    const otro = pick({ id: 'id-2', ai_report: { optionType: 'CALL', strike: 240, expiration: '2026-07-17' } })
    expect(settlementQueries([pick(), otro])).toHaveLength(2)
  })
})

describe('computeSettlements()', () => {
  it('liquida el caso FSLR con pérdida real de la prima', () => {
    const prices = { [settlementKey('FSLR', '2026-06-18')]: 216.43 }
    const { outcomes } = computeSettlements([pick()], prices)

    expect(outcomes).toHaveLength(1)
    const o = outcomes[0]
    expect(o.precioVenta).toBe(0)
    expect(o.pnlTotal).toBeCloseTo(-1575, 2)
    expect(o.rentabilidad).toBeCloseTo(-100, 2)
    expect(o.expiredInTheMoney).toBe(false)
  })

  it('liquida un CALL que venció ITM con ganancia', () => {
    const prices = { [settlementKey('FSLR', '2026-06-18')]: 260 }
    const { outcomes } = computeSettlements([pick()], prices)
    expect(outcomes[0].precioVenta).toBeCloseTo(30, 4)
    expect(outcomes[0].pnlTotal).toBeCloseTo(1425, 2)
  })

  it('liquida un SELL_PUT asignado como pérdida del vendedor', () => {
    const theta = pick({
      ticker: 'AAPL',
      precio_entrada: 2.5,
      ai_report: { strategy: 'SELL_PUT', strike: 50, expiration: '2026-06-18' },
    })
    const prices = { [settlementKey('AAPL', '2026-06-18')]: 40 }
    const { outcomes } = computeSettlements([theta], prices)
    expect(outcomes[0].pnlTotal).toBeCloseTo(-750, 2)
    expect(outcomes[0].isShort).toBe(true)
  })

  it('marca como recalculada una posición que traía el valor cableado', () => {
    const prices = { [settlementKey('FSLR', '2026-06-18')]: 216.43 }
    const { outcomes } = computeSettlements(
      [pick({ estado: 'Vender', rentabilidad: -100 })], prices
    )
    expect(outcomes[0].wasMisreported).toBe(true)
  })

  it('no inventa un resultado si falta el cierre histórico', () => {
    const { outcomes, skipped } = computeSettlements([pick()], {})
    expect(outcomes).toHaveLength(0)
    expect(skipped[0].reason).toContain('sin cierre histórico')
  })

  it('omite informes sin strike o sin tipo de posición', () => {
    const roto = pick({ ai_report: { expiration: '2026-06-18' } })
    const { outcomes, skipped } = computeSettlements([roto], {
      [settlementKey('FSLR', '2026-06-18')]: 216.43,
    })
    expect(outcomes).toHaveLength(0)
    expect(skipped[0].reason).toContain('incompleto')
  })
})

describe('describeSettlement()', () => {
  it('describe una pérdida con el importe por contrato', () => {
    const prices = { [settlementKey('FSLR', '2026-06-18')]: 216.43 }
    const { outcomes } = computeSettlements([pick()], prices)
    const line = describeSettlement(outcomes[0])
    expect(line).toContain('FSLR')
    expect(line).toContain('sin valor')
    expect(line).toContain('1575.00')
  })

  it('marca las líneas de posiciones recalculadas', () => {
    const prices = { [settlementKey('FSLR', '2026-06-18')]: 216.43 }
    const { outcomes } = computeSettlements(
      [pick({ estado: 'Vender', rentabilidad: -100 })], prices
    )
    expect(describeSettlement(outcomes[0])).toContain('RECALCULADO')
  })
})
