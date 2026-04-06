import type { CausalConfig } from './types'
import { buildDAG, getAncestors, getDescendants, getBackdoorPaths, validateAdjustmentSet } from './dag'

/**
 * Given a CausalConfig, determine the correct adjustment set using the backdoor criterion.
 * Returns the confounders from config that are:
 * - Not descendants of treatment
 * - Not mediators (on causal path)
 * - Ancestors of treatment or outcome (or both)
 *
 * Also returns validation result and list of backdoor paths for UI display.
 */
export function backdoorCriterion(config: CausalConfig): {
  adjustmentSet: string[]
  backdoorPaths: string[][]
  validation: { valid: boolean; reason: string }
} {
  const allNodes = Array.from(
    new Set([
      config.treatment,
      config.outcome,
      ...config.confounders,
      ...(config.mediators ?? []),
      ...config.dagEdges.map((e) => e.from),
      ...config.dagEdges.map((e) => e.to),
    ])
  )

  const graph = buildDAG(allNodes, config.dagEdges)

  const treatmentDescendants = getDescendants(graph, config.treatment)
  const treatmentAncestors = getAncestors(graph, config.treatment)
  const outcomeAncestors = getAncestors(graph, config.outcome)
  const mediatorSet = new Set(config.mediators ?? [])

  // Filter confounders: keep only those that are:
  // 1. Not a descendant of treatment
  // 2. Not a mediator
  // 3. An ancestor of treatment OR outcome (actual potential confounder)
  const adjustmentSet = config.confounders.filter((v) => {
    if (treatmentDescendants.has(v)) return false
    if (mediatorSet.has(v)) return false
    if (treatmentAncestors.has(v) || outcomeAncestors.has(v)) return true
    return false
  })

  const backdoorPaths = getBackdoorPaths(graph, config.treatment, config.outcome)

  const validation = validateAdjustmentSet(
    graph,
    config.treatment,
    config.outcome,
    adjustmentSet
  )

  return { adjustmentSet, backdoorPaths, validation }
}
