import type { ViewChangeErrorCode } from '@likec4/core'

/**
 * Deterministic rejection of a model change.
 * Converted by {@link LikeC4ModelChanges} into `{ success: false, code, error }`
 */
export class ModelChangeError extends Error {
  constructor(readonly code: ViewChangeErrorCode, message: string) {
    super(message)
    this.name = 'ModelChangeError'
  }
}
