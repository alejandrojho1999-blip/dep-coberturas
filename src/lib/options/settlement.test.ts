import { describe, it, expect } from 'vitest'
import { settleOption, positionFromReport, CONTRACT_MULTIPLIER } from './settlement'

describe('settleOption() — CALL comprado (Gamma alcista)', () => {
  it('vence OTM y pierde la prima íntegra', () => {
    // Caso real reportado: FSLR CALL $230, prima $15.75, subyacente 216.43.
    const r = settleOption({
      position: 'LONG_CALL', strike: 230, premium: 15.75, underlyingAtExpiry: 216.43,
    })!
    expect(r.intrinsicValue).toBe(0)
    expect(r.expiredInTheMoney).toBe(false)
    expect(r.pnlPerShare).toBeCloseTo(-15.75, 4)
    expect(r.pnlTotal).toBeCloseTo(-1575, 4)
    expect(r.pnlPct).toBeCloseTo(-100, 4)
  })

  it('vence ITM por encima del breakeven y gana', () => {
    // Breakeven = 230 + 15.75 = 245.75; a 260 gana 14.25/acción.
    const r = settleOption({
      position: 'LONG_CALL', strike: 230, premium: 15.75, underlyingAtExpiry: 260,
    })!
    expect(r.intrinsicValue).toBeCloseTo(30, 4)
    expect(r.pnlPerShare).toBeCloseTo(14.25, 4)
    expect(r.pnlTotal).toBeCloseTo(1425, 4)
    expect(r.expiredInTheMoney).toBe(true)
  })

  it('vence ITM pero por debajo del breakeven: recupera parte de la prima', () => {
    const r = settleOption({
      position: 'LONG_CALL', strike: 230, premium: 15.75, underlyingAtExpiry: 238,
    })!
    expect(r.intrinsicValue).toBeCloseTo(8, 4)
    expect(r.pnlPerShare).toBeCloseTo(-7.75, 4)
    expect(r.expiredInTheMoney).toBe(true)
  })

  it('vence exactamente en el strike: sin valor intrínseco', () => {
    const r = settleOption({
      position: 'LONG_CALL', strike: 230, premium: 15.75, underlyingAtExpiry: 230,
    })!
    expect(r.intrinsicValue).toBe(0)
    expect(r.pnlTotal).toBeCloseTo(-1575, 4)
  })
})

describe('settleOption() — PUT comprado (Gamma bajista)', () => {
  it('vence ITM cuando el subyacente cae bajo el strike', () => {
    const r = settleOption({
      position: 'LONG_PUT', strike: 100, premium: 4, underlyingAtExpiry: 88,
    })!
    expect(r.intrinsicValue).toBeCloseTo(12, 4)
    expect(r.pnlPerShare).toBeCloseTo(8, 4)
    expect(r.pnlTotal).toBeCloseTo(800, 4)
  })

  it('vence OTM cuando el subyacente sube', () => {
    const r = settleOption({
      position: 'LONG_PUT', strike: 100, premium: 4, underlyingAtExpiry: 110,
    })!
    expect(r.intrinsicValue).toBe(0)
    expect(r.pnlTotal).toBeCloseTo(-400, 4)
    expect(r.pnlPct).toBeCloseTo(-100, 4)
  })
})

describe('settleOption() — PUT vendido (Theta cobra prima)', () => {
  it('vence sin valor y el vendedor se queda la prima íntegra', () => {
    const r = settleOption({
      position: 'SHORT_PUT', strike: 50, premium: 2.5, underlyingAtExpiry: 55,
    })!
    expect(r.intrinsicValue).toBe(0)
    expect(r.pnlPerShare).toBeCloseTo(2.5, 4)
    expect(r.pnlTotal).toBeCloseTo(250, 4)
    expect(r.pnlPct).toBeCloseTo(100, 4)
    expect(r.isShort).toBe(true)
  })

  it('vence ITM y el vendedor PIERDE — el caso que la lógica cableada ignoraba', () => {
    // Asignado a 50 con el subyacente en 40: debe 10/acción, cobró 2.5.
    const r = settleOption({
      position: 'SHORT_PUT', strike: 50, premium: 2.5, underlyingAtExpiry: 40,
    })!
    expect(r.intrinsicValue).toBeCloseTo(10, 4)
    expect(r.pnlPerShare).toBeCloseTo(-7.5, 4)
    expect(r.pnlTotal).toBeCloseTo(-750, 4)
    expect(r.expiredInTheMoney).toBe(true)
  })

  it('vence ligeramente ITM pero dentro de la prima: sigue en ganancia', () => {
    const r = settleOption({
      position: 'SHORT_PUT', strike: 50, premium: 2.5, underlyingAtExpiry: 49,
    })!
    expect(r.pnlPerShare).toBeCloseTo(1.5, 4)
    expect(r.pnlTotal).toBeCloseTo(150, 4)
  })
})

describe('settleOption() — CALL cubierto (Theta)', () => {
  it('vence sin ser asignado y conserva la prima', () => {
    const r = settleOption({
      position: 'COVERED_CALL', strike: 120, premium: 3, underlyingAtExpiry: 115,
    })!
    expect(r.pnlTotal).toBeCloseTo(300, 4)
  })

  it('es asignado por encima del strike: la pata de la opción pierde', () => {
    const r = settleOption({
      position: 'COVERED_CALL', strike: 120, premium: 3, underlyingAtExpiry: 130,
    })!
    expect(r.intrinsicValue).toBeCloseTo(10, 4)
    expect(r.pnlPerShare).toBeCloseTo(-7, 4)
    expect(r.pnlTotal).toBeCloseTo(-700, 4)
  })
})

describe('settleOption() — contratos y validación', () => {
  it('multiplica por el número de contratos', () => {
    const r = settleOption({
      position: 'LONG_CALL', strike: 100, premium: 5, underlyingAtExpiry: 120, contracts: 3,
    })!
    expect(r.pnlPerShare).toBeCloseTo(15, 4)
    expect(r.pnlTotal).toBeCloseTo(15 * CONTRACT_MULTIPLIER * 3, 4)
  })

  it('un contrato equivale a 100 acciones', () => {
    expect(CONTRACT_MULTIPLIER).toBe(100)
  })

  it('devuelve null con datos no finitos', () => {
    expect(settleOption({
      position: 'LONG_CALL', strike: NaN, premium: 5, underlyingAtExpiry: 120,
    })).toBeNull()
  })

  it('devuelve null con strike no positivo', () => {
    expect(settleOption({
      position: 'LONG_CALL', strike: 0, premium: 5, underlyingAtExpiry: 120,
    })).toBeNull()
  })

  it('devuelve pnlPct null si la prima fue cero', () => {
    const r = settleOption({
      position: 'LONG_CALL', strike: 100, premium: 0, underlyingAtExpiry: 110,
    })!
    expect(r.pnlPct).toBeNull()
    expect(r.pnlTotal).toBeCloseTo(1000, 4)
  })
})

describe('positionFromReport()', () => {
  it('reconoce las estrategias de Theta', () => {
    expect(positionFromReport({ strategy: 'SELL_PUT' })).toBe('SHORT_PUT')
    expect(positionFromReport({ strategy: 'COVERED_CALL' })).toBe('COVERED_CALL')
  })

  it('reconoce los tipos de opción de Gamma', () => {
    expect(positionFromReport({ optionType: 'CALL' })).toBe('LONG_CALL')
    expect(positionFromReport({ optionType: 'PUT' })).toBe('LONG_PUT')
  })

  it('da prioridad a la estrategia sobre el tipo de opción', () => {
    expect(positionFromReport({ strategy: 'SELL_PUT', optionType: 'PUT' })).toBe('SHORT_PUT')
  })

  it('devuelve null si el informe no identifica la posición', () => {
    expect(positionFromReport({})).toBeNull()
    expect(positionFromReport({ optionType: 'STRADDLE' })).toBeNull()
  })
})
