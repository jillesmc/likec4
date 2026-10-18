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

describe('model change history', () => {
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
    // the stale entry is dropped
    expect(await editor.undo({})).toMatchObject({ code: 'not-found' })
  })

  it('issue 003: a stale entry does not clear older entries', async () => {
    const ws = await memfsWorkspace(files)
    const editor = ws.services.likec4.ModelChanges
    // first change touches views.c4 only, second change touches model.c4 only
    await ws.apply({
      viewId: 'index' as ViewId,
      change: { op: 'exclude-from-view', targets: [{ node: 'customer' as Fqn }] },
    })
    const excluded = ws.read('views.c4')
    await ws.apply({ viewId: 'index' as ViewId, change: { op: 'change-title', target: 'cloud' as Fqn, title: 'B' } })
    const uri = URI.parse(ws.uri('model.c4'))
    vol.writeFileSync(uri.fsPath, ws.read('model.c4').replace(`'B'`, `'C'`))
    await ws.services.shared.workspace.DocumentBuilder.update([uri], [])

    expect(await editor.undo({})).toMatchObject({ code: 'stale-undo' })
    expect(ws.read('views.c4')).toBe(excluded)
    expect(await editor.undo({})).toMatchObject({ success: true })
    expect(ws.read('views.c4')).not.toContain('exclude customer')
  })

  it('issue 003: view changes (style) are recorded and undone in order', async () => {
    const ws = await memfsWorkspace(files)
    const editor = ws.services.likec4.ModelChanges
    const original = ws.read('views.c4')
    await ws.apply(addRelation)
    const afterRelation = ws.read('views.c4')
    const styled = await ws.apply({
      viewId: 'index' as ViewId,
      change: { op: 'change-element-style', targets: ['cloud' as Fqn], style: { color: 'red' } },
    })
    expect(styled).toMatchObject({ success: true, historyId: expect.any(String) })
    expect(ws.read('views.c4')).toContain('style cloud')

    expect(await editor.undo({})).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(afterRelation)
    expect(await editor.undo({})).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(original)
  })

  it('issue 004: refuses to undo a change that is not the latest one', async () => {
    const ws = await memfsWorkspace(files)
    const editor = ws.services.likec4.ModelChanges
    const first = await ws.apply(addRelation)
    const second = await ws.apply({
      viewId: 'index' as ViewId,
      change: { op: 'change-title', target: 'cloud' as Fqn, title: 'Platform' },
    })
    const firstId = first.success ? first.historyId : undefined
    const secondId = second.success ? second.historyId : undefined
    expect(firstId).toBeDefined()
    expect(await editor.undo({ historyId: firstId })).toEqual({
      success: false,
      code: 'stale-undo',
      error: 'Another change was made since this edit; undo unavailable',
    })
    expect(await editor.undo({ historyId: secondId })).toMatchObject({ success: true, historyId: secondId })
    expect(await editor.redo({ historyId: secondId })).toMatchObject({ success: true })
  })

  it('issue 001: a failed write during undo is reported and keeps the entry', async () => {
    const ws = await memfsWorkspace(files)
    await ws.apply(addRelation)
    const fs = ws.services.shared.workspace.FileSystemProvider
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('read-only file system'))
    const editor = ws.services.likec4.ModelChanges
    expect(await editor.undo({})).toMatchObject({ success: false, code: 'apply-failed' })
    expect(await editor.undo({})).toMatchObject({ success: true })
  })

  it('issue 001: the guard reports when an invalid change could not be reverted', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          cloud = system 'Cloud' {
            api = system 'API'
          }
        }
      `,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    const originals = new Set([ws.read('model.c4'), ws.read('views.c4')])
    const writeFile = vi.spyOn(ws.services.shared.workspace.FileSystemProvider, 'writeFile')
    const write = writeFile.getMockImplementation()!
    // the change is written, the revert (writing the original text back) fails
    writeFile.mockImplementation(async (uri, content) => {
      if (originals.has(content)) {
        throw new Error('read-only file system')
      }
      return await write(uri, content)
    })
    const res = await ws.apply({
      viewId: 'index' as ViewId,
      change: { op: 'add-relation', source: 'cloud' as Fqn, target: 'cloud.api' as Fqn },
    })
    expect(res).toMatchObject({ success: false, code: 'apply-failed' })
    expect(res.success === false && res.error).toContain('could not be reverted')
  })

  it('issue 012: the history is capped by size', async () => {
    const ws = await memfsWorkspace(files)
    const editor = ws.services.likec4.ModelChanges
    // room for one entry only
    editor.historyMaxSize = ws.read('model.c4').length * 3
    await ws.apply({ viewId: 'index' as ViewId, change: { op: 'change-title', target: 'cloud' as Fqn, title: 'A' } })
    await ws.apply({ viewId: 'index' as ViewId, change: { op: 'change-title', target: 'cloud' as Fqn, title: 'B' } })
    expect(await editor.undo({})).toMatchObject({ success: true })
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

  it('UT-134 + IT-009: with LSP client, undo and redo are applied as one workspace edit (ADR-004)', async () => {
    const ws = await memfsWorkspace(files, { lsp: true })
    const lsp = ws.lsp!
    const original = { model: ws.read('model.c4'), views: ws.read('views.c4') }
    const applied = await ws.apply(addRelation)
    expect(applied).toMatchObject({ success: true, historyId: expect.any(String) })
    const changed = { model: ws.read('model.c4'), views: ws.read('views.c4') }
    expect(changed.views).toContain('include customer -> cloud')
    expect(lsp.applied).toHaveLength(1)

    const editor = ws.services.likec4.ModelChanges
    const undone = await editor.undo({ historyId: applied.success ? applied.historyId! : '' })
    expect(undone).toMatchObject({ success: true })
    expect(undone.success && [...undone.modifiedUris ?? []].sort()).toEqual(
      [ws.uri('model.c4'), ws.uri('views.c4')].sort(),
    )
    expect(lsp.applied).toHaveLength(2)
    expect(Object.keys(lsp.applied[1]!.edit.changes ?? {})).toHaveLength(2)
    expect({ model: ws.read('model.c4'), views: ws.read('views.c4') }).toEqual(original)

    expect(await editor.redo({})).toMatchObject({ success: true })
    expect(lsp.applied).toHaveLength(3)
    expect({ model: ws.read('model.c4'), views: ws.read('views.c4') }).toEqual(changed)
  })

  it('UT-134: with LSP client, a refused undo keeps the entry', async () => {
    const ws = await memfsWorkspace(files, { lsp: true })
    await ws.apply(addRelation)
    const changed = ws.read('model.c4')
    ws.lsp!.result = { applied: false, failureReason: 'read-only' }
    expect(await ws.services.likec4.ModelChanges.undo({})).toMatchObject({
      success: false,
      code: 'apply-failed',
    })
    expect(ws.read('model.c4')).toEqual(changed)
    ws.lsp!.result = { applied: true }
    expect(await ws.services.likec4.ModelChanges.undo({})).toMatchObject({ success: true })
  })
})
