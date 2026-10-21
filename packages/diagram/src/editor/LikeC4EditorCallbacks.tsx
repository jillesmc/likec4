import type * as t from '@likec4/core/types'

/**
 * Result of applying a change from the LikeC4 Editor.
 */
export interface LikeC4EditorChangeResult {
  /**
   * Whether applying the change will publish a refreshed view to the diagram
   * that the editor should wait for.
   *
   * Returning no result from `handleChange` defaults this to `true`,
   * preserving the existing behavior for integrations that persist changes
   * through an external model service.
   */
  waitForViewSync?: boolean | undefined
  /**
   * Id of the change in the undo history of the host (see {@link LikeC4EditorCallbacks.undoModelChange})
   */
  historyId?: string | undefined
  /**
   * Fqn of the item created by the change (used to keep it where it was dropped)
   */
  created?: string | undefined
  /**
   * New id of the view, when the change renamed it (an unnamed `view of x` after renaming `x`):
   * the diagram navigates to it
   */
  viewId?: t.ViewId | undefined
}

export function shouldWaitForViewSync(
  result?: void | LikeC4EditorChangeResult,
): boolean {
  return result?.waitForViewSync ?? true
}

/**
 * Callbacks from LikeC4 Editor.
 */
export interface LikeC4EditorCallbacks {
  /**
   * Apply semantic layout to a view (if AI is available)
   * See vite-plugin settings for more details
   */
  applySemanticLayout?: undefined | ((viewId: t.ViewId) => Promise<void>)

  /**
   * Fetch a view by its ID and layout type.
   *
   * @param viewId - The ID of the view to fetch.
   * @param layout - The layout type to use when fetching the view.
   */
  fetchView(viewId: t.ViewId, layout?: t.LayoutType): t.LayoutedView | Promise<t.LayoutedView>

  /**
   * Callback invoked when the view changes.
   *
   * Return `{ waitForViewSync: false }` when the integration applies the
   * change locally and will not publish a refreshed view. When changes are
   * batched, the editor waits if any callback invocation expects a refresh.
   *
   * Must reject (throw) when the change was not applied:
   * the error message is shown to the user, and pending items of the change are removed.
   */
  handleChange(
    viewId: t.ViewId,
    change: t.ViewChange,
  ): void | LikeC4EditorChangeResult | Promise<void | LikeC4EditorChangeResult>

  /**
   * Revert the latest model change (Ctrl+Z on the canvas).
   * When provided, model changes join the canvas undo history.
   * Must reject when the change can not be reverted (e.g. file changed since the edit).
   */
  undoModelChange?: undefined | ((viewId: t.ViewId, historyId?: string) => Promise<void>)

  /**
   * Re-apply the latest reverted model change (Ctrl+Shift+Z on the canvas)
   */
  redoModelChange?: undefined | ((viewId: t.ViewId, historyId?: string) => Promise<void>)
}

export function createLikeC4Editor(callbacks: LikeC4EditorCallbacks): LikeC4EditorCallbacks {
  return callbacks
}
