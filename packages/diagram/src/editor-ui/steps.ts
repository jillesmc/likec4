import { type StepPath, type ViewChange, isStepPath } from '@likec4/core/types'

/**
 * Removal of the deleted step edges (dynamic views).
 * Removed from the last to the first, so the ids of the next ones stay valid.
 */
export function removeStepChangesOf(edges: readonly { id: string }[]): ViewChange.RemoveDynamicStep[] {
  return edges
    .map(e => e.id)
    .filter(isStepPath)
    .sort()
    .reverse()
    .map(step => ({ op: 'remove-dynamic-step', step }))
}

export type StepPosition = {
  step: StepPath
  label: string
}

/**
 * Positions offered for a new step: before each top-level step (blocks count as one)
 */
export function stepPositions(
  edges: readonly { id: string; source: string; target: string }[],
  titleOf: (nodeId: string) => string,
): StepPosition[] {
  const positions = new Map<string, StepPosition>()
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!isStepPath(edge.id)) {
      continue
    }
    // `step-02:par.01` belongs to the top-level step `step-02`
    const [topLevel = edge.id] = edge.id.split(':')
    if (positions.has(topLevel)) {
      continue
    }
    const number = Number.parseInt(topLevel.slice('step-'.length), 10)
    const label = topLevel === edge.id
      ? `Before step ${number}: ${titleOf(edge.source)} → ${titleOf(edge.target)}`
      : `Before step ${number} (block)`
    positions.set(topLevel, { step: edge.id, label })
  }
  return [...positions.values()]
}
