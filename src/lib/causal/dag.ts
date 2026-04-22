import type { DAGEdge, CausalConfig } from './types'

/** Directed graph represented as adjacency lists */
export interface DirectedGraph {
  nodes: string[]
  children: Record<string, string[]>   // children[X] = nodes Y such that X→Y
  parents: Record<string, string[]>    // parents[Y] = nodes X such that X→Y
}

/**
 * Build a directed graph from an edge list.
 * Centralizes graph construction so all subsequent algorithms
 * (ancestors, descendants, backdoor paths) work from a single structure.
 */
export function buildDAG(nodes: string[], edges: DAGEdge[]): DirectedGraph {
  const children: Record<string, string[]> = {}
  const parents: Record<string, string[]> = {}

  for (const node of nodes) {
    children[node] = []
    parents[node] = []
  }

  for (const edge of edges) {
    // Auto-add nodes that appear in edges but not in the nodes array
    if (!children[edge.from]) children[edge.from] = []
    if (!parents[edge.from]) parents[edge.from] = []
    if (!children[edge.to]) children[edge.to] = []
    if (!parents[edge.to]) parents[edge.to] = []

    children[edge.from].push(edge.to)
    parents[edge.to].push(edge.from)
  }

  // Collect all nodes (union of declared + those found in edges)
  const allNodes = Array.from(
    new Set([...nodes, ...edges.map((e) => e.from), ...edges.map((e) => e.to)])
  )

  return { nodes: allNodes, children, parents }
}

/**
 * Get all ancestors of a node (parents, grandparents, etc.) via BFS.
 * Ancestors are potential confounders — they may need to be in the adjustment set.
 */
export function getAncestors(graph: DirectedGraph, node: string): Set<string> {
  const ancestors = new Set<string>()
  const queue: string[] = [...(graph.parents[node] ?? [])]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (ancestors.has(current)) continue
    ancestors.add(current)
    const grandparents = graph.parents[current] ?? []
    for (const gp of grandparents) {
      if (!ancestors.has(gp)) queue.push(gp)
    }
  }

  return ancestors
}

/**
 * Get all descendants of a node via BFS.
 * Descendants should NEVER be in the adjustment set (would block causal paths
 * or introduce collider bias downstream).
 */
export function getDescendants(graph: DirectedGraph, node: string): Set<string> {
  const descendants = new Set<string>()
  const queue: string[] = [...(graph.children[node] ?? [])]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (descendants.has(current)) continue
    descendants.add(current)
    const grandchildren = graph.children[current] ?? []
    for (const gc of grandchildren) {
      if (!descendants.has(gc)) queue.push(gc)
    }
  }

  return descendants
}

/**
 * Find all backdoor paths from treatment to outcome.
 * A backdoor path is any path from treatment to outcome that starts
 * with an arrow INTO treatment (i.e., traverses a parent edge first).
 *
 * Returns array of paths, each path is an array of variable names.
 * Limits to maxPaths=20 to avoid combinatorial explosion.
 */
export function getBackdoorPaths(
  graph: DirectedGraph,
  treatment: string,
  outcome: string,
  maxPaths = 20
): string[][] {
  const results: string[][] = []

  // Each stack entry: [currentNode, pathSoFar, lastMoveWasForward]
  // We start by going backward from treatment (following parent edges)
  type StackEntry = { node: string; path: string[]; visitedInPath: Set<string> }

  // Backdoor paths start by going INTO treatment (parent edges), then can go any direction
  // We enumerate: start from each parent of treatment, then do undirected path search to outcome
  const treatmentParents = graph.parents[treatment] ?? []

  for (const parent of treatmentParents) {
    if (results.length >= maxPaths) break

    // BFS/DFS from this parent to outcome, without going back through treatment
    const stack: StackEntry[] = [
      { node: parent, path: [treatment, parent], visitedInPath: new Set([treatment, parent]) },
    ]

    while (stack.length > 0 && results.length < maxPaths) {
      const { node, path, visitedInPath } = stack.pop()!

      if (node === outcome) {
        results.push(path)
        continue
      }

      // Explore neighbors (both directions in the undirected skeleton),
      // but do not re-visit nodes already in the current path
      const neighbors: string[] = [
        ...(graph.children[node] ?? []),
        ...(graph.parents[node] ?? []),
      ]

      for (const neighbor of neighbors) {
        if (visitedInPath.has(neighbor)) continue
        const newVisited = new Set(visitedInPath)
        newVisited.add(neighbor)
        stack.push({ node: neighbor, path: [...path, neighbor], visitedInPath: newVisited })
      }
    }
  }

  return results
}

/**
 * Validate that an adjustment set satisfies the backdoor criterion.
 *
 * Practical check:
 * 1. Reject if any element of adjustmentSet is a descendant of treatment
 * 2. Accept if all common ancestors of treatment and outcome are in adjustmentSet
 *    (sufficient condition for the standard case with no unobserved confounders)
 *
 * Returns { valid: boolean, reason: string }
 */
export function validateAdjustmentSet(
  graph: DirectedGraph,
  treatment: string,
  outcome: string,
  adjustmentSet: string[]
): { valid: boolean; reason: string } {
  const treatmentDescendants = getDescendants(graph, treatment)

  // Check 1: no descendant of treatment in adjustment set
  const descendantInSet = adjustmentSet.filter((v) => treatmentDescendants.has(v))
  if (descendantInSet.length > 0) {
    return {
      valid: false,
      reason: `El conjunto de ajuste contiene descendientes del tratamiento: ${descendantInSet.join(', ')}. Esto introduce sesgo de colisionador.`,
    }
  }

  // Check 2: common ancestors of treatment and outcome must be in adjustment set
  const treatmentAncestors = getAncestors(graph, treatment)
  const outcomeAncestors = getAncestors(graph, outcome)

  const commonAncestors = new Set<string>()
  for (const anc of treatmentAncestors) {
    if (outcomeAncestors.has(anc)) commonAncestors.add(anc)
  }

  const adjustmentSetSet = new Set(adjustmentSet)
  const missingConfounders: string[] = []
  for (const confounder of commonAncestors) {
    if (!adjustmentSetSet.has(confounder)) {
      missingConfounders.push(confounder)
    }
  }

  if (missingConfounders.length > 0) {
    return {
      valid: false,
      reason: `Confusores no bloqueados (ancestros comunes de tratamiento y resultado no controlados): ${missingConfounders.join(', ')}.`,
    }
  }

  return {
    valid: true,
    reason: `El conjunto de ajuste ${adjustmentSet.length > 0 ? `{${adjustmentSet.join(', ')}}` : '∅'} bloquea todos los caminos de puerta trasera y no contiene descendientes del tratamiento.`,
  }
}

/**
 * The default AAPL causal config pre-seeded for quick start.
 * Based on the López de Prado AAPL case study.
 */
export const AAPL_DEFAULT_CONFIG: CausalConfig = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  treatment: 'FED_RATE',
  outcome: 'FutureReturn',
  horizon: 2,
  confounders: ['YIELD_10Y', 'VIX'],
  excluded: {
    Return: 'Descendiente: retorno contemporáneo causa retorno futuro (data leakage)',
  },
  dagEdges: [
    { from: 'YIELD_10Y', to: 'FED_RATE', label: 'Curva de rendimientos → política monetaria' },
    { from: 'VIX', to: 'FED_RATE', label: 'Volatilidad → decisiones Fed' },
    { from: 'FED_RATE', to: 'FutureReturn', label: 'Política monetaria → retorno futuro' },
    { from: 'YIELD_10Y', to: 'FutureReturn', label: 'Tasa libre riesgo → DCF' },
    { from: 'VIX', to: 'FutureReturn', label: 'Risk-off → deprime retornos' },
  ],
}
