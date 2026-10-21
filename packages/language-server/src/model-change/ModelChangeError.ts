import type { ViewChangeErrorCode } from '@likec4/core'

/**
 * Deterministic rejection of a model change.
 * Converted by {@link LikeC4ModelChanges} into `{ success: false, code, error }`
 */
export class ModelChangeError extends Error {
  /**
   * @param modifiedUris documents the change was applied to and reverted from (an editor may need to save them)
   */
  constructor(readonly code: ViewChangeErrorCode, message: string, readonly modifiedUris?: string[]) {
    super(message)
    this.name = 'ModelChangeError'
  }
}
