import type { NonEmptyArray, ViewChange } from '@likec4/core/types'
import { type ConnectableNode, titleTargetOf } from './connect'

/**
 * Converts deleted nodes and edges into `exclude-from-view`.
 * Returns null in dynamic views (no `exclude` rule there) or when nothing can be excluded.
 */
export function excludeChangeOf(
  viewType: string,
  nodes: readonly ConnectableNode[],
  edges: readonly { source: string; target: string }[],
  nodeById: (id: string) => ConnectableNode | undefined,
): ViewChange.ExcludeFromView | null {
  if (viewType === 'dynamic') {
    return null
  }
  const targets = [] as ViewChange.ExcludeTarget[]
  for (const node of nodes) {
    const fqn = titleTargetOf(node)
    if (fqn) {
      targets.push({ node: fqn })
    }
  }
  for (const edge of edges) {
    const source = nodeById(edge.source)
    const target = nodeById(edge.target)
    const sourceFqn = source && titleTargetOf(source)
    const targetFqn = target && titleTargetOf(target)
    if (sourceFqn && targetFqn) {
      targets.push({ edge: { source: sourceFqn, target: targetFqn } })
    }
  }
  const [first, ...rest] = targets
  if (!first) {
    return null
  }
  const nonEmpty: NonEmptyArray<ViewChange.ExcludeTarget> = [first, ...rest]
  return { op: 'exclude-from-view', targets: nonEmpty }
}
