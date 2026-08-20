import { describe, it, expect } from 'vitest'
import { buildOccSymbol, contractKey } from './occ-symbol'

// ---------------------------------------------------------------------------
// buildOccSymbol
// ---------------------------------------------------------------------------

describe('buildOccSymbol()', () => {
  it('builds a CALL symbol with an integer strike', () => {
    expect(buildOccSymbol({ ticker: 'AAPL', expiration: '2025-12-19', strike: 150, type: 'CALL' }))
      .toBe('AAPL251219C00150000')
  })

  it('builds a PUT symbol with the P marker', () => {
    expect(buildOccSymbol({ ticker: 'AAPL', expiration: '2025-12-19', strike: 150, type: 'PUT' }))
      .toBe('AAPL251219P00150000')
  })

  it('pads fractional strikes to eight digits', () => {
    expect(buildOccSymbol({ ticker: 'F', expiration: '2026-01-16', strike: 12.5, type: 'CALL' }))
      .toBe('F260116C00012500')
  })

  it('handles strikes below one dollar', () => {
    expect(buildOccSymbol({ ticker: 'SNDL', expiration: '2026-03-20', strike: 0.5, type: 'PUT' }))
      .toBe('SNDL260320P00000500')
  })

  it('handles four-digit strikes without truncating', () => {
    expect(buildOccSymbol({ ticker: 'SPX', expiration: '2026-06-18', strike: 5000, type: 'CALL' }))
      .toBe('SPX260618C05000000')
  })

  it('rounds strikes with floating point noise', () => {
    expect(buildOccSymbol({ ticker: 'MSFT', expiration: '2026-02-20', strike: 427.505, type: 'CALL' }))
      .toBe('MSFT260220C00427505')
  })

  it('uppercases and trims the ticker', () => {
    expect(buildOccSymbol({ ticker: '  aapl ', expiration: '2025-12-19', strike: 150, type: 'CALL' }))
      .toBe('AAPL251219C00150000')
  })

  it('returns null when the ticker is missing', () => {
    expect(buildOccSymbol({ ticker: '', expiration: '2025-12-19', strike: 150, type: 'CALL' })).toBeNull()
  })

  it('returns null when the expiration is not ISO YYYY-MM-DD', () => {
    expect(buildOccSymbol({ ticker: 'AAPL', expiration: '19/12/2025', strike: 150, type: 'CALL' })).toBeNull()
  })

  it('returns null for a non-positive strike', () => {
    expect(buildOccSymbol({ ticker: 'AAPL', expiration: '2025-12-19', strike: 0, type: 'CALL' })).toBeNull()
  })

  it('returns null for a non-finite strike', () => {
    expect(buildOccSymbol({ ticker: 'AAPL', expiration: '2025-12-19', strike: NaN, type: 'CALL' })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// contractKey
// ---------------------------------------------------------------------------

describe('contractKey()', () => {
  it('builds a stable key from the contract fields', () => {
    expect(contractKey({ ticker: 'AAPL', expiration: '2025-12-19', strike: 150, type: 'CALL' }))
      .toBe('AAPL|2025-12-19|CALL|150')
  })

  it('normalizes ticker casing so lookups match', () => {
    const upper = contractKey({ ticker: 'AAPL', expiration: '2025-12-19', strike: 150, type: 'PUT' })
    const lower = contractKey({ ticker: 'aapl', expiration: '2025-12-19', strike: 150, type: 'PUT' })
    expect(lower).toBe(upper)
  })

  it('distinguishes calls from puts at the same strike', () => {
    const call = contractKey({ ticker: 'AAPL', expiration: '2025-12-19', strike: 150, type: 'CALL' })
    const put = contractKey({ ticker: 'AAPL', expiration: '2025-12-19', strike: 150, type: 'PUT' })
    expect(call).not.toBe(put)
  })
})
