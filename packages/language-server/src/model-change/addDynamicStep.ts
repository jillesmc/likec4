import { type ViewChange, _type, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { ast } from '../ast'
import type { ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import {
  type AnchoredEdit,
  type ModelChangePlan,
  addToPlan,
  appendToBlock,
  insertAfterNode,
  insertBeforeNode,
  quote,
} from './_anchors'
import { fqnRefText } from './_lookup'
import { findStep, topLevelStatement } from './_steps'
import { ModelChangeError } from './ModelChangeError'

/**
 * Plans `source -> target` after the last top-level step of a dynamic view
 * (before the first rule when there are no steps), or before the top-level step at `beforeStep`.
 * No model relation is created.
 */
export function addDynamicStep(
  services: LikeC4Services,
  { lookup, model, change }: {
    lookup: ViewLocateResult
    model: LikeC4Model<UnknownParsed>
    change: ViewChange.AddDynamicStep
  },
): ModelChangePlan {
  const { viewAst, doc } = lookup
  if (lookup.view[_type] !== 'dynamic' || !ast.isDynamicView(viewAst)) {
    throw new ModelChangeError(
      'unsupported-in-view',
      `add-dynamic-step is not supported in ${lookup.view[_type]} views`,
    )
  }
  for (const fqn of [change.source, change.target]) {
    if (!model.findElement(fqn)) {
      throw new ModelChangeError('not-found', `Element "${fqn}" not found`)
    }
  }
  const body = nonNullable(viewAst.body, `view ${lookup.view.id} has no body`)
  const line = `${fqnRefText(change.source)} -> ${fqnRefText(change.target)}`
    + (change.title ? ' ' + quote(change.title) : '')

  const before = change.beforeStep && findStep(services, model, doc, viewAst, lookup.view.id, change.beforeStep)
  const nextStep = before ? topLevelStatement(viewAst, before)?.$cstNode : undefined
  const lastStep = body.steps.at(-1)?.$cstNode
  const firstRule = body.rules[0]?.$cstNode
  let anchored: AnchoredEdit
  switch (true) {
    case !!nextStep:
      anchored = insertBeforeNode(doc.textDocument, nextStep, [line])
      break
    case !!lastStep:
      anchored = insertAfterNode(doc.textDocument, lastStep, [line])
      break
    case !!firstRule:
      anchored = insertBeforeNode(doc.textDocument, firstRule, [line])
      break
    default:
      anchored = appendToBlock(
        doc.textDocument,
        nonNullable(viewAst.$cstNode, 'view has no cst node'),
        nonNullable(body.$cstNode, 'view body has no cst node'),
        [line],
      )
  }
  const uri = doc.textDocument.uri
  const plan: ModelChangePlan = { edits: new Map(), modifiedRange: { uri, range: anchored.range } }
  addToPlan(plan, uri, anchored)
  return plan
}
