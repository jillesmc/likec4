import { type ViewChange, scalar } from '@likec4/core/types'
import { describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import { shouldWaitForViewSync } from '../LikeC4EditorCallbacks'
import { editorActorLogic } from './machine'
import type { EditorCalls } from './setup'

const change = {
  op: 'change-autolayout' as const,
  layout: {
    direction: 'LR' as const,
  },
}

function createTestActor(
  executeChange: EditorCalls.ExecuteChange,
  modelHistory: EditorCalls.ModelHistory = async () => ({}),
) {
  const actor = createActor(
    editorActorLogic.provide({
      actors: {
        executeChange: fromPromise(executeChange),
        modelHistory: fromPromise(modelHistory),
      },
    }),
    {
      input: {
        viewId: scalar.ViewId('test'),
      },
    },
  )
  actor.start()
  return actor
}

describe('editor sync queue', () => {
  it('preserves synchronization unless a callback explicitly opts out', () => {
    expect(shouldWaitForViewSync()).toBe(true)
    expect(shouldWaitForViewSync({ waitForViewSync: true })).toBe(true)
    expect(shouldWaitForViewSync({ waitForViewSync: false })).toBe(false)
  })

  it('returns to idle without waiting when the callback does not publish a refreshed view', async () => {
    const executeChange = vi.fn<EditorCalls.ExecuteChange>(async ({ input }) => ({
      requested: input.changes,
      applied: input.changes,
      failed: [],
      undoable: 0,
      waitForViewSync: false,
    }))
    const actor = createTestActor(executeChange)

    actor.send({ type: 'change.view', change })

    await waitFor(
      actor,
      snapshot => executeChange.mock.calls.length === 1 && !snapshot.hasTag('busy'),
      { timeout: 500 },
    )
    expect(actor.getSnapshot().matches({ syncQueue: 'idle' })).toBe(true)
    actor.stop()
  })

  it('waits until the refreshed view arrives when synchronization is expected', async () => {
    const executeChange = vi.fn<EditorCalls.ExecuteChange>(async ({ input }) => ({
      requested: input.changes,
      applied: input.changes,
      failed: [],
      undoable: 0,
      waitForViewSync: true,
    }))
    const actor = createTestActor(executeChange)

    actor.send({ type: 'change.view', change })

    await waitFor(
      actor,
      snapshot =>
        (snapshot.value as unknown as { syncQueue: { process: string } }).syncQueue.process === 'waitViewSynced',
      { timeout: 500 },
    )
    expect(actor.getSnapshot().hasTag('busy')).toBe(true)

    actor.send({ type: 'view.synched' })
    await waitFor(actor, snapshot => !snapshot.hasTag('busy'), { timeout: 500 })
    expect(actor.getSnapshot().matches({ syncQueue: 'idle' })).toBe(true)
    actor.stop()
  })

  describe('relations created on canvas', () => {
    const relation = (source: string, target: string): ViewChange.AddRelation => ({
      op: 'add-relation',
      source: scalar.Fqn(source),
      target: scalar.Fqn(target),
    })

    it('UT-061: executes two connects in order, without deduplication', async () => {
      const executed = [] as ViewChange[]
      let release!: () => void
      const firstCall = new Promise<void>(resolve => (release = resolve))
      const executeChange = vi.fn<EditorCalls.ExecuteChange>(async ({ input }) => {
        // hold the first execution, so the second connect arrives while processing
        if (executed.length === 0) {
          await firstCall
        }
        executed.push(...input.changes)
        return { requested: input.changes, applied: input.changes, failed: [], undoable: 0, waitForViewSync: false }
      })
      const actor = createTestActor(executeChange)
      const first = relation('a', 'b')
      const second = relation('a', 'c')

      actor.send({ type: 'change.view', change: first })
      await waitFor(actor, () => executeChange.mock.calls.length === 1, { timeout: 500 })
      actor.send({ type: 'change.view', change: second })
      release()

      await waitFor(actor, () => executed.length === 2, { timeout: 1000 })
      expect(executed).toEqual([first, second])
      actor.stop()
    })

    it('UT-065: keeps the ghost until the view is synced', async () => {
      const executeChange = vi.fn<EditorCalls.ExecuteChange>(async ({ input }) => ({
        requested: input.changes,
        applied: input.changes,
        failed: [],
        undoable: 0,
        waitForViewSync: true,
      }))
      const actor = createTestActor(executeChange)
      const change = relation('a', 'b')

      actor.send({ type: 'change.view', change })
      expect(actor.getSnapshot().context.ghosts).toEqual([{ change, position: null }])

      await waitFor(
        actor,
        snapshot =>
          (snapshot.value as unknown as { syncQueue: { process: string } }).syncQueue.process === 'waitViewSynced',
        { timeout: 500 },
      )
      expect(actor.getSnapshot().context.ghosts).toEqual([{ change, position: null }])

      actor.send({ type: 'view.synched' })
      await waitFor(actor, snapshot => !snapshot.hasTag('busy'), { timeout: 500 })
      expect(actor.getSnapshot().context.ghosts).toEqual([])
      actor.stop()
    })

    it('UT-066: removes the ghost and keeps the error when the change is rejected', async () => {
      const executeChange = vi.fn<EditorCalls.ExecuteChange>(async ({ input }) => ({
        requested: input.changes,
        applied: [],
        failed: input.changes.map(change => ({ change, error: '[not-found] Element "b" not found' })),
        undoable: 0,
        waitForViewSync: false,
      }))
      const actor = createTestActor(executeChange)

      actor.send({ type: 'change.view', change: relation('a', 'b') })
      await waitFor(actor, snapshot => !snapshot.hasTag('busy') && executeChange.mock.calls.length === 1, {
        timeout: 500,
      })
      expect(actor.getSnapshot().context.ghosts).toEqual([])
      expect(actor.getSnapshot().context.lastError).toBe('[not-found] Element "b" not found')

      actor.send({ type: 'error.dismiss' })
      expect(actor.getSnapshot().context.lastError).toBeNull()
      actor.stop()
    })
  })

  describe('model change history', () => {
    const change: ViewChange.ChangeTitle = { op: 'change-title', target: scalar.Fqn('a'), title: 'A' }
    const executeUndoable = vi.fn<EditorCalls.ExecuteChange>(async ({ input }) => ({
      requested: input.changes,
      applied: input.changes,
      failed: [],
      undoable: input.changes.length,
      waitForViewSync: false,
    }))
    const idle = (snapshot: { hasTag: (tag: 'busy') => boolean }) => !snapshot.hasTag('busy')

    it('UT-130 (canvas): applied model changes join the history, undo and redo call the port', async () => {
      const directions = [] as string[]
      const actor = createTestActor(executeUndoable, async ({ input }) => {
        directions.push(input.direction)
        return {}
      })
      actor.send({ type: 'change.view', change })
      await waitFor(actor, s => idle(s) && s.context.history !== null, { timeout: 500 })
      expect(actor.getSnapshot().context.history).toEqual({ head: { kind: 'model' }, tail: null })

      actor.send({ type: 'undo' })
      await waitFor(actor, s => idle(s) && directions.length === 1, { timeout: 3000 })
      expect(actor.getSnapshot().context.history).toBeNull()
      expect(actor.getSnapshot().context.redo).toEqual({ head: { kind: 'model' }, tail: null })

      actor.send({ type: 'redo' })
      await waitFor(actor, s => idle(s) && directions.length === 2, { timeout: 3000 })
      expect(directions).toEqual(['undo', 'redo'])
      expect(actor.getSnapshot().context.history).toEqual({ head: { kind: 'model' }, tail: null })
      actor.stop()
    })

    it('UT-132 (canvas): a refused undo shows the error and drops model entries', async () => {
      const actor = createTestActor(executeUndoable, async () => {
        throw new Error('[stale-undo] File changed since this edit; undo unavailable')
      })
      actor.send({ type: 'change.view', change })
      await waitFor(actor, s => idle(s) && s.context.history !== null, { timeout: 500 })

      actor.send({ type: 'undo' })
      await waitFor(actor, s => s.context.lastError !== null, { timeout: 3000 })
      expect(actor.getSnapshot().context.lastError).toBe('[stale-undo] File changed since this edit; undo unavailable')
      expect(actor.getSnapshot().context.history).toBeNull()
      expect(actor.getSnapshot().context.redo).toBeNull()
      actor.stop()
    })

    it('two quick undos are both executed', async () => {
      const directions = [] as string[]
      const actor = createTestActor(executeUndoable, async ({ input }) => {
        directions.push(input.direction)
        return {}
      })
      actor.send({ type: 'change.view', change })
      await waitFor(actor, s => idle(s) && s.context.history !== null, { timeout: 500 })
      actor.send({ type: 'change.view', change: { ...change, title: 'B' } })
      await waitFor(actor, s => idle(s) && s.context.history?.tail !== null, { timeout: 500 })

      actor.send({ type: 'undo' })
      actor.send({ type: 'undo' })
      await waitFor(actor, () => directions.length === 2, { timeout: 5000 })
      expect(directions).toEqual(['undo', 'undo'])
      actor.stop()
    })
  })
})
