import { describe, it, expect } from 'vitest'
import { backdoorCriterion } from './adjustment'
import { AAPL_DEFAULT_CONFIG } from './dag'
import type { CausalConfig } from './types'

describe('backdoorCriterion()', () => {
  it('AAPL: adjustmentSet equals the 5 confounders', () => {
    const { adjustmentSet } = backdoorCriterion(AAPL_DEFAULT_CONFIG)
    expect(adjustmentSet).toHaveLength(5)
    for (const confounder of AAPL_DEFAULT_CONFIG.confounders) {
      expect(adjustmentSet).toContain(confounder)
    }
  })

  it('AAPL: validation result is valid=true', () => {
    const { validation } = backdoorCriterion(AAPL_DEFAULT_CONFIG)
    expect(validation.valid).toBe(true)
    expect(validation.reason).toBeTruthy()
  })

  it('AAPL: mediator TRAIL_12M_EPS is NOT in adjustmentSet', () => {
    const { adjustmentSet } = backdoorCriterion(AAPL_DEFAULT_CONFIG)
    expect(adjustmentSet).not.toContain('TRAIL_12M_EPS')
  })

  it('AAPL: backdoorPaths is non-empty array', () => {
    const { backdoorPaths } = backdoorCriterion(AAPL_DEFAULT_CONFIG)
    expect(Array.isArray(backdoorPaths)).toBe(true)
    expect(backdoorPaths.length).toBeGreaterThan(0)
  })

  it('AAPL: backdoorPaths each start with treatment and end with outcome', () => {
    const { backdoorPaths } = backdoorCriterion(AAPL_DEFAULT_CONFIG)
    for (const path of backdoorPaths) {
      expect(path[0]).toBe(AAPL_DEFAULT_CONFIG.treatment)
      expect(path[path.length - 1]).toBe(AAPL_DEFAULT_CONFIG.outcome)
    }
  })

  it('excludes descendants of treatment from adjustmentSet', () => {
    // Config where NET_INCOME is a descendant and also listed as a confounder
    const config: CausalConfig = {
      ...AAPL_DEFAULT_CONFIG,
      confounders: [...AAPL_DEFAULT_CONFIG.confounders, 'NET_INCOME'],
      dagEdges: [
        ...AAPL_DEFAULT_CONFIG.dagEdges,
        { from: 'CAPEX_Growth', to: 'NET_INCOME', label: 'Capex→ingresos netos' },
      ],
    }
    const { adjustmentSet } = backdoorCriterion(config)
    expect(adjustmentSet).not.toContain('NET_INCOME')
  })

  it('returns valid=false if all confounders are removed', () => {
    const config: CausalConfig = {
      ...AAPL_DEFAULT_CONFIG,
      confounders: [],
    }
    const { adjustmentSet, validation } = backdoorCriterion(config)
    expect(adjustmentSet).toHaveLength(0)
    expect(validation.valid).toBe(false)
  })

  it('simple fork config: single confounder is sufficient', () => {
    const config: CausalConfig = {
      ticker: 'TEST',
      name: 'Test',
      treatment: 'T',
      outcome: 'O',
      horizon: 1,
      confounders: ['Z'],
      excluded: {},
      dagEdges: [
        { from: 'Z', to: 'T' },
        { from: 'Z', to: 'O' },
        { from: 'T', to: 'O' },
      ],
    }
    const { adjustmentSet, validation } = backdoorCriterion(config)
    expect(adjustmentSet).toContain('Z')
    expect(validation.valid).toBe(true)
  })
})
