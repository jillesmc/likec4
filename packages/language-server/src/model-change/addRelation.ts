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
  indentUnit,
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
  const { source, target, title, kind, technology } = change
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

  if (kind && !Object.hasOwn(model.specification.relationships, kind)) {
    throw new ModelChangeError('unknown-kind', `Unknown relationship kind "${kind}"`)
  }

  const connector = kind ? `-[${kind}]->` : '->'
  const titleSuffix = title ? ' ' + quote(title) : ''
  // Technology goes in a body: positional technology requires a description before it
  const relationLines = (head: string, unit: string) =>
    technology
      ? [`${head} {`, `${unit}technology ${quote(technology)}`, '}']
      : [head]
  let uri: string
  let anchored: AnchoredEdit

  const definition = findElementDefinition(services, projectId, source)
  if (definition) {
    const { doc, node } = definition
    const nodeCst = nonNullable(node.$cstNode, 'element has no cst node')
    const lines = relationLines(`${connector} ${fqnRefText(target)}${titleSuffix}`, indentUnit(doc.textDocument))
    uri = doc.textDocument.uri
    anchored = node.body?.$cstNode
      ? appendToBlock(doc.textDocument, nodeCst, node.body.$cstNode, lines)
      : appendBody(doc.textDocument, nodeCst, lines)
  } else {
    // Source is defined in another project (imported)
    const doc = lookup.doc
    const lines = relationLines(
      `${fqnRefText(source)} ${connector} ${fqnRefText(target)}${titleSuffix}`,
      indentUnit(doc.textDocument),
    )
    const modelCst = doc.parseResult.value.models[0]?.$cstNode
    uri = doc.textDocument.uri
    anchored = modelCst
      ? appendToBlock(doc.textDocument, modelCst, modelCst, lines)
      : appendTopLevelBlock(doc.textDocument, 'model', lines)
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
