import { type ProjectId, Fqn, splitGlobalFqn } from '@likec4/core'
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
