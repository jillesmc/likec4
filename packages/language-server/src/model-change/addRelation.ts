import { type ProjectId, type ViewChange, _type, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import type { ViewLocateResult } from '../model'
import type { LikeC4Services } from '../module'
import {
  type AnchoredEdit,
  type ModelChangePlan,
  addToPlan,
  appendBody,
  appendToBlock,
  appendTopLevelBlock,
  quote,
} from './_anchors'
import { findElementDefinition, fqnRefText } from './_lookup'
import { isRelationVisible } from './_visibility'
import { ModelChangeError } from './ModelChangeError'

export interface AddRelationArg {
  projectId: ProjectId
  lookup: ViewLocateResult
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.AddRelation
}

/**
 * Plans `source -> target`:
 * - inside the source element's definition block (`-> target`)
 * - or, when the source is not defined in this project, in the `model {}` of the view's file
 * - plus `include source -> target` in the view, when the relation would not be visible
 */
export function addRelation(
  services: LikeC4Services,
  { projectId, lookup, model, change }: AddRelationArg,
): ModelChangePlan {
  const { source, target, title } = change
  if (lookup.view[_type] !== 'element') {
    throw new ModelChangeError(
      'unsupported-in-view',
      `add-relation is not supported in ${lookup.view[_type]} views`,
    )
  }
  for (const fqn of [source, target]) {
    if (!model.findElement(fqn)) {
      throw new ModelChangeError('not-found', `Element "${fqn}" not found`)
    }
  }

  const titleSuffix = title ? ' ' + quote(title) : ''
  let uri: string
  let anchored: AnchoredEdit

  const definition = findElementDefinition(services, projectId, source)
  if (definition) {
    const { doc, node } = definition
    const nodeCst = nonNullable(node.$cstNode, 'element has no cst node')
    const line = `-> ${fqnRefText(target)}${titleSuffix}`
    uri = doc.textDocument.uri
    anchored = node.body?.$cstNode
      ? appendToBlock(doc.textDocument, nodeCst, node.body.$cstNode, [line])
      : appendBody(doc.textDocument, nodeCst, [line])
  } else {
    // Source is defined in another project (imported)
    const doc = lookup.doc
    const line = `${fqnRefText(source)} -> ${fqnRefText(target)}${titleSuffix}`
    const modelCst = doc.parseResult.value.models[0]?.$cstNode
    uri = doc.textDocument.uri
    anchored = modelCst
      ? appendToBlock(doc.textDocument, modelCst, modelCst, [line])
      : appendTopLevelBlock(doc.textDocument, 'model', [line])
  }

  const plan: ModelChangePlan = {
    edits: new Map(),
    modifiedRange: { uri, range: anchored.range },
  }
  addToPlan(plan, uri, anchored)

  if (!isRelationVisible(model, lookup.view.id, source, target)) {
    const viewCst = nonNullable(lookup.viewAst.$cstNode, 'view has no cst node')
    const bodyCst = nonNullable(lookup.viewAst.body?.$cstNode, `view ${lookup.view.id} has no body`)
    addToPlan(
      plan,
      lookup.doc.textDocument.uri,
      appendToBlock(lookup.doc.textDocument, viewCst, bodyCst, [
        `include ${fqnRefText(source)} -> ${fqnRefText(target)}`,
      ]),
    )
  }

  return plan
}
