import { type ProjectId, type ViewChange, Fqn, parentFqn } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { isValidIdentifier } from '@likec4/core/utils'
import type { LikeC4Services } from '../module'
import type { ModelChangePlan } from './_anchors'
import { findElementDefinition } from './_lookup'
import { planElementRename } from './_references'
import { ModelChangeError } from './ModelChangeError'

export interface RenameElementArg {
  projectId: ProjectId
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.RenameElement
}

/**
 * Plans the rename of an element's identifier, with every reference in the workspace.
 * The same name is a no-op (no edits).
 */
export function renameElement(
  services: LikeC4Services,
  { projectId, model, change }: RenameElementArg,
): ModelChangePlan {
  const fqn = Fqn(change.target.element)
  const { name } = change
  const definition = findElementDefinition(services, projectId, fqn)
  if (!definition) {
    if (model.findElement(fqn)) {
      throw new ModelChangeError('read-only-target', `${fqn} is defined in another project`)
    }
    throw new ModelChangeError('not-found', `${fqn} not found`)
  }
  if (!isValidIdentifier(name)) {
    throw new ModelChangeError('invalid-name', `${name} is not a valid identifier`)
  }
  const plan = planElementRename(services, definition.node, name)
  if (definition.node.name === name) {
    return { edits: new Map(), modifiedRange: plan.nameRange }
  }
  const parent = parentFqn(fqn)
  if (services.likec4.FqnIndex.byFqn(projectId, Fqn(parent ? `${parent}.${name}` : name)).head()) {
    throw new ModelChangeError('name-collision', `${parent ?? 'Top level'} already has ${name}`)
  }
  return {
    edits: plan.edits,
    modifiedRange: plan.nameRange,
    renames: plan.renames,
  }
}
