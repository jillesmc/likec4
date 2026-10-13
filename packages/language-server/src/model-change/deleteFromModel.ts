import { type ProjectId, type RelationId, type ViewChange, DeploymentFqn, Fqn, nonNullable } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import type { AstNode } from 'langium'
import { type ParsedLikeC4LangiumDocument, ast, isParsedLikeC4LangiumDocument } from '../ast'
import type { LikeC4Services } from '../module'
import { type ModelChangePlan, addToPlan, removeNode } from './_anchors'
import { findDeploymentDefinition, findElementDefinition } from './_lookup'
import { ModelChangeError } from './ModelChangeError'

export interface DeleteFromModelArg {
  projectId: ProjectId
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.DeleteFromModel
}

function findRelation(
  services: LikeC4Services,
  projectId: ProjectId,
  id: RelationId,
): { doc: ParsedLikeC4LangiumDocument; node: AstNode } | null {
  const documents = services.shared.workspace.LangiumDocuments.projectDocuments(projectId)
  for (const doc of documents) {
    if (!isParsedLikeC4LangiumDocument(doc)) {
      continue
    }
    const relation = doc.c4Relations.find(r => r.id === id) ?? doc.c4DeploymentRelations.find(r => r.id === id)
    if (relation) {
      const node = services.workspace.AstNodeLocator.getAstNode(doc.parseResult.value, relation.astPath)
      if (node) {
        return { doc, node }
      }
    }
  }
  return null
}

/**
 * Where the definition is referenced: references from anywhere in the workspace,
 * plus nested entries (children, relations) of its body
 */
function referencesOf(services: LikeC4Services, node: ast.Element | ast.DeploymentNode | ast.DeployedInstance) {
  const references = services.references.References
    .findReferences(node, { includeDeclaration: false })
    .map(ref => `${ref.sourceUri.path.split('/').pop()}:${ref.segment.range.start.line + 1}`)
    .toArray()
  const nested: readonly AstNode[] = node.body?.elements ?? []
  for (const child of nested) {
    const doc = child.$cstNode?.root.astNode.$document
    references.push(`${doc?.uri.path.split('/').pop() ?? '?'}:${(child.$cstNode?.range.start.line ?? 0) + 1}`)
  }
  return references
}

/**
 * Plans the removal of a definition.
 * Elements and deployment nodes are refused while they are referenced (or have nested entries).
 */
export function deleteFromModel(
  services: LikeC4Services,
  { projectId, model, change }: DeleteFromModelArg,
): ModelChangePlan {
  const { target } = change
  let found: { doc: ParsedLikeC4LangiumDocument; node: AstNode } | null
  let label: string
  switch (true) {
    case 'relation' in target: {
      found = findRelation(services, projectId, target.relation)
      label = `Relation "${target.relation}"`
      break
    }
    case 'element' in target: {
      const fqn = Fqn(target.element)
      label = `Element "${fqn}"`
      const definition = findElementDefinition(services, projectId, fqn)
      if (!definition && model.findElement(fqn)) {
        throw new ModelChangeError('read-only-target', `"${fqn}" is defined in another project`)
      }
      found = definition
      break
    }
    default: {
      const fqn = DeploymentFqn(target.deploymentNode)
      label = `Deployment node "${fqn}"`
      found = findDeploymentDefinition(services, projectId, Fqn(fqn))
    }
  }
  if (!found) {
    throw new ModelChangeError('not-found', `${label} not found`)
  }
  const { doc, node } = found
  if (ast.isElement(node) || ast.isDeploymentNode(node) || ast.isDeployedInstance(node)) {
    const references = referencesOf(services, node)
    if (references.length > 0) {
      const places = references.length === 1 ? '1 place' : `${references.length} places`
      throw new ModelChangeError('has-references', `${label} is referenced in ${places}: ${references.join(', ')}`)
    }
  }
  const anchored = removeNode(doc.textDocument, nonNullable(node.$cstNode, 'definition has no cst node'))
  const uri = doc.textDocument.uri
  const plan: ModelChangePlan = { edits: new Map(), modifiedRange: { uri, range: anchored.range } }
  addToPlan(plan, uri, anchored)
  return plan
}
