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
}

export type ViewChange =
  | ViewChange.ChangeElementStyle
  | ViewChange.SaveViewSnapshot
  | ViewChange.ResetManualLayout
  | ViewChange.ChangeAutoLayout
  | ViewChange.ChangeProperty
  | ViewChange.AddRelation

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
