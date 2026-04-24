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
    expect(AAPL_DAG.nodes).toContain('FED_RATE')
    expect(AAPL_DAG.nodes).toContain('FutureReturn')
    expect(AAPL_DAG.nodes).toContain('YIELD_10Y')
    expect(AAPL_DAG.nodes).toContain('VIX')
  })

  it('AAPL: YIELD_10Y has children FED_RATE and FutureReturn', () => {
    expect(AAPL_DAG.children['YIELD_10Y']).toContain('FED_RATE')
    expect(AAPL_DAG.children['YIELD_10Y']).toContain('FutureReturn')
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

  it('AAPL: ancestors of FED_RATE include both confounders', () => {
    const ancestors = getAncestors(AAPL_DAG, 'FED_RATE')
    expect(ancestors.has('YIELD_10Y')).toBe(true)
    expect(ancestors.has('VIX')).toBe(true)
  })

  it('AAPL: ancestors of FED_RATE do NOT include its descendants', () => {
    const ancestors = getAncestors(AAPL_DAG, 'FED_RATE')
    expect(ancestors.has('FutureReturn')).toBe(false)
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

  it('AAPL: descendants of FED_RATE include FutureReturn', () => {
    const desc = getDescendants(AAPL_DAG, 'FED_RATE')
    expect(desc.has('FutureReturn')).toBe(true)
  })

  it('AAPL: descendants of FED_RATE do NOT include its parents', () => {
    const desc = getDescendants(AAPL_DAG, 'FED_RATE')
    expect(desc.has('YIELD_10Y')).toBe(false)
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

  it('AAPL: finds at least 2 backdoor paths (one per confounder)', () => {
    const paths = getBackdoorPaths(AAPL_DAG, 'FED_RATE', 'FutureReturn')
    expect(paths.length).toBeGreaterThanOrEqual(2)
  })

  it('AAPL: each backdoor path starts with FED_RATE and ends with FutureReturn', () => {
    const paths = getBackdoorPaths(AAPL_DAG, 'FED_RATE', 'FutureReturn')
    for (const path of paths) {
      expect(path[0]).toBe('FED_RATE')
      expect(path[path.length - 1]).toBe('FutureReturn')
    }
  })

  it('respects maxPaths limit', () => {
    const paths = getBackdoorPaths(AAPL_DAG, 'FED_RATE', 'FutureReturn', 1)
    expect(paths.length).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// validateAdjustmentSet()
// ---------------------------------------------------------------------------
describe('validateAdjustmentSet()', () => {
  it('returns valid=true with full AAPL confounders', () => {
    const result = validateAdjustmentSet(
      AAPL_DAG,
      AAPL_DEFAULT_CONFIG.treatment,
      AAPL_DEFAULT_CONFIG.outcome,
      AAPL_DEFAULT_CONFIG.confounders,
    )
    expect(result.valid).toBe(true)
    expect(result.reason).toBeTruthy()
  })

  it('returns valid=false with empty adjustment set (confounders not blocked)', () => {
    const result = validateAdjustmentSet(AAPL_DAG, 'FED_RATE', 'FutureReturn', [])
    expect(result.valid).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('returns valid=false when a descendant of FED_RATE is in the adjustment set', () => {
    const result = validateAdjustmentSet(
      AAPL_DAG,
      'FED_RATE',
      'FutureReturn',
      [...AAPL_DEFAULT_CONFIG.confounders, 'FutureReturn'],
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/FutureReturn/)
  })

  it('returns valid=false when only a subset of confounders is provided', () => {
    // Only YIELD_10Y — VIX is a common ancestor and not blocked
    const result = validateAdjustmentSet(AAPL_DAG, 'FED_RATE', 'FutureReturn', ['YIELD_10Y'])
    expect(result.valid).toBe(false)
  })

  it('simple fork: Z→T, Z→O — valid with {Z}, invalid without', () => {
    const g = buildDAG(['Z', 'T', 'O'], [{ from: 'Z', to: 'T' }, { from: 'Z', to: 'O' }])
    expect(validateAdjustmentSet(g, 'T', 'O', ['Z']).valid).toBe(true)
    expect(validateAdjustmentSet(g, 'T', 'O', []).valid).toBe(false)
  })
})
