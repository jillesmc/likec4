import type { AdhocViewPredicate } from '@likec4/core/compute-view'
import type { LayoutedElementView, ProjectId, ViewChange, ViewId } from '@likec4/core/types'

export interface UpdateViewResult {
  /**
   * Id of the change in the undo history
   */
  historyId?: string | undefined
  /**
   * Fqn of the item created by the change
   */
  created?: string | undefined
}

export interface LikeC4VitePluginRpc {
  /**
   * Apply semantic layout (if AI is available)
   * See vite-plugin for more details
   *
   * (Available in the dev server)
   */
  applySemanticLayout(payload: {
    projectId: ProjectId
    viewId: ViewId
  }): Promise<void>
  /**
   * Send a view change to the server
   * (Available in the dev server)
   */
  updateView(payload: {
    projectId: ProjectId
    viewId: ViewId
    change: ViewChange
  }): Promise<UpdateViewResult>

  /**
   * Undo the latest model change made from the canvas
   * (Available in the dev server)
   */
  undoChange(payload: {
    projectId: ProjectId
    /**
     * Id of the change to undo, refused when it is not the latest change
     */
    historyId?: string | undefined
  }): Promise<void>

  /**
   * Redo the latest undone model change
   * (Available in the dev server)
   */
  redoChange(payload: {
    projectId: ProjectId
    historyId?: string | undefined
  }): Promise<void>

  /**
   * Calculate an adhoc view
   * (Available in the dev server)
   */
  calcAdhocView(payload: {
    projectId: ProjectId
    predicates: AdhocViewPredicate[]
  }): Promise<LayoutedElementView>
}
