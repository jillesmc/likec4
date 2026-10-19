import { type ProjectId, type RelationId, Fqn, splitGlobalFqn } from '@likec4/core'
import type { AstNode } from 'langium'
import { type ParsedLikeC4LangiumDocument, ast, isParsedLikeC4LangiumDocument } from '../ast'
import type { LikeC4Services } from '../module'

/**
 * Finds the definition (not `extend`) of the element in the project
 */
export function findElementDefinition(
  services: LikeC4Services,
  projectId: ProjectId,
  fqn: Fqn,
): { doc: ParsedLikeC4LangiumDocument; node: ast.Element } | null {
  const workspace = services.shared.workspace
  const locator = services.workspace.AstNodeLocator
  for (const desc of services.likec4.FqnIndex.byFqn(projectId, fqn)) {
    if (desc.type !== ast.Element.$type) {
      continue
    }
    const doc = workspace.LangiumDocuments.getDocument(desc.documentUri)
    if (!doc || !isParsedLikeC4LangiumDocument(doc)) {
      continue
    }
    const node = desc.node ?? locator.getAstNode(doc.parseResult.value, desc.path)
    if (ast.isElement(node)) {
      return { doc, node }
    }
  }
  return null
}

/**
 * Text to reference the element from DSL.
 * Imported elements (`@project.fqn`) are referenced by their fqn within the project.
 */
export function fqnRefText(fqn: string): string {
  return splitGlobalFqn(Fqn(fqn))[1]
}

/**
 * Finds the definition of the deployment node or deployed instance in the project
 */
export function findDeploymentDefinition(
  services: LikeC4Services,
  projectId: ProjectId,
  fqn: Fqn,
): { doc: ParsedLikeC4LangiumDocument; node: ast.DeploymentNode | ast.DeployedInstance } | null {
  const workspace = services.shared.workspace
  const locator = services.workspace.AstNodeLocator
  for (const desc of services.likec4.DeploymentsIndex.byFqn(projectId, fqn)) {
    const doc = workspace.LangiumDocuments.getDocument(desc.documentUri)
    if (!doc || !isParsedLikeC4LangiumDocument(doc)) {
      continue
    }
    const node = desc.node ?? locator.getAstNode(doc.parseResult.value, desc.path)
    if (ast.isDeploymentNode(node) || ast.isDeployedInstance(node)) {
      return { doc, node }
    }
  }
  return null
}

/**
 * Finds the definition of the model or deployment relation in the project
 */
export function findRelation(
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
