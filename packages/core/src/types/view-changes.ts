import type { NonEmptyArray } from './_common'
import type * as scalar from './scalar'
import type { BorderStyle, ElementShape, ThemeColor } from './styles'
import type { LayoutedView } from './view'
import type { AutoLayoutDirection } from './view-common'

export namespace ViewChange {
  export interface ChangeElementStyle {
    op: 'change-element-style'
    style: {
      border?: BorderStyle
      opacity?: number
      shape?: ElementShape
      color?: ThemeColor
    }
    targets: NonEmptyArray<scalar.Fqn | scalar.DeploymentFqn>
  }

  export interface SaveViewSnapshot {
    op: 'save-view-snapshot'
    layout: LayoutedView
  }

  export interface ResetManualLayout {
    op: 'reset-manual-layout'
  }

  export interface ChangeAutoLayout {
    op: 'change-autolayout'
    layout: {
      direction: AutoLayoutDirection
      nodeSep?: number | null
      rankSep?: number | null
    }
  }

  export interface ChangeProperty {
    op: 'change-property'
    /**
     * Change title
     */
    title?: string
    /**
     * Change description
     */
    description?: scalar.MarkdownOrString
    /**
     * Replace tags
     */
    tags?: scalar.Tag[]
  }

  /**
   * Add a model relation `source -> target`.
   * Written inside the source element's definition block.
   */
  export interface AddRelation {
    op: 'add-relation'
    source: scalar.Fqn
    target: scalar.Fqn
    title?: string
    /**
     * Relationship kind, declared in the specification (`-[kind]->`)
     */
    kind?: scalar.RelationshipKind
    /**
     * Written as a `technology` property in the relation body
     */
    technology?: string
  }

  /**
   * Add a model element.
   * Written inside the parent's definition block, or in the `model {}` of the view file when there is no parent.
   */
  export interface AddElement {
    op: 'add-element'
    parent: scalar.Fqn | null
    kind: scalar.ElementKind
    title: string
    /**
     * Identifier of the element, derived from the title when omitted
     */
    name?: string
  }

  /**
   * Change the title of an element, deployment node, deployed instance or relation
   * (in the model, not only in the view).
   * An empty title removes the title of a relation.
   */
  export interface ChangeTitle {
    op: 'change-title'
    target: scalar.Fqn | scalar.DeploymentFqn | { relation: scalar.RelationId }
    title: string
  }

  /**
   * Add a deployment node.
   * Written inside the parent node's block, or in the `deployment {}` of the view file when there is no parent.
   */
  export interface AddDeploymentNode {
    op: 'add-deployment-node'
    parent: scalar.DeploymentFqn | null
    kind: scalar.DeploymentKind
    title: string
    /**
     * Identifier of the node, derived from the title when omitted
     */
    name?: string
  }

  /**
   * Deploy a model element as `instanceOf` inside a deployment node
   */
  export interface AddInstance {
    op: 'add-instance'
    parent: scalar.DeploymentFqn
    element: scalar.Fqn
    /**
     * Identifier of the instance, defaults to the element name (made unique when taken)
     */
    name?: string
  }

  /**
   * Add a step `source -> target` at the end of the top-level steps of a dynamic view,
   * or before the top-level statement that contains the step `beforeStep`
   */
  export interface AddDynamicStep {
    op: 'add-dynamic-step'
    source: scalar.Fqn
    target: scalar.Fqn
    title?: string
    /**
     * Id of the step to insert before (its top-level statement); at the end when omitted or not found
     */
    beforeStep?: scalar.StepPath
  }

  /**
   * Remove a step from a dynamic view (steps of a chain `a -> b -> c` are refused)
   */
  export interface RemoveDynamicStep {
    op: 'remove-dynamic-step'
    step: scalar.StepPath
  }

  export type ExcludeTarget =
    | { node: scalar.Fqn | scalar.DeploymentFqn }
    | { edge: { source: scalar.Fqn | scalar.DeploymentFqn; target: scalar.Fqn | scalar.DeploymentFqn } }

  /**
   * Hide items from this view only, with `exclude` rules (the model is not changed)
   */
  export interface ExcludeFromView {
    op: 'exclude-from-view'
    targets: NonEmptyArray<ExcludeTarget>
  }

  /**
   * Remove a definition from the model.
   * Rejected while the element or deployment node is referenced.
   */
  export interface DeleteFromModel {
    op: 'delete-from-model'
    target:
      | { element: scalar.Fqn }
      | { deploymentNode: scalar.DeploymentFqn }
      | { relation: scalar.RelationId }
  }

  /**
   * Rename the identifier of an element: its definition and every reference in the workspace.
   * Manual layouts follow the new name.
   */
  export interface RenameElement {
    op: 'rename-element'
    target: { element: scalar.Fqn }
    name: string
  }
}

export type ViewChange =
  | ViewChange.ChangeElementStyle
  | ViewChange.SaveViewSnapshot
  | ViewChange.ResetManualLayout
  | ViewChange.ChangeAutoLayout
  | ViewChange.ChangeProperty
  | ViewChange.AddRelation
  | ViewChange.AddElement
  | ViewChange.ChangeTitle
  | ViewChange.ExcludeFromView
  | ViewChange.DeleteFromModel
  | ViewChange.AddDeploymentNode
  | ViewChange.AddInstance
  | ViewChange.AddDynamicStep
  | ViewChange.RemoveDynamicStep
  | ViewChange.RenameElement

/**
 * Deterministic error codes returned when a {@link ViewChange} is rejected
 */
export type ViewChangeErrorCode =
  | 'not-found'
  | 'invalid-name'
  | 'name-collision'
  | 'unknown-kind'
  | 'read-only-target'
  | 'has-references'
  | 'unsupported-in-view'
  | 'invalid-result'
  | 'apply-failed'
  | 'stale-undo'
  | 'invalid-parent'
