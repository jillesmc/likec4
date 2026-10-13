import {
  type DeploymentElement,
  type Element,
  type ElementKind,
  type Fqn,
  type FqnRef,
  type Relationship,
  type ViewId,
  RelationId,
  splitGlobalFqn,
} from '@likec4/core'
import { computeView } from '@likec4/core/compute-view'
import { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'

const PREDICTED_RELATION = RelationId('__likec4_predicted_relation__')

function toModelRef(fqn: Fqn): FqnRef.ModelRef {
  const [project, model] = splitGlobalFqn(fqn)
  return project ? { project, model } : { model }
}

/**
 * Predicts whether a new relation `source -> target` would be visible in the view,
 * by computing the view over the model patched in memory (nothing is written).
 *
 * Returns `true` when the prediction is not possible (e.g. the view fails to compute),
 * so that no `include` is added.
 */
export function isRelationVisible(
  model: LikeC4Model<UnknownParsed>,
  viewId: ViewId,
  source: Fqn,
  target: Fqn,
): boolean {
  const data = model.$data
  const viewSource = data.views[viewId]
  if (!viewSource) {
    return true
  }
  const relation: Relationship = {
    id: PREDICTED_RELATION,
    source: toModelRef(source),
    target: toModelRef(target),
  }
  const patched = LikeC4Model.create({
    ...data,
    relations: {
      ...data.relations,
      [PREDICTED_RELATION]: relation,
    },
  })
  const result = computeView(viewSource, patched)
  if (!result.isSuccess) {
    return true
  }
  return result.view.edges.some(edge => edge.relations.includes(PREDICTED_RELATION))
}

/**
 * Predicts whether a new element would be visible in the view (see {@link isRelationVisible})
 */
export function isElementVisible(
  model: LikeC4Model<UnknownParsed>,
  viewId: ViewId,
  fqn: Fqn,
  kind: ElementKind,
  title: string,
): boolean {
  const data = model.$data
  const viewSource = data.views[viewId]
  if (!viewSource) {
    return true
  }
  const element: Element = {
    id: fqn,
    kind,
    title,
    style: {},
  }
  const patched = LikeC4Model.create({
    ...data,
    elements: {
      ...data.elements,
      [fqn]: element,
    },
  })
  const result = computeView(viewSource, patched)
  if (!result.isSuccess) {
    return true
  }
  return result.view.nodes.some(node => node.id === fqn)
}

/**
 * Predicts whether a new deployment node or instance would be visible in the deployment view
 * (see {@link isRelationVisible})
 */
export function isDeploymentElementVisible(
  model: LikeC4Model<UnknownParsed>,
  viewId: ViewId,
  element: DeploymentElement,
): boolean {
  const data = model.$data
  const viewSource = data.views[viewId]
  if (!viewSource) {
    return true
  }
  const patched = LikeC4Model.create({
    ...data,
    deployments: {
      ...data.deployments,
      elements: {
        ...data.deployments.elements,
        [element.id]: element,
      },
    },
  })
  const result = computeView(viewSource, patched)
  if (!result.isSuccess) {
    return true
  }
  return result.view.nodes.some(node => node.id === element.id)
}
