import {
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
