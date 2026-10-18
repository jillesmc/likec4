import type * as t from '@likec4/core/types'
import { filter, isNot, omit } from 'remeda'
import { type ActorSystem, assertEvent } from 'xstate'
import { createViewChange } from '../../likec4diagram/state/createViewChange'
import type { DiagramContext } from '../../likec4diagram/state/types'
import { typedSystem } from '../../likec4diagram/state/utils'
import type { Types } from '../../likec4diagram/types'
import { machine } from './setup'
import {
  type EditorActorContext,
  type Ghost,
  type Snapshot,
  type SyncOp,
  isGhostChange,
  isModelHistoryEntry,
  isViewChange,
} from './types'

/**
 * Actually this is DiagramActorRef
 * But we can't use it here due to circular type inference
 */
const getDiagramContext = function(system: ActorSystem<any>): DiagramContext {
  return system.get('diagram')!.getSnapshot().context
}
export function makeSnapshot(system: ActorSystem<any>): Snapshot {
  const parentContext = getDiagramContext(system)
  return {
    xynodes: parentContext.xynodes.map(({ measured, data, ...n }) => (({
      ...omit(n, ['selected', 'dragging', 'resizing']),
      data: omit(data, ['dimmed', 'hovered']),
      measured,
      initialWidth: measured?.width ?? n.width ?? n.initialWidth,
      initialHeight: measured?.height ?? n.height ?? n.initialHeight,
    }) as Types.Node)),
    xyedges: parentContext.xyedges.map(({ data, ...e }) => (({
      ...omit(e, ['selected']),
      data: omit(data, ['active', 'dimmed', 'hovered']),
    }) as Types.Edge)),
    change: createViewChange(parentContext),
    view: parentContext.view,
  }
}

type LayoutChanges = t.ViewChange.ResetManualLayout | t.ViewChange.SaveViewSnapshot
export const isLayoutChange = (
  change: t.ViewChange,
): change is LayoutChanges => change.op === 'reset-manual-layout' || change.op === 'save-view-snapshot'

export const isLayoutChangeOp = <T extends SyncOp>(
  op: T,
): op is Extract<T, string | LayoutChanges> =>
  op === 'apply-latest-to-manual' || op === 'apply-semantic-layout' || op === 'sync-snapshot'
  || (isViewChange(op) && isLayoutChange(op))

export const withoutSnapshotChanges = filter<t.ViewChange[], Exclude<t.ViewChange, LayoutChanges>>(
  isNot(isLayoutChange),
)

export const scheduleSync = (delay = 50) => {
  return machine.raise({
    type: 'change.sync-snapshot',
  }, delay ? { delay, id: 'sync-snapshot' } : undefined)
}
export const cancelSync = () => {
  return machine.cancel('sync-snapshot')
}

/**
 * Save the state before editing starts
 */
export const saveBeforeEditing = () =>
  machine.assign(({ system, event }) => {
    assertEvent(event, 'edit.move.start')
    if (import.meta.env.DEV) {
      console.log('saveBeforeEditing', event)
    }
    return {
      editing: {
        subject: event.subject,
        before: makeSnapshot(system),
      },
    }
  })

/**
 * When editing finishes, push the "beforeEditing" state to the history stack
 */
export const pushHistory = () =>
  machine.enqueueActions(({ context, enqueue }) => {
    const editing = context.editing
    if (import.meta.env.DEV) {
      console.log('pushHistory', editing)
    }
    if (editing) {
      enqueue.assign({
        editing: null,
        history: {
          head: editing.before,
          tail: context.history,
        },
        redo: null,
      })
      enqueue(scheduleSync())
    }
  })

export const reschedule = (delay = 300) =>
  machine.raise(({ event }) => {
    if (import.meta.env.DEV) {
      console.log('reschedule', event)
    }
    return { ...event }
  }, { delay })

export const undo = () =>
  machine.enqueueActions(({ context: { history, redo }, system, enqueue }) => {
    if (!history) {
      return
    }

    const last = history.head
    if (isModelHistoryEntry(last)) {
      enqueue.assign({
        history: history.tail,
        redo: { head: last, tail: redo },
      })
      enqueue.raise({ type: 'change.undo-model', historyId: last.historyId })
      return
    }

    enqueue.assign({
      history: history.tail,
      redo: {
        head: makeSnapshot(system),
        tail: redo,
      },
    })
    enqueue(cancelSync())
    enqueue(scheduleSync(100))
    enqueue.sendTo(typedSystem.diagramActor, {
      type: 'update.view',
      view: last.view,
      xyedges: last.xyedges,
      xynodes: last.xynodes,
      source: 'editor',
    })
  })

export const redo = () =>
  machine.enqueueActions(({ context: { history, redo }, system, enqueue }) => {
    if (!redo) {
      return
    }

    const last = redo.head
    if (isModelHistoryEntry(last)) {
      enqueue.assign({
        history: { head: last, tail: history },
        redo: redo.tail,
      })
      enqueue.raise({ type: 'change.redo-model', historyId: last.historyId })
      return
    }

    enqueue.assign({
      history: {
        head: makeSnapshot(system),
        tail: history,
      },
      redo: redo.tail,
    })
    enqueue(cancelSync())
    enqueue(scheduleSync(100))
    enqueue.sendTo(typedSystem.diagramActor, {
      type: 'update.view',
      view: last.view,
      xyedges: last.xyedges,
      xynodes: last.xynodes,
      source: 'editor',
    })
  })

export const pushToSyncQueue = () =>
  machine.assign(({ context: { syncQueue }, event }) => {
    let nextOp: SyncOp
    switch (event.type) {
      case 'change.view':
        nextOp = event.change
        break
      case 'change.semantic-layout':
        nextOp = 'apply-semantic-layout'
        break
      case 'change.latest-to-manual':
        nextOp = 'apply-latest-to-manual'
        break
      case 'change.sync-snapshot':
        nextOp = 'sync-snapshot'
        break
      case 'change.undo-model':
        // Every undo / redo is executed, never deduplicated
        return { syncQueue: [...syncQueue, `undo-model:${event.historyId ?? ''}`] }
      case 'change.redo-model':
        return { syncQueue: [...syncQueue, `redo-model:${event.historyId ?? ''}`] }
      default:
        throw new Error(`Invalid event type: ${event.type}`)
    }

    if (syncQueue.length === 0) {
      if (import.meta.env.DEV) {
        console.log('syncQueue is empty, adding', { nextOp })
      }
      return {
        syncQueue: [nextOp],
      }
    }
    if (syncQueue.length === 1 && syncQueue[0] === nextOp) {
      if (import.meta.env.DEV) {
        console.log('syncQueue has only one item and it is the same, not changing', { nextOp })
      }
      return {}
    }

    const isNextLayoutChange = isLayoutChangeOp(nextOp)
    let pending = syncQueue.filter(existingOp => {
      if (existingOp === nextOp) {
        return false
      }
      if (isNextLayoutChange && isLayoutChangeOp(existingOp)) {
        // Keep the latest view change, drop the previous one
        return false
      }
      // Otherwise keep the operation
      return true
    })
    const newQueue = pending.length > 0 ? [...pending, nextOp] : [nextOp]
    if (import.meta.env.DEV) {
      console.log('new sync queue', { syncQueue, nextOp, newQueue })
    }
    return {
      syncQueue: newQueue,
    }
  })

/**
 * Track changes made on the canvas:
 * - changes that create new items are rendered as ghosts, until the view is synced
 * - changes that remove items from the view refresh the manual layout, once synced
 */
export const trackChange = () =>
  machine.assign(({ context: { ghosts }, event }) => {
    if (event.type !== 'change.view') {
      return {}
    }
    const { change } = event
    if (isGhostChange(change)) {
      return {
        ghosts: [...ghosts, { change, position: event.position ?? null }],
      }
    }
    if (change.op === 'exclude-from-view' || change.op === 'delete-from-model') {
      return {
        refreshManualLayout: true,
      }
    }
    return {}
  })

const isPending = (ghost: Ghost, { syncQueue, processing }: Pick<EditorActorContext, 'syncQueue' | 'processing'>) =>
  ghost.change === processing || syncQueue.includes(ghost.change)

/**
 * Keep only ghosts of changes that are still waiting to be executed.
 * If an element was created on a view with manual layout, place it where it was dropped.
 */
export const settleGhosts = () =>
  machine.enqueueActions(({ context, system, enqueue }) => {
    const settled = context.ghosts.filter(ghost => !isPending(ghost, context))
    if (settled.length > 0) {
      enqueue.assign({
        ghosts: context.ghosts.filter(ghost => isPending(ghost, context)),
      })
    }
    // Items placed on the canvas (all ghosts except relations and steps), in order
    const placements = settled.flatMap(g =>
      g.change.op !== 'add-relation' && g.change.op !== 'add-dynamic-step' && g.position
        ? [{ id: g.createdId, position: g.position }]
        : []
    )
    // New relations and steps are edges of the view, the manual layout gets them too
    const edgesAdded = settled.some(g => g.change.op === 'add-relation' || g.change.op === 'add-dynamic-step')
    if (placements.length === 0 && !edgesAdded && !context.refreshManualLayout) {
      return
    }
    enqueue.assign({ refreshManualLayout: false })
    // the diagram actor may be absent (e.g. the editor actor alone in tests)
    const diagram: { getSnapshot(): { context: DiagramContext } } | undefined = system.get('diagram')
    if (diagram?.getSnapshot().context.view._layout === 'manual') {
      enqueue.assign({ pendingPlacements: placements })
      enqueue.raise({ type: 'change.latest-to-manual' })
    }
  })

export const clearQueue = () =>
  machine.assign({
    syncQueue: [],
    processing: null,
  })
