import { describe, it, expect } from 'vitest'
import {
  buildDAG,
  getAncestors,
  getDescendants,
  getBackdoorPaths,
  validateAdjustmentSet,
  AAPL_DEFAULT_CONFIG,
} from './dag'

// ---------------------------------------------------------------------------
// Helper: build the AAPL DAG once for all tests
// ---------------------------------------------------------------------------
const AAPL_NODES = Array.from(
  new Set([
    AAPL_DEFAULT_CONFIG.treatment,
    AAPL_DEFAULT_CONFIG.outcome,
    ...AAPL_DEFAULT_CONFIG.confounders,
    ...(AAPL_DEFAULT_CONFIG.mediators ?? []),
    ...AAPL_DEFAULT_CONFIG.dagEdges.map((e) => e.from),
    ...AAPL_DEFAULT_CONFIG.dagEdges.map((e) => e.to),
  ])
)
const AAPL_DAG = buildDAG(AAPL_NODES, AAPL_DEFAULT_CONFIG.dagEdges)

// ---------------------------------------------------------------------------
// buildDAG()
// ---------------------------------------------------------------------------
describe('buildDAG()', () => {
  it('constructs correct children map', () => {
    const nodes = ['A', 'B', 'C']
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
    ]
    const g = buildDAG(nodes, edges)
    expect(g.children['A']).toContain('B')
    expect(g.children['A']).toContain('C')
    expect(g.children['B']).toEqual([])
    expect(g.children['C']).toEqual([])
  })

  it('constructs correct parents map', () => {
    const nodes = ['A', 'B', 'C']
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
    ]
    const g = buildDAG(nodes, edges)
    expect(g.parents['B']).toContain('A')
    expect(g.parents['C']).toContain('A')
    expect(g.parents['A']).toEqual([])
  })

  it('handles nodes that appear only in edges (not in nodes array)', () => {
    const g = buildDAG([], [{ from: 'X', to: 'Y' }])
    expect(g.nodes).toContain('X')
    expect(g.nodes).toContain('Y')
    expect(g.children['X']).toContain('Y')
  })

  it('builds AAPL DAG with all expected nodes', () => {
    expect(AAPL_DAG.nodes).toContain('CAPEX_Growth')
    expect(AAPL_DAG.nodes).toContain('Future_Return')
    expect(AAPL_DAG.nodes).toContain('YIELD_10Y')
    expect(AAPL_DAG.nodes).toContain('TRAIL_12M_EPS')
  })

  it('AAPL: YIELD_10Y has children CAPEX_Growth and Future_Return', () => {
    expect(AAPL_DAG.children['YIELD_10Y']).toContain('CAPEX_Growth')
    expect(AAPL_DAG.children['YIELD_10Y']).toContain('Future_Return')
  })
})

// ---------------------------------------------------------------------------
// getAncestors()
// ---------------------------------------------------------------------------
describe('getAncestors()', () => {
  it('returns empty set for a root node', () => {
    const g = buildDAG(['A', 'B'], [{ from: 'A', to: 'B' }])
    expect(getAncestors(g, 'A').size).toBe(0)
  })

  it('returns direct parent', () => {
    const g = buildDAG(['A', 'B'], [{ from: 'A', to: 'B' }])
    expect(getAncestors(g, 'B').has('A')).toBe(true)
  })

  it('returns transitive ancestors', () => {
    const g = buildDAG(['A', 'B', 'C'], [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }])
    const ancestors = getAncestors(g, 'C')
    expect(ancestors.has('A')).toBe(true)
    expect(ancestors.has('B')).toBe(true)
  })

  it('AAPL: ancestors of CAPEX_Growth include all 5 confounders', () => {
    const ancestors = getAncestors(AAPL_DAG, 'CAPEX_Growth')
    expect(ancestors.has('YIELD_10Y')).toBe(true)
    expect(ancestors.has('FED_RATE')).toBe(true)
    expect(ancestors.has('VIX')).toBe(true)
    expect(ancestors.has('RETURN_COM_EQY')).toBe(true)
    expect(ancestors.has('GROSS_MARGIN')).toBe(true)
  })

  it('AAPL: ancestors of CAPEX_Growth do NOT include descendants', () => {
    const ancestors = getAncestors(AAPL_DAG, 'CAPEX_Growth')
    expect(ancestors.has('TRAIL_12M_EPS')).toBe(false)
    expect(ancestors.has('Future_Return')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getDescendants()
// ---------------------------------------------------------------------------
describe('getDescendants()', () => {
  it('returns empty set for a leaf node', () => {
    const g = buildDAG(['A', 'B'], [{ from: 'A', to: 'B' }])
    expect(getDescendants(g, 'B').size).toBe(0)
  })

  it('returns direct child', () => {
    const g = buildDAG(['A', 'B'], [{ from: 'A', to: 'B' }])
    expect(getDescendants(g, 'A').has('B')).toBe(true)
  })

  it('returns transitive descendants', () => {
    const g = buildDAG(['A', 'B', 'C'], [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }])
    const desc = getDescendants(g, 'A')
    expect(desc.has('B')).toBe(true)
    expect(desc.has('C')).toBe(true)
  })

  it('AAPL: descendants of CAPEX_Growth include TRAIL_12M_EPS and Future_Return', () => {
    const desc = getDescendants(AAPL_DAG, 'CAPEX_Growth')
    expect(desc.has('TRAIL_12M_EPS')).toBe(true)
    expect(desc.has('Future_Return')).toBe(true)
  })

  it('AAPL: descendants of CAPEX_Growth do NOT include its parents', () => {
    const desc = getDescendants(AAPL_DAG, 'CAPEX_Growth')
    expect(desc.has('YIELD_10Y')).toBe(false)
    expect(desc.has('FED_RATE')).toBe(false)
    expect(desc.has('VIX')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getBackdoorPaths()
// ---------------------------------------------------------------------------
describe('getBackdoorPaths()', () => {
  it('returns empty array when treatment has no parents', () => {
    const g = buildDAG(['T', 'O'], [{ from: 'T', to: 'O' }])
    expect(getBackdoorPaths(g, 'T', 'O')).toEqual([])
  })

  it('finds a simple backdoor path through a common cause', () => {
    // Z → T, Z → O
    const g = buildDAG(['Z', 'T', 'O'], [{ from: 'Z', to: 'T' }, { from: 'Z', to: 'O' }])
    const paths = getBackdoorPaths(g, 'T', 'O')
    expect(paths.length).toBeGreaterThan(0)
    // The path should be [T, Z, O]
    const found = paths.some(
      (p) => p[0] === 'T' && p.includes('Z') && p[p.length - 1] === 'O'
    )
    expect(found).toBe(true)
  })

  it('AAPL: finds at least 5 backdoor paths (one per confounder)', () => {
    const paths = getBackdoorPaths(AAPL_DAG, 'CAPEX_Growth', 'Future_Return')
    expect(paths.length).toBeGreaterThanOrEqual(5)
  })

  it('AAPL: each backdoor path starts with CAPEX_Growth and ends with Future_Return', () => {
    const paths = getBackdoorPaths(AAPL_DAG, 'CAPEX_Growth', 'Future_Return')
    for (const path of paths) {
      expect(path[0]).toBe('CAPEX_Growth')
      expect(path[path.length - 1]).toBe('Future_Return')
    }
  })

  it('respects maxPaths limit', () => {
    const paths = getBackdoorPaths(AAPL_DAG, 'CAPEX_Growth', 'Future_Return', 3)
    expect(paths.length).toBeLessThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// validateAdjustmentSet()
// ---------------------------------------------------------------------------
describe('validateAdjustmentSet()', () => {
  it('returns valid=true with full AAPL confounders', () => {
    const result = validateAdjustmentSet(
      AAPL_DAG,
      'CAPEX_Growth',
      'Future_Return',
      AAPL_DEFAULT_CONFIG.confounders
    )
    expect(result.valid).toBe(true)
    expect(result.reason).toBeTruthy()
  })

  it('returns valid=false with empty adjustment set (confounders not blocked)', () => {
    const result = validateAdjustmentSet(AAPL_DAG, 'CAPEX_Growth', 'Future_Return', [])
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('returns valid=false when a descendant of treatment is in the adjustment set', () => {
    const result = validateAdjustmentSet(
      AAPL_DAG,
      'CAPEX_Growth',
      'Future_Return',
      [...AAPL_DEFAULT_CONFIG.confounders, 'TRAIL_12M_EPS']
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/TRAIL_12M_EPS/)
  })

  it('returns valid=false when only a subset of confounders is provided', () => {
    // Only 2 of 5 confounders — should fail because others are not blocked
    const result = validateAdjustmentSet(
      AAPL_DAG,
      'CAPEX_Growth',
      'Future_Return',
      ['YIELD_10Y', 'FED_RATE']
    )
    expect(result.valid).toBe(false)
  })

  it('simple fork: Z→T, Z→O — valid with {Z}, invalid without', () => {
    const g = buildDAG(['Z', 'T', 'O'], [{ from: 'Z', to: 'T' }, { from: 'Z', to: 'O' }])
    expect(validateAdjustmentSet(g, 'T', 'O', ['Z']).valid).toBe(true)
    expect(validateAdjustmentSet(g, 'T', 'O', []).valid).toBe(false)
  })
})
