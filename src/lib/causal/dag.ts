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
  treatment: 'CAPEX_Growth',
  outcome: 'Future_Return',
  horizon: 2,
  confounders: ['YIELD_10Y', 'FED_RATE', 'VIX', 'RETURN_COM_EQY', 'GROSS_MARGIN'],
  excluded: {
    PE_RATIO: 'Colisionador: el precio de mercado causa tanto PE_RATIO como Future_Return',
    PX_TO_BOOK_RATIO: 'Colisionador: precio de mercado causa ambos lados',
    NET_INCOME: 'Descendiente de CAPEX_Growth vía eficiencia operativa',
    TRAIL_12M_EPS: 'Mediador en camino causal CAPEX→EPS→Return — no controlar',
    BEST_TARGET_PRICE: 'Descendiente del precio actual',
  },
  mediators: ['TRAIL_12M_EPS'],
  dagEdges: [
    { from: 'CAPEX_Growth', to: 'TRAIL_12M_EPS', label: 'Capex→eficiencia→EPS' },
    { from: 'TRAIL_12M_EPS', to: 'Future_Return', label: 'EPS→valoración→retorno' },
    { from: 'CAPEX_Growth', to: 'Future_Return', label: 'Señal crecimiento→retorno directo' },
    { from: 'YIELD_10Y', to: 'CAPEX_Growth', label: 'Tasas altas frenan inversión' },
    { from: 'FED_RATE', to: 'CAPEX_Growth', label: 'Costo capital→decisión Capex' },
    { from: 'VIX', to: 'CAPEX_Growth', label: 'Incertidumbre→congela Capex' },
    { from: 'RETURN_COM_EQY', to: 'CAPEX_Growth', label: 'Rentabilidad alta→más Capex' },
    { from: 'GROSS_MARGIN', to: 'CAPEX_Growth', label: 'Margen→caja libre para invertir' },
    { from: 'YIELD_10Y', to: 'Future_Return', label: 'Tasa libre riesgo→DCF' },
    { from: 'FED_RATE', to: 'Future_Return', label: 'Política monetaria→múltiplos' },
    { from: 'VIX', to: 'Future_Return', label: 'Risk-off→deprime retornos' },
    { from: 'RETURN_COM_EQY', to: 'Future_Return', label: 'ROE→retorno accionario' },
    { from: 'GROSS_MARGIN', to: 'Future_Return', label: 'Calidad operativa→retorno sostenido' },
  ],
}
