import { type StepPath, type ViewId, nonNullable } from '@likec4/core'
import { computeView } from '@likec4/core/compute-view'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import type { AstNode } from 'langium'
import { type ParsedLikeC4LangiumDocument, ast } from '../ast'
import type { LikeC4Services } from '../module'

/**
 * Finds the step of a dynamic view by its id, in the view computed from the current sources
 */
export function findStep(
  services: LikeC4Services,
  model: LikeC4Model<UnknownParsed>,
  doc: ParsedLikeC4LangiumDocument,
  view: ast.DynamicView,
  viewId: ViewId,
  step: StepPath,
): ast.StepOrSeries | null {
  const viewSource = nonNullable(model.$data.views[viewId], `view ${viewId} not found`)
  const computed = computeView(viewSource, model)
  const edge = computed.isSuccess ? computed.view.edges.find(e => e.id === step) : undefined
  if (!edge?.astPath || !view.body) {
    return null
  }
  const locator = services.workspace.AstNodeLocator
  const node = locator.getAstNode(doc.parseResult.value, locator.getAstNodePath(view.body) + edge.astPath)
  return node && ast.isStepOrSeries(node) ? node : null
}

/**
 * The top-level statement of the view body that contains the node
 */
export function topLevelStatement(view: ast.DynamicView, node: AstNode): AstNode | null {
  let current: AstNode | undefined = node
  while (current && current.$container !== view.body) {
    current = current.$container
  }
  return current ?? null
}
