import type { LayoutedView } from '../types'

export interface FqnRenames {
  /**
   * Old → new FQN of renamed or moved elements (their descendants follow)
   */
  elements?: ReadonlyMap<string, string> | undefined
  /**
   * Old → new FQN of renamed deployment nodes and instances (their descendants follow)
   */
  deployments?: ReadonlyMap<string, string> | undefined
}

/**
 * New FQN of `fqn`: renamed itself, or a descendant of a renamed item
 */
export function renameFqn(renames: ReadonlyMap<string, string> | undefined, fqn: string): string {
  if (!renames) {
    return fqn
  }
  const exact = renames.get(fqn)
  if (exact !== undefined) {
    return exact
  }
  for (const [from, to] of renames) {
    if (fqn.startsWith(from + '.')) {
      return to + fqn.slice(from.length)
    }
  }
  return fqn
}

/**
 * Maps the ids of a manual-layout snapshot to the new FQNs after a rename or a move,
 * so the snapshot keeps matching the view (no node reported as removed and re-added).
 *
 * Node ids are element FQNs in element and dynamic views, deployment FQNs in deployment views.
 * Edge ids are left as they are: drift matching falls back to the edge's source and target.
 *
 * @returns the same object when nothing changes
 */
export function renameFqnsInSnapshot<V extends LayoutedView>(view: V, renames: FqnRenames): V {
  const ids = view._type === 'deployment' ? renames.deployments : renames.elements
  const nodeId = <T extends string>(id: T): T => renameFqn(ids, id) as T
  let changed = false
  const nodes = view.nodes.map(node => {
    const next = {
      ...node,
      id: nodeId(node.id),
      parent: node.parent && nodeId(node.parent),
      children: node.children.map(nodeId),
      ...node.modelRef && { modelRef: renameFqn(renames.elements, node.modelRef) as typeof node.modelRef },
      ...node.deploymentRef && {
        deploymentRef: renameFqn(renames.deployments, node.deploymentRef) as typeof node.deploymentRef,
      },
    }
    if (
      next.id !== node.id
      || next.parent !== node.parent
      || next.modelRef !== node.modelRef
      || next.deploymentRef !== node.deploymentRef
      || next.children.some((child, i) => child !== node.children[i])
    ) {
      changed = true
      return next
    }
    return node
  })
  const edges = view.edges.map(edge => {
    const source = nodeId(edge.source)
    const target = nodeId(edge.target)
    const parent = edge.parent && nodeId(edge.parent)
    if (source === edge.source && target === edge.target && parent === edge.parent) {
      return edge
    }
    changed = true
    return { ...edge, source, target, parent }
  })
  return changed ? { ...view, nodes, edges } : view
}
