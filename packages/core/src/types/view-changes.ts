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
   * Change the title of an element, deployment node or deployed instance (in the model, not only in the view)
   */
  export interface ChangeTitle {
    op: 'change-title'
    target: scalar.Fqn | scalar.DeploymentFqn
    title: string
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
