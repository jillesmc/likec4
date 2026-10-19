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
  // Undo / redo of a model change (raised by undo / redo)
  | { type: 'change.undo-model'; historyId?: string | undefined }
  | { type: 'change.redo-model'; historyId?: string | undefined }
  // Show an error to the user
  | { type: 'error.show'; message: string }
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

/**
 * Model change in the history, reverted / re-applied by the editor port
 */
export type ModelHistoryEntry = {
  kind: 'model'
  /**
   * Id of the change in the host history
   */
  historyId?: string | undefined
}

export type HistoryEntry = Snapshot | ModelHistoryEntry

export const isModelHistoryEntry = (entry: HistoryEntry): entry is ModelHistoryEntry => 'kind' in entry

export type LinkedSnapshot = {
  head: HistoryEntry
  tail: LinkedSnapshot | null
}

/**
 * Removes model entries from the history (e.g. when the model history is not available anymore)
 */
export function withoutModelEntries(list: LinkedSnapshot | null): LinkedSnapshot | null {
  if (!list) {
    return null
  }
  const tail = withoutModelEntries(list.tail)
  return isModelHistoryEntry(list.head) ? tail : { head: list.head, tail }
}

/**
 * Changes that modify the sources and can be undone through the editor port
 */
export const isModelChange = (change: t.ViewChange): boolean =>
  change.op === 'add-relation'
  || change.op === 'add-element'
  || change.op === 'change-title'
  || change.op === 'exclude-from-view'
  || change.op === 'delete-from-model'
  || change.op === 'add-deployment-node'
  || change.op === 'add-instance'
  || change.op === 'add-dynamic-step'
  || change.op === 'remove-dynamic-step'

export interface EditorActorInput {
  viewId: t.ViewId
}

export type SyncOp =
  | t.ViewChange
  | 'sync-snapshot'
  | 'apply-semantic-layout'
  | 'apply-latest-to-manual'
  | `undo-model:${string}`
  | `redo-model:${string}`

export const isViewChange = (change: SyncOp | null): change is t.ViewChange =>
  change !== null && typeof change !== 'string'

/**
 * Changes rendered as pending items (ghosts) until the view is synced
 */
export type GhostChange =
  | t.ViewChange.AddRelation
  | t.ViewChange.AddElement
  | t.ViewChange.AddDeploymentNode
  | t.ViewChange.AddInstance
  | t.ViewChange.AddDynamicStep

export const isGhostChange = (change: t.ViewChange): change is GhostChange =>
  change.op === 'add-relation'
  || change.op === 'add-element'
  || change.op === 'add-deployment-node'
  || change.op === 'add-instance'
  || change.op === 'add-dynamic-step'

/**
 * Where an item created on the canvas was dropped (center, flow coordinates)
 */
export type Placement = {
  id?: string | undefined
  position: XYPoint
}

/**
 * Model undo / redo queued for execution
 */
export const modelHistoryOp = (op: SyncOp | null): { direction: 'undo' | 'redo'; historyId?: string } | null => {
  if (typeof op !== 'string') {
    return null
  }
  const [kind, historyId] = op.split(':', 2) as [string, string | undefined]
  if (kind !== 'undo-model' && kind !== 'redo-model') {
    return null
  }
  return { direction: kind === 'undo-model' ? 'undo' : 'redo', ...historyId && { historyId } }
}

export interface Ghost {
  change: GhostChange
  /**
   * Fqn of the created item, once the change is executed
   */
  createdId?: string | undefined
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
  pendingPlacements: Placement[]

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
