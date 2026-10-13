import { type ViewChange, DeploymentFqn, Fqn } from '@likec4/core/types'

/**
 * Minimal node shape used to resolve connections (works with xyflow nodes and internal nodes)
 */
export interface ConnectableNode {
  type?: string | undefined
  data: object
  measured?: { width?: number | undefined; height?: number | undefined } | undefined
}

export function modelFqnOf(node: ConnectableNode | null | undefined): Fqn | null {
  if (!node || (node.type !== 'element' && node.type !== 'compound-element')) {
    return null
  }
  return 'modelFqn' in node.data && typeof node.data.modelFqn === 'string' ? Fqn(node.data.modelFqn) : null
}

/**
 * Converts a connection gesture between two nodes into an `add-relation` change.
 * Returns null when the connection is not valid (no target, same element, not model elements)
 */
export function resolveConnection(
  from: ConnectableNode | null | undefined,
  to: ConnectableNode | null | undefined,
): ViewChange.AddRelation | null {
  const source = modelFqnOf(from)
  const target = modelFqnOf(to)
  if (!source || !target || source === target) {
    return null
  }
  return {
    op: 'add-relation',
    source,
    target,
  }
}

/**
 * Returns the innermost (smallest) node, e.g. the node under the pointer among nested compounds
 */
export function innermostNode<N extends ConnectableNode>(nodes: readonly N[]): N | null {
  let result: N | null = null
  let minArea = Infinity
  for (const node of nodes) {
    const area = (node.measured?.width ?? Infinity) * (node.measured?.height ?? Infinity)
    if (result === null || area < minArea) {
      result = node
      minArea = area
    }
  }
  return result
}

/**
 * Target of a title change: the deployment element in deployment views, otherwise the model element
 */
export function titleTargetOf(node: ConnectableNode): Fqn | DeploymentFqn | null {
  if ('deploymentFqn' in node.data && typeof node.data.deploymentFqn === 'string') {
    return DeploymentFqn(node.data.deploymentFqn)
  }
  return modelFqnOf(node)
}
