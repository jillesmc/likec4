import type { XYPoint } from '@likec4/core/geometry'
import type * as t from '@likec4/core/types'
import type { Types } from '../../likec4diagram/types'
import type { HotKeyEvent } from './hotkey'

export type EditorActorEvent =
  // Add change to queue
  // `position` - where the gesture happened (flow coordinates), used to render ghosts
  | { type: 'change.view'; change: t.ViewChange; position?: XYPoint | undefined }
  | { type: 'change.semantic-layout' }
  | { type: 'change.latest-to-manual' }
  | { type: 'change.sync-snapshot' }
  // view update has been received, consider synced
  | { type: 'view.synched' }
  | { type: 'cancel' }
  // Dismiss the last error
  | { type: 'error.dismiss' }
  // Edit events
  | { type: 'edit.move.start'; subject: 'node' | 'edge' }
  | { type: 'edit.move.end' }
  | { type: 'edit.move.cancel' } // Cancel current editing
  | HotKeyEvent

export type Snapshot = {
  view: t.LayoutedView
  change: t.ViewChange.SaveViewSnapshot
  xynodes: Types.Node[]
  xyedges: Types.Edge[]
}

export type LinkedSnapshot = {
  head: Snapshot
  tail: LinkedSnapshot | null
}

export interface EditorActorInput {
  viewId: t.ViewId
}

export type SyncOp =
  | t.ViewChange
  | 'sync-snapshot'
  | 'apply-semantic-layout'
  | 'apply-latest-to-manual'

export const isViewChange = (change: SyncOp | null): change is t.ViewChange =>
  change !== null && typeof change !== 'string'

/**
 * Changes rendered as pending items (ghosts) until the view is synced
 */
export type GhostChange = t.ViewChange.AddRelation | t.ViewChange.AddElement

export const isGhostChange = (change: t.ViewChange): change is GhostChange =>
  change.op === 'add-relation' || change.op === 'add-element'

export interface Ghost {
  change: GhostChange
  /**
   * Where the item was created (flow coordinates), if known
   */
  position: XYPoint | null
}

export interface EditorActorContext {
  viewId: t.ViewId

  // Undo history
  history: LinkedSnapshot | null

  // Redo history
  redo: LinkedSnapshot | null

  editing: null | {
    /**
     * The subject of the edit
     */
    subject: 'node' | 'edge'
    /**
     * The state before editing started
     */
    before: Snapshot
  }

  syncQueue: Array<SyncOp>
  processing: Exclude<SyncOp, 'sync-snapshot'> | null

  /**
   * Changes not yet visible in the view (rendered as ghosts)
   */
  ghosts: Ghost[]

  /**
   * Position for the element created on the canvas, applied to the manual layout once the view is synced
   */
  pendingPlacement: XYPoint | null

  /**
   * Items were removed from the view, refresh the manual layout once the view is synced
   */
  refreshManualLayout: boolean

  /**
   * Error of the last rejected change, shown to the user until dismissed
   */
  lastError: string | null
}

export type EditorActorEmitedEvent = { type: 'idle' }

export type EditorActorStateTag = 'pending' | 'busy' | 'ai-semantic-layout'
