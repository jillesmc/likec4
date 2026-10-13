import { type ProjectId, type ViewChange, _type, Fqn, nonNullable } from '@likec4/core'
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
import { findElementDefinition } from './_lookup'
import { deriveIdentifier, isValidIdentifier } from './_naming'
import { isElementVisible } from './_visibility'
import { ModelChangeError } from './ModelChangeError'

export interface AddElementArg {
  projectId: ProjectId
  lookup: ViewLocateResult
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.AddElement
}

/**
 * Plans `name = kind 'title'`:
 * - inside the parent's definition block (not `extend`)
 * - or, without parent, in the first `model {}` of the view file (created when missing)
 * - plus `include <fqn>` in the view, when the element would not be visible
 */
export function addElement(
  services: LikeC4Services,
  { projectId, lookup, model, change }: AddElementArg,
): ModelChangePlan {
  const { parent, kind, title } = change
  if (lookup.view[_type] !== 'element') {
    throw new ModelChangeError('unsupported-in-view', `add-element is not supported in ${lookup.view[_type]} views`)
  }
  if (!(kind in model.specification.elements)) {
    throw new ModelChangeError('unknown-kind', `Unknown element kind "${kind}"`)
  }

  let siblings: Iterable<{ name: string }>
  if (parent) {
    const parentModel = model.findElement(parent)
    if (!parentModel) {
      throw new ModelChangeError('not-found', `Element "${parent}" not found`)
    }
    siblings = parentModel.children()
  } else {
    siblings = model.roots()
  }
  const taken = new Set([...siblings].map(s => s.name))

  let name: string
  if (change.name !== undefined) {
    name = change.name
    if (!isValidIdentifier(name)) {
      throw new ModelChangeError('invalid-name', `Invalid identifier "${name}"`)
    }
    if (taken.has(name)) {
      throw new ModelChangeError('name-collision', `Element "${Fqn(name, parent)}" already exists`)
    }
  } else {
    name = deriveIdentifier(title, kind, taken)
  }
  const fqn = Fqn(name, parent)
  const line = `${name} = ${kind} ${quote(title)}`

  let uri: string
  let anchored: AnchoredEdit
  if (parent) {
    const definition = findElementDefinition(services, projectId, parent)
    if (!definition) {
      throw new ModelChangeError('read-only-target', `"${parent}" is defined in another project`)
    }
    const { doc, node } = definition
    const nodeCst = nonNullable(node.$cstNode, 'element has no cst node')
    uri = doc.textDocument.uri
    anchored = node.body?.$cstNode
      ? appendToBlock(doc.textDocument, nodeCst, node.body.$cstNode, [line])
      : appendBody(doc.textDocument, nodeCst, [line])
  } else {
    const doc = lookup.doc
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

  if (!isElementVisible(model, lookup.view.id, fqn, kind, title)) {
    const viewCst = nonNullable(lookup.viewAst.$cstNode, 'view has no cst node')
    const bodyCst = nonNullable(lookup.viewAst.body?.$cstNode, `view ${lookup.view.id} has no body`)
    addToPlan(
      plan,
      lookup.doc.textDocument.uri,
      appendToBlock(lookup.doc.textDocument, viewCst, bodyCst, [`include ${fqn}`]),
    )
  }

  return plan
}
