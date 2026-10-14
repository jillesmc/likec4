import { type ViewChange, _type, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import type { ViewLocateResult } from '../model'
import { type ModelChangePlan, addToPlan, appendToBlock } from './_anchors'
import { fqnRefText } from './_lookup'
import { ModelChangeError } from './ModelChangeError'

const ruleOf = (target: ViewChange.ExcludeTarget): string =>
  'node' in target
    ? `exclude ${fqnRefText(target.node)}`
    : `exclude ${fqnRefText(target.edge.source)} -> ${fqnRefText(target.edge.target)}`

/**
 * Plans `exclude ...` rules at the end of the view body, one per target.
 * Every target must exist (model elements in element views, deployment elements in deployment views).
 * Dynamic views have no `exclude` rule.
 */
export function excludeFromView(
  { lookup, model, change }: {
    lookup: ViewLocateResult
    model: LikeC4Model<UnknownParsed>
    change: ViewChange.ExcludeFromView
  },
): ModelChangePlan {
  const viewType = lookup.view[_type]
  if (viewType === 'dynamic') {
    throw new ModelChangeError('unsupported-in-view', 'exclude-from-view is not supported in dynamic views')
  }
  const exists = (fqn: string) =>
    viewType === 'deployment' ? model.deployment.findElement(fqn) !== null : model.findElement(fqn) !== null
  for (const target of change.targets) {
    const fqns = 'node' in target ? [target.node] : [target.edge.source, target.edge.target]
    for (const fqn of fqns) {
      if (!exists(fqn)) {
        throw new ModelChangeError('not-found', `Element "${fqn}" not found`)
      }
    }
  }
  const { doc, viewAst } = lookup
  const viewCst = nonNullable(viewAst.$cstNode, 'view has no cst node')
  const bodyCst = nonNullable(viewAst.body?.$cstNode, `view ${lookup.view.id} has no body`)
  const anchored = appendToBlock(doc.textDocument, viewCst, bodyCst, change.targets.map(ruleOf))
  const uri = doc.textDocument.uri
  const plan: ModelChangePlan = { edits: new Map(), modifiedRange: { uri, range: anchored.range } }
  addToPlan(plan, uri, anchored)
  return plan
}
