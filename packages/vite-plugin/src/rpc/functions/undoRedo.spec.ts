import { type ProjectId, type ViewId, Fqn } from '@likec4/core'
import { fromWorkspace } from '@likec4/language-services/node'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PluginRPCParams } from '../rpc'
import { redoChange, undoChange } from './undoRedo'
import { updateView } from './updateView'

const MODEL = `specification {
  element system
}
model {
  customer = system 'Customer'
  cloud = system 'Cloud'
}
views {
  view index {
    include *
  }
}
`

let dir: string | undefined

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true })
  }
})

describe('undoChange / redoChange', () => {
  it('IT-007: updateView, undoChange and redoChange round trip', async () => {
    dir = await mkdtemp(join(tmpdir(), 'likec4-undo-'))
    const file = join(dir, 'model.c4')
    await writeFile(file, MODEL)
    const likec4 = await fromWorkspace(dir)
    const params: PluginRPCParams = {
      // Partial fake, functions use only logger and likec4
      logger: { info: vi.fn<(msg: string) => void>(), error: vi.fn<(msg: string) => void>() },
      likec4: likec4.languageServices,
    } as never
    const projectId = likec4.projects()[0] as ProjectId

    await updateView(params, {
      projectId,
      viewId: 'index' as ViewId,
      change: { op: 'add-relation', source: Fqn('customer'), target: Fqn('cloud') },
    })
    const changed = await readFile(file, 'utf-8')
    expect(changed).toContain('-> cloud')

    await undoChange(params, { projectId })
    expect(await readFile(file, 'utf-8')).toBe(MODEL)

    await redoChange(params, { projectId })
    expect(await readFile(file, 'utf-8')).toBe(changed)

    await undoChange(params, { projectId })
    await expect(undoChange(params, { projectId })).rejects.toThrow('[not-found] Nothing to undo')
    await likec4.dispose()
  })
})
