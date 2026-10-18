import { type ProjectId, type ViewChange, _type, DeploymentFqn, Fqn, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { deriveIdentifier, isValidIdentifier } from '@likec4/core/utils'
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
import { findDeploymentDefinition, fqnRefText } from './_lookup'
import { isDeploymentElementVisible } from './_visibility'
import { ModelChangeError } from './ModelChangeError'

type Arg<C> = {
  projectId: ProjectId
  lookup: ViewLocateResult
  model: LikeC4Model<UnknownParsed>
  change: C
}

function ensureDeploymentView(lookup: ViewLocateResult, op: string): void {
  if (lookup.view[_type] !== 'deployment') {
    throw new ModelChangeError('unsupported-in-view', `${op} is not supported in ${lookup.view[_type]} views`)
  }
}

/**
 * Names taken by the children of the parent node (or by root nodes)
 */
function takenNames(model: LikeC4Model<UnknownParsed>, parent: DeploymentFqn | null): Set<string> {
  if (!parent) {
    return new Set([...model.deployment.roots()].map(n => n.name))
  }
  const parentModel = model.deployment.findElement(parent)
  if (!parentModel || !parentModel.isDeploymentNode()) {
    throw new ModelChangeError('not-found', `Deployment node "${parent}" not found`)
  }
  return new Set([...parentModel.children()].map(n => n.name))
}

function resolveName(
  explicit: string | undefined,
  derived: () => string,
  taken: Set<string>,
  fqnOf: (name: string) => string,
) {
  if (explicit === undefined) {
    return derived()
  }
  if (!isValidIdentifier(explicit)) {
    throw new ModelChangeError('invalid-name', `Invalid identifier "${explicit}"`)
  }
  if (taken.has(explicit)) {
    throw new ModelChangeError('name-collision', `Deployment element "${fqnOf(explicit)}" already exists`)
  }
  return explicit
}

/**
 * Inserts the line into the parent node, or into the `deployment {}` of the view file
 */
function placeLine(
  services: LikeC4Services,
  projectId: ProjectId,
  lookup: ViewLocateResult,
  parent: DeploymentFqn | null,
  line: string,
): { uri: string; anchored: AnchoredEdit } {
  if (parent) {
    const definition = findDeploymentDefinition(services, projectId, Fqn(parent))
    if (!definition) {
      throw new ModelChangeError('not-found', `Deployment node "${parent}" not found`)
    }
    const { doc, node } = definition
    const nodeCst = nonNullable(node.$cstNode, 'deployment node has no cst node')
    return {
      uri: doc.textDocument.uri,
      anchored: node.body?.$cstNode
        ? appendToBlock(doc.textDocument, nodeCst, node.body.$cstNode, [line])
        : appendBody(doc.textDocument, nodeCst, [line]),
    }
  }
  const doc = lookup.doc
  const deploymentCst = doc.parseResult.value.deployments[0]?.$cstNode
  return {
    uri: doc.textDocument.uri,
    anchored: deploymentCst
      ? appendToBlock(doc.textDocument, deploymentCst, deploymentCst, [line])
      : appendTopLevelBlock(doc.textDocument, 'deployment', [line]),
  }
}

function planWithInclude(
  lookup: ViewLocateResult,
  placed: { uri: string; anchored: AnchoredEdit },
  visible: boolean,
  fqn: string,
): ModelChangePlan {
  const plan: ModelChangePlan = { edits: new Map(), modifiedRange: { uri: placed.uri, range: placed.anchored.range } }
  addToPlan(plan, placed.uri, placed.anchored)
  if (!visible) {
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

/**
 * Plans `name = kind 'title'` in the deployment model
 */
export function addDeploymentNode(
  services: LikeC4Services,
  { projectId, lookup, model, change }: Arg<ViewChange.AddDeploymentNode>,
): ModelChangePlan {
  ensureDeploymentView(lookup, 'add-deployment-node')
  const { parent, kind, title } = change
  if (!Object.hasOwn(model.specification.deployments, kind)) {
    throw new ModelChangeError('unknown-kind', `Unknown deployment node kind "${kind}"`)
  }
  const taken = takenNames(model, parent)
  const fqnOf = (name: string) => DeploymentFqn(name, parent)
  const name = resolveName(change.name, () => deriveIdentifier(title, kind, taken), taken, fqnOf)
  const fqn = fqnOf(name)
  const placed = placeLine(services, projectId, lookup, parent, `${name} = ${kind} ${quote(title)}`)
  const visible = isDeploymentElementVisible(model, lookup.view.id, { id: fqn, kind, title, style: {} })
  return { ...planWithInclude(lookup, placed, visible, fqn), created: fqn }
}

/**
 * Plans `instanceOf <element>` inside a deployment node.
 * The instance is named after the element; when the name is taken, `name = instanceOf <element>` is written.
 */
export function addInstance(
  services: LikeC4Services,
  { projectId, lookup, model, change }: Arg<ViewChange.AddInstance>,
): ModelChangePlan {
  ensureDeploymentView(lookup, 'add-instance')
  const { parent } = change
  const element = Fqn(change.element)
  const elementModel = model.findElement(element)
  if (!elementModel) {
    throw new ModelChangeError('not-found', `Element "${element}" not found`)
  }
  const taken = takenNames(model, parent)
  const fqnOf = (name: string) => DeploymentFqn(name, parent)
  const implicitName = elementModel.name
  const name = resolveName(change.name, () => deriveIdentifier(implicitName, implicitName, taken), taken, fqnOf)
  const ref = `instanceOf ${fqnRefText(element)}`
  // The short form names the instance after the element
  const line = name === implicitName ? ref : `${name} = ${ref}`
  const fqn = fqnOf(name)
  const placed = placeLine(services, projectId, lookup, parent, line)
  const visible = isDeploymentElementVisible(model, lookup.view.id, { id: fqn, element, style: {} })
  return { ...planWithInclude(lookup, placed, visible, fqn), created: fqn }
}
