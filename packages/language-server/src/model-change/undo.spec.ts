import type { Fqn, ViewId } from '@likec4/core'
import { vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'
import { URI } from 'vscode-uri'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const files = {
  'model.c4': `
    specification { element system }
    model {
      customer = system 'Customer'
      cloud = system 'Cloud'
    }
  `,
  'views.c4': `
    views {
      view index {
        include customer
      }
    }
  `,
}

const addRelation = {
  viewId: 'index' as ViewId,
  change: { op: 'add-relation' as const, source: 'customer' as Fqn, target: 'cloud' as Fqn },
}

describe('model change history (dev server)', () => {
  it('UT-130 + UT-131: undo restores both files, redo re-applies the change', async () => {
    const ws = await memfsWorkspace(files)
    const original = { model: ws.read('model.c4'), views: ws.read('views.c4') }
    await ws.apply(addRelation)
    const changed = { model: ws.read('model.c4'), views: ws.read('views.c4') }
    expect(changed.views).toContain('include customer -> cloud')

    const editor = ws.services.likec4.ModelChanges
    expect(await editor.undo({})).toMatchObject({ success: true })
    expect({ model: ws.read('model.c4'), views: ws.read('views.c4') }).toEqual(original)

    expect(await editor.redo({})).toMatchObject({ success: true })
    expect({ model: ws.read('model.c4'), views: ws.read('views.c4') }).toEqual(changed)
  })

  it('UT-132: refuses when the file changed since the edit, and clears the history', async () => {
    const ws = await memfsWorkspace(files)
    await ws.apply(addRelation)
    // edited outside the canvas
    const uri = URI.parse(ws.uri('model.c4'))
    vol.writeFileSync(uri.fsPath, ws.read('model.c4') + '// edited\n')
    await ws.services.shared.workspace.DocumentBuilder.update([uri], [])

    const editor = ws.services.likec4.ModelChanges
    expect(await editor.undo({})).toEqual({
      success: false,
      code: 'stale-undo',
      error: 'File changed since this edit; undo unavailable',
    })
    expect(await editor.undo({})).toMatchObject({ code: 'not-found' })
  })

  it('UT-133: nothing to undo', async () => {
    const ws = await memfsWorkspace(files)
    expect(await ws.services.likec4.ModelChanges.undo({})).toEqual({
      success: false,
      code: 'not-found',
      error: 'Nothing to undo',
    })
  })

  it('UT-133: keeps at most 100 entries', async () => {
    const ws = await memfsWorkspace(files)
    for (let i = 0; i < 101; i++) {
      await ws.apply({
        viewId: 'index' as ViewId,
        change: { op: 'change-title', target: 'cloud' as Fqn, title: `Cloud ${i}` },
      })
    }
    const editor = ws.services.likec4.ModelChanges
    for (let i = 0; i < 100; i++) {
      expect(await editor.undo({})).toMatchObject({ success: true })
    }
    expect(await editor.undo({})).toMatchObject({ code: 'not-found' })
    // the first change can not be undone anymore
    expect(ws.read('model.c4')).toContain(`cloud = system 'Cloud 0'`)
  })

  it('IT-009: with LSP client, undo is not supported', async () => {
    const ws = await memfsWorkspace(files, { lsp: true })
    await ws.apply(addRelation)
    expect(await ws.services.likec4.ModelChanges.undo({})).toEqual({
      success: false,
      code: 'unsupported-in-view',
      error: 'Use the editor undo',
    })
  })
})
