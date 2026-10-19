import { type ViewChange, _type, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { ast } from '../ast'
import type { ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import { type ModelChangePlan, addToPlan, removeNode } from './_anchors'
import { findStep } from './_steps'
import { ModelChangeError } from './ModelChangeError'

/**
 * Plans the removal of a step from a dynamic view.
 * The step is found by its id in the view computed from the current sources, so a stale id
 * points to the step that has this id now (or to none).
 * Steps of a chain (`a -> b -> c`) are refused.
 */
export function removeDynamicStep(
  services: LikeC4Services,
  { lookup, model, change }: {
    lookup: ViewLocateResult
    model: LikeC4Model<UnknownParsed>
    change: ViewChange.RemoveDynamicStep
  },
): ModelChangePlan {
  const { viewAst, doc } = lookup
  if (lookup.view[_type] !== 'dynamic' || !ast.isDynamicView(viewAst)) {
    throw new ModelChangeError(
      'unsupported-in-view',
      `remove-dynamic-step is not supported in ${lookup.view[_type]} views`,
    )
  }
  const node = findStep(services, model, doc, viewAst, lookup.view.id, change.step)
  if (!node) {
    throw new ModelChangeError('not-found', `Step "${change.step}" not found`)
  }
  if (ast.isStepSeries(node) || ast.isStepSeries(node.$container)) {
    throw new ModelChangeError('unsupported-in-view', 'Steps of a chain cannot be removed from the canvas')
  }
  const anchored = removeNode(doc.textDocument, nonNullable(node.$cstNode, 'step has no cst node'))
  const uri = doc.textDocument.uri
  const plan: ModelChangePlan = { edits: new Map(), modifiedRange: { uri, range: anchored.range } }
  addToPlan(plan, uri, anchored)
  return plan
}
