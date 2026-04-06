/**
 * Statistical foundation for PC causal discovery algorithm.
 * Implements partial correlation and Fisher's Z conditional independence test.
 */

/**
 * Standard normal CDF using Abramowitz & Stegun 26.2.17 approximation.
 * Max error: 7.5e-8
 */
function standardNormalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const pdf = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)
  const cdf = 1 - pdf * poly
  return z >= 0 ? cdf : 1 - cdf
}

/**
 * Compute the sample Pearson correlation between two arrays.
 * Returns NaN if either array has zero variance.
 */
export function correlation(x: number[], y: number[]): number {
  const n = x.length
  if (n !== y.length || n === 0) return NaN

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let covXY = 0
  let varX = 0
  let varY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    covXY += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX === 0 || varY === 0) return NaN

  return covXY / Math.sqrt(varX * varY)
}

/**
 * Compute partial correlation of X and Y given conditioning set S.
 * Uses the recursive formula:
 *   ρ(X,Y|S) = (ρ(X,Y|S\{z}) - ρ(X,z|S\{z}) * ρ(Y,z|S\{z})) /
 *              sqrt((1 - ρ(X,z|S\{z})²) * (1 - ρ(Y,z|S\{z})²))
 * Base case (S empty): returns correlation(X, Y)
 */
export function partialCorrelation(
  data: Record<string, number[]>,
  x: string,
  y: string,
  condSet: string[]
): number {
  // Base case: no conditioning variables
  if (condSet.length === 0) {
    return correlation(data[x], data[y])
  }

  // Pick last element as the variable to condition on recursively
  const z = condSet[condSet.length - 1]
  const remaining = condSet.slice(0, condSet.length - 1)

  const rhoXY = partialCorrelation(data, x, y, remaining)
  const rhoXZ = partialCorrelation(data, x, z, remaining)
  const rhoYZ = partialCorrelation(data, y, z, remaining)

  const denominator = Math.sqrt((1 - rhoXZ * rhoXZ) * (1 - rhoYZ * rhoYZ))

  if (denominator === 0) return NaN

  return (rhoXY - rhoXZ * rhoYZ) / denominator
}

/**
 * Fisher's Z conditional independence test.
 * Tests H0: X ⊥⊥ Y | S (X is conditionally independent of Y given S)
 *
 * Z-statistic: Z = atanh(ρ) * sqrt(n - |S| - 3)
 * Under H0, Z ~ N(0, 1)
 * p-value = 2 * (1 - Φ(|Z|))
 *
 * For |S| + 3 >= n, the test is unreliable — returns p=1 (cannot reject).
 */
export function fisherZTest(
  data: Record<string, number[]>,
  x: string,
  y: string,
  condSet: string[],
  n: number,
  alpha = 0.05
): { pValue: number; zStat: number; isIndependent: boolean } {
  // Guard: not enough degrees of freedom
  if (condSet.length + 3 >= n) {
    return { pValue: 1, zStat: 0, isIndependent: true }
  }

  const rho = partialCorrelation(data, x, y, condSet)

  if (isNaN(rho)) {
    return { pValue: 1, zStat: 0, isIndependent: true }
  }

  // Clamp rho to avoid atanh singularity at ±1
  const rhoSafe = Math.max(-0.9999999, Math.min(0.9999999, rho))
  const zStat = Math.atanh(rhoSafe) * Math.sqrt(n - condSet.length - 3)
  const pValue = 2 * (1 - standardNormalCDF(Math.abs(zStat)))
  const isIndependent = pValue >= alpha

  return { pValue, zStat, isIndependent }
}

// ---------------------------------------------------------------------------
// PC Algorithm
// ---------------------------------------------------------------------------

export interface PCEdge {
  from: string
  to: string
  oriented: boolean // true = directed, false = undirected
}

export interface PCResult {
  edges: PCEdge[]
  separatingSets: Record<string, Record<string, string[]>> // sep[x][y] = separating set
  adjacencyMatrix: Record<string, Record<string, boolean>> // undirected adjacency
}

/**
 * Enumerate all k-combinations of an array.
 * E.g. combinations([A,B,C], 2) → [[A,B],[A,C],[B,C]]
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (k > arr.length) return []
  const result: T[][] = []
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1)
    for (const combo of rest) {
      result.push([arr[i], ...combo])
    }
  }
  return result
}

/**
 * Run the PC algorithm to discover a causal skeleton from data.
 *
 * Why: Conventional factor investing can't distinguish confounders from colliders.
 * The PC algorithm discovers which variables are truly connected causally
 * by testing conditional independence at increasing conditioning set sizes.
 * The DAG manual always takes precedence economically, but PC results are
 * reported for comparison (Step 2B of López de Prado pipeline).
 *
 * Algorithm:
 * Phase 1 — Skeleton discovery:
 *   Start with complete undirected graph.
 *   For l = 0, 1, 2, ... (max l = maxCondSetSize):
 *     For each edge (X, Y) in current graph:
 *       For each subset S of adj(X)\{Y} with |S| = l:
 *         If fisherZTest(X, Y | S).isIndependent:
 *           Remove edge (X, Y)
 *           Record sep[X][Y] = sep[Y][X] = S
 *           Break inner loop
 *
 * Phase 2 — V-structure orientation (colliders):
 *   For each unshielded triple X - Z - Y (X and Y not adjacent):
 *     If Z ∉ sep[X][Y]:
 *       Orient as X → Z ← Y (collider/v-structure)
 *
 * @param data - Record<variableName, number[]> aligned observations
 * @param variables - list of variable names to include
 * @param n - number of observations
 * @param alpha - CI test significance level (default 0.05)
 * @param maxCondSetSize - max conditioning set size (default 3, sufficient for p≤8)
 */
export function runPC(
  data: Record<string, number[]>,
  variables: string[],
  n: number,
  alpha = 0.05,
  maxCondSetSize = 3
): PCResult {
  // Initialize adjacency matrix — start fully connected
  const adj: Record<string, Record<string, boolean>> = {}
  for (const v of variables) {
    adj[v] = {}
    for (const u of variables) {
      adj[v][u] = v !== u
    }
  }

  // Separating sets
  const sep: Record<string, Record<string, string[]>> = {}
  for (const v of variables) {
    sep[v] = {}
  }

  // Phase 1: Skeleton discovery
  for (let l = 0; l <= maxCondSetSize; l++) {
    // Collect current edges (unordered pairs, avoid duplicates)
    const edges: [string, string][] = []
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const x = variables[i]
        const y = variables[j]
        if (adj[x][y]) edges.push([x, y])
      }
    }

    for (const [x, y] of edges) {
      // Neighbors of x excluding y
      const neighborsX = variables.filter((v) => v !== y && adj[x][v])

      if (neighborsX.length < l) continue

      const condSets = combinations(neighborsX, l)
      for (const S of condSets) {
        const result = fisherZTest(data, x, y, S, n, alpha)
        if (result.isIndependent) {
          adj[x][y] = false
          adj[y][x] = false
          sep[x][y] = S
          sep[y][x] = S
          break
        }
      }
    }

    // Check if any node has enough neighbors for next level
    const maxNeighbors = Math.max(
      ...variables.map((v) => variables.filter((u) => u !== v && adj[v][u]).length)
    )
    if (maxNeighbors <= l) break
  }

  // Phase 2: V-structure orientation
  // Directed edges: oriented[x][y] = true means x → y
  const directed: Record<string, Record<string, boolean>> = {}
  for (const v of variables) {
    directed[v] = {}
    for (const u of variables) {
      directed[v][u] = false
    }
  }

  for (const z of variables) {
    const zNeighbors = variables.filter((v) => adj[z][v])
    // Check all pairs (x, y) of z's neighbors
    for (let i = 0; i < zNeighbors.length; i++) {
      for (let j = i + 1; j < zNeighbors.length; j++) {
        const x = zNeighbors[i]
        const y = zNeighbors[j]
        // Unshielded triple: x and y must NOT be adjacent
        if (adj[x][y]) continue
        // V-structure if z is not in sep[x][y]
        const sepXY = sep[x]?.[y] ?? sep[y]?.[x] ?? []
        if (!sepXY.includes(z)) {
          // Orient as x → z ← y
          directed[x][z] = true
          directed[y][z] = true
        }
      }
    }
  }

  // Build edges list
  const edges: PCEdge[] = []
  const seen = new Set<string>()

  for (const x of variables) {
    for (const y of variables) {
      if (!adj[x][y]) continue
      const key = [x, y].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)

      const xToY = directed[x][y]
      const yToX = directed[y][x]

      if (xToY && !yToX) {
        edges.push({ from: x, to: y, oriented: true })
      } else if (yToX && !xToY) {
        edges.push({ from: y, to: x, oriented: true })
      } else {
        // Undirected edge
        edges.push({ from: x, to: y, oriented: false })
      }
    }
  }

  return { edges, separatingSets: sep, adjacencyMatrix: adj }
}

/**
 * Compare discovered PC edges against a manual DAG.
 * Reports which edges in the manual DAG are inconsistent with PC discoveries.
 * The manual DAG always takes economic precedence, but discrepancies are documented.
 */
export function compareWithManualDAG(
  pcResult: PCResult,
  manualEdges: Array<{ from: string; to: string }>
): {
  consistent: Array<{ from: string; to: string }>
  pcMissing: Array<{ from: string; to: string }> // in manual but PC found independent
  pcExtra: Array<{ from: string; to: string }> // PC found but not in manual
} {
  const { adjacencyMatrix, edges } = pcResult

  const consistent: Array<{ from: string; to: string }> = []
  const pcMissing: Array<{ from: string; to: string }> = []

  for (const edge of manualEdges) {
    const { from, to } = edge
    const pcHasEdge = adjacencyMatrix[from]?.[to] || adjacencyMatrix[to]?.[from]
    if (pcHasEdge) {
      consistent.push(edge)
    } else {
      pcMissing.push(edge)
    }
  }

  // Build a set of manual edges (both directions) for lookup
  const manualSet = new Set(
    manualEdges.flatMap((e) => [`${e.from}|${e.to}`, `${e.to}|${e.from}`])
  )

  const pcExtra: Array<{ from: string; to: string }> = []
  for (const edge of edges) {
    const key1 = `${edge.from}|${edge.to}`
    const key2 = `${edge.to}|${edge.from}`
    if (!manualSet.has(key1) && !manualSet.has(key2)) {
      pcExtra.push({ from: edge.from, to: edge.to })
    }
  }

  return { consistent, pcMissing, pcExtra }
}
