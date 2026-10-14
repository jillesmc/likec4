import { type ViewId, ProjectId } from '@likec4/core'
import { describe, expect, it, vi } from 'vitest'
import type { PluginRPCParams } from '../rpc'
import { updateView } from './updateView'

function params(result: unknown): PluginRPCParams {
  // Partial fake, updateView uses only logger and likec4.editor
  return {
    logger: { info: vi.fn<(msg: string) => void>(), error: vi.fn<(msg: string) => void>() },
    likec4: { editor: { applyChange: vi.fn<() => Promise<unknown>>().mockResolvedValue(result) } },
  } as never
}

const data = {
  projectId: ProjectId('default'),
  viewId: 'index' as ViewId,
  change: { op: 'reset-manual-layout' as const },
}

describe('updateView', () => {
  it('IT-010: throws with the error code prefix when the change is rejected', async () => {
    await expect(
      updateView(params({ success: false, code: 'not-found', error: 'Element "cloud.ui" not found' }), data),
    ).rejects.toThrow('[not-found] Element "cloud.ui" not found')
  })

  it('throws the plain error when there is no code', async () => {
    await expect(updateView(params({ success: false, error: 'boom' }), data)).rejects.toThrow(/^boom$/)
  })

  it('resolves when the change is applied', async () => {
    await expect(updateView(params({ success: true, location: null }), data)).resolves.toEqual({})
  })

  it('returns the history id and the created fqn', async () => {
    await expect(
      updateView(params({ success: true, location: null, historyId: 'h1', created: 'cloud.api' }), data),
    ).resolves.toEqual({ historyId: 'h1', created: 'cloud.api' })
  })
})
