import { type FqnRenames, type ProjectId, renameFqn } from '@likec4/core'
import { AstUtils, isReference } from 'langium'
import { ast } from '../ast'
import type { LikeC4Services } from '../module'

/**
 * Resolved references to elements and deployment items:
 * `document uri|target` → lines of the references (0-based)
 */
export type ResolvedReferences = Map<string, number[]>

const ELEMENT = 'element:'
const DEPLOYMENT = 'deployment:'

/**
 * Where every reference of the projects points to (ADR-001)
 */
export function resolvedReferences(services: LikeC4Services, projects: Iterable<ProjectId>): ResolvedReferences {
  const documents = services.shared.workspace.LangiumDocuments
  const result: ResolvedReferences = new Map()
  for (const projectId of projects) {
    for (const doc of documents.projectDocuments(projectId)) {
      for (const node of AstUtils.streamAst(doc.parseResult.value)) {
        for (const reference of AstUtils.streamReferences(node)) {
          if (!isReference(reference.reference)) {
            continue
          }
          const target = reference.reference.ref
          let id: string
          switch (true) {
            case ast.isElement(target):
              id = ELEMENT + services.likec4.FqnIndex.getFqn(target)
              break
            case ast.isDeploymentNode(target) || ast.isDeployedInstance(target):
              id = DEPLOYMENT + services.likec4.DeploymentsIndex.getFqn(target)
              break
            default:
              continue
          }
          const key = `${doc.uri.toString()}|${id}`
          const line = reference.reference.$refNode?.range.start.line ?? 0
          const lines = result.get(key)
          if (lines) {
            lines.push(line)
          } else {
            result.set(key, [line])
          }
        }
      }
    }
  }
  return result
}

/**
 * The references from `before` that do not resolve to the same item `after` the change
 * (under the renames), as `file:line`; null when every reference still resolves the same way.
 */
export function brokenReference(
  before: ResolvedReferences,
  after: ResolvedReferences,
  renames: FqnRenames,
): string | null {
  const expected: ResolvedReferences = new Map()
  for (const [key, lines] of before) {
    const [uri, id] = key.split('|') as [string, string]
    let mapped = id
    switch (true) {
      case id.startsWith(ELEMENT):
        mapped = ELEMENT + renameFqn(renames.elements, id.slice(ELEMENT.length))
        break
      case id.startsWith(DEPLOYMENT):
        mapped = DEPLOYMENT + renameFqn(renames.deployments, id.slice(DEPLOYMENT.length))
        break
    }
    expected.set(`${uri}|${mapped}`, lines)
  }
  for (const key of new Set([...expected.keys(), ...after.keys()])) {
    const was = expected.get(key) ?? []
    const now = after.get(key) ?? []
    if (was.length !== now.length) {
      const uri = key.slice(0, key.indexOf('|'))
      const lines = now.length > was.length ? now.filter(l => !was.includes(l)) : was.filter(l => !now.includes(l))
      const line = (lines[0] ?? now[0] ?? was[0] ?? 0) + 1
      return `${uri.slice(uri.lastIndexOf('/') + 1)}:${line}`
    }
  }
  return null
}
