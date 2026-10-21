import { type ProjectId, type ViewChange, DeploymentFqn, Fqn, parentFqn } from '@likec4/core'
import type { LikeC4Model } from '@likec4/core/model'
import type { UnknownParsed } from '@likec4/core/types'
import { isValidIdentifier } from '@likec4/core/utils'
import type { LikeC4Services } from '../module'
import type { ModelChangePlan } from './_anchors'
import { findDeploymentDefinition, findElementDefinition } from './_lookup'
import { type RenamePlan, planDeploymentRename, planElementRename } from './_references'
import { ModelChangeError } from './ModelChangeError'

export interface RenameElementArg {
  projectId: ProjectId
  model: LikeC4Model<UnknownParsed>
  change: ViewChange.RenameElement
}

/**
 * Plans the rename of the identifier of an element, a deployment node or a deployed instance,
 * with every reference in the workspace. The same name is a no-op (no edits).
 */
export function renameElement(
  services: LikeC4Services,
  { projectId, model, change }: RenameElementArg,
): ModelChangePlan {
  const { target, name } = change
  let fqn: string
  let current: string
  let plan: () => RenamePlan
  let taken: (newFqn: string) => boolean
  if ('element' in target) {
    fqn = Fqn(target.element)
    const definition = findElementDefinition(services, projectId, Fqn(fqn))
    if (!definition) {
      if (model.findElement(fqn)) {
        throw new ModelChangeError('read-only-target', `${fqn} is defined in another project`)
      }
      throw new ModelChangeError('not-found', `${fqn} not found`)
    }
    current = definition.node.name
    plan = () => planElementRename(services, definition.node, name)
    taken = newFqn => !!services.likec4.FqnIndex.byFqn(projectId, Fqn(newFqn)).head()
  } else {
    fqn = DeploymentFqn(target.deployment)
    const definition = findDeploymentDefinition(services, projectId, Fqn(fqn))
    if (!definition) {
      throw new ModelChangeError('not-found', `${fqn} not found`)
    }
    current = services.references.NameProvider.getNameStrict(definition.node)
    plan = () => planDeploymentRename(services, definition.node, name)
    taken = newFqn => !!services.likec4.DeploymentsIndex.byFqn(projectId, Fqn(newFqn)).head()
  }
  if (!isValidIdentifier(name)) {
    throw new ModelChangeError('invalid-name', `${name} is not a valid identifier`)
  }
  const planned = plan()
  if (current === name) {
    return { edits: new Map(), modifiedRange: planned.nameRange }
  }
  const parent = parentFqn(fqn)
  if (taken(parent ? `${parent}.${name}` : name)) {
    throw new ModelChangeError('name-collision', `${parent ?? 'Top level'} already has ${name}`)
  }
  return {
    edits: planned.edits,
    modifiedRange: planned.nameRange,
    renames: planned.renames,
  }
}
