import { useMemo } from 'react'
import { isNullish } from 'remeda'
import { fromPromise } from 'xstate'
import { useCallbackRef } from '../hooks'
import { type EditorActorLogic, editorActorLogic } from './actor/machine'
import type { EditorCalls } from './actor/setup'
import { isModelChange } from './actor/types'
import { applyChangesToManualLayout, placeNewNodes } from './applyChangesToManualLayout'
import { shouldWaitForViewSync } from './LikeC4EditorCallbacks'
import { useOptionalLikeC4Editor } from './LikeC4EditorProvider'

const promisify = <T>(fn: () => T | Promise<T>): Promise<T> => {
  return Promise.resolve().then(() => fn())
}

export function useEditorActorLogic(): EditorActorLogic & {
  /**
   * True if the editor is running in stub mode (no actual editor port available)
   * This happens when the diagram is rendered outside of vscode extension / vite- plugin
   */
  readonly isStub: boolean
} {
  const port = useOptionalLikeC4Editor()
  const isStub = isNullish(port)

  const applyLatest: EditorCalls.ApplyLatestToManual = useCallbackRef(
    async ({ input: { viewId, current, placements } }) => {
      if (!port) {
        console.error('No editor port available for applying latest to manual layout')
        throw new Error('No editor port')
      }
      const manual = await promisify(() => current ?? port.fetchView(viewId, 'manual'))
      const latest = await promisify(() => port.fetchView(viewId, 'auto'))
      let updated = applyChangesToManualLayout(manual, latest)
      if (placements && placements.length > 0) {
        updated = placeNewNodes(manual, updated, placements)
      }
      return {
        updated,
      }
    },
  )

  const executeChange: EditorCalls.ExecuteChange = useCallbackRef(
    async ({ input }) => {
      if (!port) {
        console.error('No editor port available for executing change')
        throw new Error('No editor port')
      }
      if (import.meta.env.DEV) {
        console.debug('Executing change', { input })
      }
      const applied = [] as typeof input.changes
      const failed = [] as Array<{ change: (typeof input.changes)[number]; error: string }>
      const undoable = [] as Array<string | undefined>
      const created = [] as Array<{ change: (typeof input.changes)[number]; id: string }>
      let renamedView: (typeof input)['viewId'] | null = null
      let waitForViewSync = false
      for (const change of input.changes) {
        try {
          const result = await promisify(() => port.handleChange(input.viewId, change))
          applied.push(change)
          waitForViewSync ||= shouldWaitForViewSync(result)
          if (port.undoModelChange && isModelChange(change)) {
            undoable.push(result?.historyId)
          }
          if (result?.created) {
            created.push({ change, id: result.created })
          }
          if (result?.viewId && result.viewId !== input.viewId) {
            renamedView = result.viewId
          }
        } catch (error) {
          console.error('Failed to execute change', { change, error })
          failed.push({ change, error: error instanceof Error ? error.message : String(error) })
          waitForViewSync ||= shouldWaitForViewSync()
        }
      }
      return { requested: input.changes, applied, failed, undoable, created, renamedView, waitForViewSync }
    },
  )

  const modelHistory: EditorCalls.ModelHistory = useCallbackRef(
    async ({ input: { viewId, direction, historyId } }) => {
      const fn = direction === 'undo' ? port?.undoModelChange : port?.redoModelChange
      if (!fn) {
        throw new Error(`${direction} of model changes is not available`)
      }
      await fn(viewId, historyId)
      return {}
    },
  )

  const applySemanticLayout: EditorCalls.ApplySemanticLayout = useCallbackRef(
    async ({ input }) => {
      if (!port) {
        console.error('No editor port available for applying semantic layout')
        throw new Error('No editor port')
      }
      if (!port.applySemanticLayout) {
        console.error('No applySemanticLayout method available on editor port')
        throw new Error('No applySemanticLayout method')
      }
      if (import.meta.env.DEV) {
        console.debug('Applying semantic layout', { input })
      }
      await port.applySemanticLayout(input.viewId)
      if (import.meta.env.DEV) {
        console.debug('Applied semantic layout', { input })
      }
      return {}
    },
  )

  return useMemo(() =>
    Object.assign(
      editorActorLogic.provide({
        actors: {
          applyLatest: fromPromise(applyLatest),
          executeChange: fromPromise(executeChange),
          applySemanticLayout: fromPromise(applySemanticLayout),
          modelHistory: fromPromise(modelHistory),
        },
      }),
      { isStub },
    ), [applyLatest, executeChange, applySemanticLayout, modelHistory, isStub])
}
