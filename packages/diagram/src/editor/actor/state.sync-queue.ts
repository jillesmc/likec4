import { invariant, nonNullable } from '@likec4/core'
import { findLast } from 'remeda'
import { assign, enqueueActions, log, sendTo } from 'xstate'
import { typedSystem } from '../../likec4diagram/state/utils'
import {
  cancelSync,
  clearQueue,
  makeSnapshot,
  pushToSyncQueue,
  redo,
  scheduleSync,
  settleGhosts,
  trackChange,
  undo,
} from './actions'
import { machine } from './setup'
import { isViewChange, modelHistoryOp, withoutModelEntries } from './types'

const to = {
  idle: { target: '#queue-idle' },
  pending: { target: '#queue-pending' },
  suspended: { target: '#queue-suspended' },
  process: { target: '#queue-process' },
} as const

const idOf = (t: { target: string }) => ({ id: t.target.substring(1) })

/**
 * Idle state, no pending operations
 */
const idle = machine.createStateConfig({
  ...idOf(to.idle),
  always: {
    guard: 'has pending',
    ...to.pending,
  },
  on: {
    'change.sync-snapshot': {
      actions: pushToSyncQueue(),
      ...to.pending,
    },
    'change.*': {
      actions: [pushToSyncQueue(), trackChange()],
      ...to.process,
    },
    'undo': {
      actions: undo(),
    },
    'redo': {
      actions: redo(),
    },
    'cancel': {
      actions: cancelSync(),
      ...to.idle,
    },
    'view.synched': {
      actions: log('in idle got view.synched'),
    },
  },
})

/**
 * Has pending operations
 */
const pending = machine.createStateConfig({
  ...idOf(to.pending),
  on: {
    // Debounce queue events
    'change.sync-snapshot': {
      reenter: true,
      actions: pushToSyncQueue(),
      ...to.pending,
    },
    // All other changes route to process
    'change.*': {
      actions: [pushToSyncQueue(), trackChange()],
      ...to.process,
    },
    // When editing starts, we suspend the queue
    'edit.move.start': {
      ...to.suspended,
    },
    'undo': {
      reenter: true,
      actions: undo(),
      ...to.pending,
    },
    'redo': {
      reenter: true,
      actions: redo(),
      ...to.pending,
    },
    'cancel': {
      actions: clearQueue(),
      ...to.idle,
    },
    'view.synched': {
      actions: log('in pending got view.synched'),
    },
  },
  after: {
    'wait-after-edit': [
      {
        guard: 'has pending',
        ...to.process,
      },
      to.idle,
    ],
  },
})

/**
 * When editing starts, we suspend the queue
 */
const suspended = machine.createStateConfig({
  ...idOf(to.suspended),
  on: {
    // idle redirects to pending if any
    'edit.*': to.idle,
    'cancel': {
      actions: [
        clearQueue(),
        cancelSync(),
      ],
      ...to.idle,
    },
  },
})

const peekFromQueue = () =>
  machine.assign(({ system, context: { syncQueue } }) => {
    let [head, ...tail] = syncQueue
    if (head === 'sync-snapshot') {
      head = makeSnapshot(system).change
    }
    return {
      processing: head ?? null,
      syncQueue: tail,
    }
  })

const clearProcessing = () => ({
  processing: null,
})

/**
 * Processing pending operation
 */
const process = machine.createStateConfig({
  ...idOf(to.process),
  initial: 'peekFromQueue',
  tags: ['busy'],
  states: {
    peekFromQueue: {
      entry: peekFromQueue(),
      // Decide what to do next
      always: [
        {
          guard: ({ context: { processing } }) => processing === 'apply-latest-to-manual',
          target: 'applyLatestToManual',
        },
        {
          guard: ({ context: { processing } }) => processing === 'apply-semantic-layout',
          target: 'applySemanticLayout',
        },
        {
          guard: ({ context: { processing } }) => modelHistoryOp(processing) !== null,
          target: 'modelHistory',
        },
        {
          guard: ({ context: { processing } }) => isViewChange(processing),
          target: 'executeChanges',
        },
        {
          guard: 'has pending',
          reenter: true,
          ...to.process,
        },
        {
          actions: clearQueue(),
          ...to.idle,
        },
      ],
    },
    /**
     * Syncing state, some edits are not yet synced
     */
    applyLatestToManual: machine.createStateConfig({
      initial: 'call',
      entry: assign(({ system }) => ({
        processing: makeSnapshot(system).change,
      })),
      exit: assign({ pendingPlacements: [] }),
      states: {
        // Fetch latest and manual layouts
        // Apply changes, send update to diagram
        call: {
          invoke: {
            src: 'applyLatest',
            input: ({ context }) => {
              const current = context.processing
              invariant(isViewChange(current) && current.op === 'save-view-snapshot')
              return ({
                current: current.layout,
                viewId: context.viewId,
                placements: context.pendingPlacements,
              })
            },
            onDone: {
              actions: sendTo(
                typedSystem.diagramActor,
                ({ event }) => ({
                  type: 'update.view',
                  view: event.output.updated,
                }),
                { delay: 20 },
              ),
              target: 'wait',
            },
            onError: {
              actions: assign(({ event }) => {
                console.error('applyLatestToManual onError', { error: event.error })
                return {
                  processing: null,
                  syncQueue: [],
                }
              }),
              ...to.idle,
            },
          },
        },
        // Now we wait 500ms, take new snapshot and send sync
        wait: {
          on: {
            // Ignore all events during window to prevent
            // race conditions between view updates and sync operations
            '*': {
              actions: log(({ event }) => `wait: ignoring event ${event.type}`),
            },
          },
          after: {
            '500ms': {
              actions: [
                clearQueue(),
                // a refresh after undo / redo of a model change is not a new change
                assign(({ context }) => ({ redo: context.keepRedo ? context.redo : null, keepRedo: false })),
                scheduleSync(),
              ],
              ...to.idle,
            },
          },
        },
      },
    }),
    /**
     * User requested semantic layout, we will call the AI
     */
    applySemanticLayout: machine.createStateConfig({
      tags: ['ai-semantic-layout'],
      invoke: {
        src: 'applySemanticLayout',
        input: ({ context }) => ({
          viewId: context.viewId,
        }),
        onDone: {
          target: 'decideNext',
        },
        onError: {
          actions: ({ event }) => {
            console.error('applySemanticLayout onError', { error: event.error })
          },
          target: 'failure',
        },
      },
    }),
    /**
     * Calls `executeChange` to save the snapshot
     */
    executeChanges: machine.createStateConfig({
      invoke: {
        src: 'executeChange',
        input: ({ context: { processing, syncQueue, viewId } }) => {
          // processing must be defined
          invariant(processing && isViewChange(processing))
          return ({
            changes: [
              processing,
              ...syncQueue.filter(isViewChange),
            ],
            viewId,
          })
        },
        onDone: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            if (import.meta.env.DEV) {
              console.log('executeChanges onDone', { event })
            }
            const requested = event.output.requested
            enqueue.assign({
              processing: null,
              syncQueue: context.syncQueue.filter(change => !isViewChange(change) || !requested.includes(change)),
            })
            // Applied model changes can be undone through the editor port
            let history = context.history
            for (const historyId of event.output.undoable) {
              history = { head: { kind: 'model', historyId }, tail: history }
            }
            if (history !== context.history) {
              enqueue.assign({ history, redo: null })
            }
            // Remember created items, to keep them where they were dropped
            const created = event.output.created
            if (created.length > 0) {
              enqueue.assign({
                ghosts: context.ghosts.map(ghost => {
                  const createdId = created.find(c => c.change === ghost.change)?.id
                  return createdId ? { ...ghost, createdId } : ghost
                }),
              })
            }
            const failed = event.output.failed
            if (failed.length > 0) {
              const failedChanges = failed.map(f => f.change)
              enqueue.assign({
                ghosts: context.ghosts.filter(ghost => !failedChanges.includes(ghost.change)),
                lastError: failed.map(f => f.error).join('\n'),
              })
            }

            const lastSyncSnapshot = findLast(
              event.output.applied,
              c => c.op === 'save-view-snapshot',
            )
            if (lastSyncSnapshot) {
              enqueue.sendTo(
                typedSystem.diagramActor,
                {
                  type: 'update.view-bounds',
                  bounds: lastSyncSnapshot.layout.bounds,
                },
              )
            }
            // The view was renamed: show it under its new id, the old one will not be synced
            const renamedView = event.output.renamedView
            if (renamedView) {
              enqueue.sendTo(typedSystem.diagramActor, { type: 'navigate.to', viewId: renamedView })
              enqueue.raise({ type: 'view.synched' })
            } else if (!event.output.waitForViewSync) {
              enqueue.raise({ type: 'view.synched' })
            }
          }),
          target: 'waitViewSynced',
        },
        onError: {
          actions: ({ event }) => {
            console.error('executeChanges onError', { error: event.error })
          },
          target: 'failure',
        },
      },
    }),

    /**
     * Undo / redo a model change through the editor port
     */
    modelHistory: machine.createStateConfig({
      invoke: {
        src: 'modelHistory',
        input: ({ context: { processing, viewId } }) => ({
          viewId,
          ...nonNullable(modelHistoryOp(processing), 'processing must be a model history op'),
        }),
        onDone: {
          // The manual layout is refreshed once the view is synced (items may appear or disappear)
          actions: assign({ refreshManualLayout: true, keepRedo: true }),
          target: 'waitViewSynced',
        },
        onError: {
          // The model history is not available anymore (e.g. file changed since the edit)
          actions: assign(({ context, event }) => ({
            lastError: event.error instanceof Error ? event.error.message : String(event.error),
            history: withoutModelEntries(context.history),
            redo: withoutModelEntries(context.redo),
          })),
          target: 'failure',
        },
      },
    }),

    // This state blocks further changes until the view is fully synced
    waitViewSynced: {
      on: {
        'view.synched': {
          target: 'decideNext',
        },
      },
      after: {
        // Fallback: if view.synched doesn't come, proceed after 2 second
        2000: 'decideNext',
      },
    },

    decideNext: {
      entry: [assign(clearProcessing), settleGhosts()],
      always: [
        // If there are pending operations, enter the process state
        {
          guard: 'has pending',
          reenter: true,
          ...to.process,
        },
        // Otherwise, stay idle
        to.idle,
      ],
    },

    failure: {
      always: {
        actions: [clearQueue(), settleGhosts()],
        ...to.idle,
      },
    },
  },
  on: {
    // Queue view changes while processing, they are executed next
    'change.view': {
      actions: [pushToSyncQueue(), trackChange()],
    },
    // Undo / redo of model changes are queued as well (layout undo waits for idle)
    'undo': {
      guard: 'next undo is model change',
      actions: undo(),
    },
    'redo': {
      guard: 'next redo is model change',
      actions: redo(),
    },
    'change.undo-model': {
      actions: pushToSyncQueue(),
    },
    'change.redo-model': {
      actions: pushToSyncQueue(),
    },
    // 'change.*': {
    //   actions: log(({ event }) => `ignore ${event.type} in process state`),
    // },
    // 'undo': {
    //   actions: log('ignore undo in process state'),
    // },
    // 'view.synched': {
    //   actions: log('im in process and got view.synched'),
    // },
  },
})

export const syncQueue = machine.createStateConfig({
  initial: 'idle',
  states: {
    idle,
    pending,
    suspended,
    process,
  },
  on: {
    'error.dismiss': {
      actions: assign({ lastError: null }),
    },
    'error.show': {
      actions: assign(({ event }) => ({ lastError: event.message })),
    },
  },
})
