import { type FqnRenames, type ProjectId, renameFqn } from '@likec4/core'
import { AstUtils, isReference } from 'langium'
import { ast } from '../ast'
import type { LikeC4Services } from '../module'
import { projectIdFrom } from '../utils'

/**
 * Resolved references to elements and deployment items: `kind|project|target fqn` → where the references are
 * (`file:line`). The project of the target is part of the key: projects may have the same local FQNs.
 * Documents are not: a move takes references along to another file.
 */
export type ResolvedReferences = Map<string, string[]>

const ELEMENT = 'element'
const DEPLOYMENT = 'deployment'

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
          // only the item the whole reference `a.b.c` points to: inner segments are the path to it
          if (
            (ast.isFqnRef(reference.container) || ast.isStrictFqnElementRef(reference.container))
            && reference.container.$containerProperty === 'parent'
          ) {
            continue
          }
          const target = reference.reference.ref
          let id: string
          switch (true) {
            case ast.isElement(target):
              id = `${ELEMENT}|${projectIdFrom(target)}|${services.likec4.FqnIndex.getFqn(target)}`
              break
            case ast.isDeploymentNode(target) || ast.isDeployedInstance(target):
              id = `${DEPLOYMENT}|${projectIdFrom(target)}|${services.likec4.DeploymentsIndex.getFqn(target)}`
              break
            default:
              continue
          }
          const line = (reference.reference.$refNode?.range.start.line ?? 0) + 1
          const location = `${doc.uri.path.slice(doc.uri.path.lastIndexOf('/') + 1)}:${line}`
          const locations = result.get(id)
          if (locations) {
            locations.push(location)
          } else {
            result.set(id, [location])
          }
        }
      }
    }
  }
  return result
}

/**
 * The references from `before` that no longer resolve to the same item `after` the change
 * (under the renames of items of `projectId`), as `file:line`; null when every reference still resolves the same way.
 */
export function brokenReference(
  before: ResolvedReferences,
  after: ResolvedReferences,
  renames: FqnRenames,
  projectId: ProjectId,
): string | null {
  const expected: ResolvedReferences = new Map()
  for (const [key, locations] of before) {
    const [kind, project, fqn] = key.split('|') as [string, string, string]
    let mapped = fqn
    switch (true) {
      case project !== projectId:
        break
      case kind === ELEMENT:
        mapped = renameFqn(renames.elements, fqn)
        break
      case kind === DEPLOYMENT:
        mapped = renameFqn(renames.deployments, fqn)
        break
    }
    const mappedKey = `${kind}|${project}|${mapped}`
    expected.set(mappedKey, [...expected.get(mappedKey) ?? [], ...locations])
  }
  // Every reference that existed still points to its item; the change may add references (e.g. an `include`).
  // ponytail: counts per item, a capture balanced by an added reference to the same item is not seen
  for (const [key, was] of expected) {
    const now = after.get(key) ?? []
    if (now.length < was.length) {
      return was.find(l => !now.includes(l)) ?? was[0] ?? key
    }
  }
  return null
}
