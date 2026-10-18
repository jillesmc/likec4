import type { LikeC4Model } from '@likec4/core/model'
import type { DeploymentFqn, Fqn } from '@likec4/core/types'
import { isValidIdentifier } from '@likec4/core/utils'

export const INVALID_IDENTIFIER = 'Invalid identifier'
export const IDENTIFIER_TAKEN = 'Already used by a sibling'

/**
 * Where a new item is created, to find the names taken by its siblings
 */
export type IdentifierScope =
  | { model: 'element'; parent: Fqn | null }
  | { model: 'deployment'; parent: DeploymentFqn | null }

/**
 * Names taken by the children of the parent (or by the roots)
 */
export function takenNames(model: LikeC4Model, scope: IdentifierScope): Set<string> {
  let siblings: Iterable<{ name: string }>
  switch (true) {
    case scope.model === 'element' && scope.parent !== null:
      siblings = model.findElement(scope.parent)?.children() ?? []
      break
    case scope.model === 'element':
      siblings = model.roots()
      break
    case scope.parent !== null: {
      const parent = model.deployment.findElement(scope.parent)
      siblings = parent?.isDeploymentNode() ? parent.children() : []
      break
    }
    default:
      siblings = model.deployment.roots()
  }
  return new Set([...siblings].map(s => s.name))
}

/**
 * Identifier shown in the prompt: typed by the user, or the suggestion while nothing is typed
 */
export function shownIdentifier(typed: string, suggestion: string): string {
  return typed.trim() || suggestion
}

/**
 * Why the identifier can't be used, null when it can
 */
export function identifierError(name: string, taken: ReadonlySet<string>): string | null {
  switch (true) {
    case !isValidIdentifier(name):
      return INVALID_IDENTIFIER
    case taken.has(name):
      return IDENTIFIER_TAKEN
    default:
      return null
  }
}
