import { describe, expect, it } from 'vitest'
import type { LikeC4LangiumDocument } from '../ast'
import { createTestServices } from '../test'

async function workspace() {
  const test = createTestServices()
  const model = await test.parse(
    `
specification {
  element system
  element container
  tag next
  deploymentNode vm
}
model {
  cloud = system 'Cloud' {
    api = container 'API'
    db = container 'Database' {
      -> api
    }
  }
}
deployment {
  server = vm {
    instanceOf cloud.api
  }
}
`,
    'model.c4',
  )
  const views = await test.parse(
    `
views {
  view index {
    include cloud.api
  }
}
`,
    'views.c4',
  )
  await test.validateAll()
  const provider = test.services.lsp.RenameProvider!
  /**
   * Position of the `nth` occurrence of `text` in the document (inside it, after its first character)
   */
  const at = (doc: LikeC4LangiumDocument, text: string, nth = 0) => {
    let offset = -1
    for (let i = 0; i <= nth; i++) {
      offset = doc.textDocument.getText().indexOf(text, offset + 1)
    }
    return { textDocument: { uri: doc.uri.toString() }, position: doc.textDocument.positionAt(offset + 1) }
  }
  return { model, views, provider, at }
}

describe('LikeC4RenameProvider', () => {
  it('UT-050: prepareRename returns the name range on a definition and on a reference', async () => {
    const { model, views, provider, at } = await workspace()
    // definition `api = container`
    const definition = at(model, 'api =')
    expect(await provider.prepareRename(model, definition)).toEqual({
      start: { line: 9, character: 4 },
      end: { line: 9, character: 7 },
    })
    // reference `cloud.api` in another file
    const reference = await provider.prepareRename(views, at(views, 'api'))
    expect(reference).toMatchObject({ start: { line: 3, character: 18 }, end: { line: 3, character: 21 } })
    // a deployment node
    expect(await provider.prepareRename(model, at(model, 'server'))).toBeDefined()
  })

  it('UT-051: other symbols can not be renamed', async () => {
    const { model, views, provider, at } = await workspace()
    // element kind, tag, view name
    expect(await provider.prepareRename(model, at(model, 'container', 1))).toBeUndefined()
    expect(await provider.prepareRename(model, at(model, 'next'))).toBeUndefined()
    expect(await provider.prepareRename(views, at(views, 'index'))).toBeUndefined()
  })

  it('UT-052: rename returns the edits of every file, as the canvas rename', async () => {
    const { model, views, provider, at } = await workspace()
    const edit = await provider.rename(model, { ...at(model, 'api ='), newName: 'gateway' })
    const changes = edit?.changes ?? {}
    expect(Object.keys(changes).sort()).toEqual([model.uri.toString(), views.uri.toString()].sort())
    // definition, `-> api` and `instanceOf cloud.api` in model.c4, `include cloud.api` in views.c4
    expect(changes[model.uri.toString()]!.map(e => e.newText)).toEqual(['gateway', 'gateway', 'gateway'])
    expect(changes[views.uri.toString()]!.map(e => e.newText)).toEqual(['gateway'])
  })

  it('UT-053: an invalid or taken name is an error, with no edits', async () => {
    const { model, provider, at } = await workspace()
    await expect(provider.rename(model, { ...at(model, 'api ='), newName: '1abc' }))
      .rejects.toThrow('1abc is not a valid identifier')
    await expect(provider.rename(model, { ...at(model, 'api ='), newName: 'db' }))
      .rejects.toThrow('cloud already has db')
  })
})
