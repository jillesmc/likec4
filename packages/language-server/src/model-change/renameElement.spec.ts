import type { DeploymentFqn, Fqn, ViewId } from '@likec4/core'
import { vol } from 'memfs'
import { describe, expect, it, vi } from 'vitest'
import { URI } from 'vscode-uri'
import { createMultiProjectTestServices } from '../test'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const model = `
  specification {
    element actor
    element system
    element container
    deploymentNode env
    deploymentNode vm
  }
  model {
    customer = actor 'Customer' {
      -> cloud.api 'calls'
    }
    cloud = system 'Cloud' {
      api = container 'API' {
        -> db 'reads'
      }
      db = container 'Database'
    }
  }
`

const views = `
  views {
    view index {
      include *
    }
  }
`

/**
 * File content as written by the memfs workspace
 */
const stripped = (content: string) => content.trim().replace(/^ {2}/gm, '') + '\n'

function rename(element: string, name: string) {
  return {
    viewId: 'index' as ViewId,
    change: { op: 'rename-element' as const, target: { element: element as Fqn }, name },
  }
}

describe('rename-element', () => {
  it('UT-001 + UT-002: renames the definition and the relation endpoints, nothing else', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': views,
      'extra.c4': `
        model {
          cloud.api -> cloud.db 'writes'
          customer -> cloud.api
        }
      `,
    })
    expect(await ws.apply(rename('cloud.api', 'gateway'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toMatchInlineSnapshot(`
      "specification {
        element actor
        element system
        element container
        deploymentNode env
        deploymentNode vm
      }
      model {
        customer = actor 'Customer' {
          -> cloud.gateway 'calls'
        }
        cloud = system 'Cloud' {
          gateway = container 'API' {
            -> db 'reads'
          }
          db = container 'Database'
        }
      }
      "
    `)
    expect(ws.read('extra.c4')).toMatchInlineSnapshot(`
      "model {
        cloud.gateway -> cloud.db 'writes'
        customer -> cloud.gateway
      }
      "
    `)
    expect(ws.read('views.c4')).toBe(stripped(views))
  })

  it('UT-003: renames middle and last segments of chains, and unique-descendant shortcuts', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          cloud = system {
            backend = system {
              db = system
            }
          }
          other = system {
            -> cloud.backend.db
            -> cloud.db
          }
        }
      `,
      'views.c4': views,
    })
    await ws.apply(rename('cloud.backend.db', 'store'))
    await ws.apply(rename('cloud.backend', 'core'))
    expect(ws.read('model.c4')).toMatchInlineSnapshot(`
      "specification { element system }
      model {
        cloud = system {
          core = system {
            store = system
          }
        }
        other = system {
          -> cloud.core.store
          -> cloud.store
        }
      }
      "
    `)
  })

  it('UT-004 + UT-005: renames view rules, `view of` and dynamic steps', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          view index {
            include *, cloud.api
            include cloud.api with { title 'Gateway' }
            exclude cloud.api -> cloud.db
            style cloud.api {
              color red
            }
          }
          view apiView of cloud.api {
            include *
          }
          dynamic view flow {
            customer -> cloud.api 'calls'
            cloud.api -> cloud.db {
              title 'reads'
            }
          }
        }
      `,
    })
    expect(await ws.apply(rename('cloud.api', 'gateway'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toMatchInlineSnapshot(`
      "views {
        view index {
          include *, cloud.gateway
          include cloud.gateway with { title 'Gateway' }
          exclude cloud.gateway -> cloud.db
          style cloud.gateway {
            color red
          }
        }
        view apiView of cloud.gateway {
          include *
        }
        dynamic view flow {
          customer -> cloud.gateway 'calls'
          cloud.gateway -> cloud.db {
            title 'reads'
          }
        }
      }
      "
    `)
  })

  it('UT-006 + UT-010: renames `extend` paths and keeps `this` / `it`', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': views,
      'extend.c4': `
        model {
          extend cloud.api {
            this -> cloud.db
            it -> customer
          }
        }
      `,
    })
    await ws.apply(rename('cloud', 'platform'))
    expect(ws.read('extend.c4')).toMatchInlineSnapshot(`
      "model {
        extend platform.api {
          this -> platform.db
          it -> customer
        }
      }
      "
    `)
    expect(ws.read('model.c4')).toContain(`-> platform.api 'calls'`)
  })

  it('UT-007 + UT-011: renames `instanceOf`, and the references to unnamed instances', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': views,
      'deployment.c4': `
        deployment {
          prod = env {
            server = vm {
              instanceOf cloud.api
              main = instanceOf cloud.api
            }
          }
          prod.server.api -> prod.server.main
        }
        views {
          deployment view deploy {
            include prod.server.api
          }
        }
      `,
    })
    expect(await ws.apply(rename('cloud.api', 'gateway'))).toMatchObject({ success: true })
    expect(ws.read('deployment.c4')).toMatchInlineSnapshot(`
      "deployment {
        prod = env {
          server = vm {
            instanceOf cloud.gateway
            main = instanceOf cloud.gateway
          }
        }
        prod.server.gateway -> prod.server.main
      }
      views {
        deployment view deploy {
          include prod.server.gateway
        }
      }
      "
    `)
  })

  it('UT-008: renames global predicates and styles', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': views,
      'global.c4': `
        global {
          predicateGroup apiOnly {
            include cloud.api
          }
          style apiStyle cloud.api {
            color red
          }
        }
      `,
    })
    expect(await ws.apply(rename('cloud.api', 'gateway'))).toMatchObject({ success: true })
    expect(ws.read('global.c4')).toMatchInlineSnapshot(`
      "global {
        predicateGroup apiOnly {
          include cloud.gateway
        }
        style apiStyle cloud.gateway {
          color red
        }
      }
      "
    `)
  })

  it('UT-009: renames references in other files, one edit for all of them', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          view index {
            include cloud.api
          }
        }
      `,
      'extra.c4': `
        model {
          customer -> cloud.api
        }
      `,
    }, { lsp: true })
    expect(await ws.apply(rename('cloud.api', 'gateway'))).toMatchObject({
      success: true,
      modifiedUris: expect.arrayContaining([ws.uri('model.c4'), ws.uri('views.c4'), ws.uri('extra.c4')]),
    })
    expect(ws.lsp!.applied).toHaveLength(1)
    expect(ws.read('views.c4')).toContain('include cloud.gateway')
    expect(ws.read('extra.c4')).toContain('customer -> cloud.gateway')
  })

  it('UT-013: the same name is a no-op', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    const before = ws.read('model.c4')
    expect(await ws.apply(rename('cloud.api', 'api'))).toMatchObject({ success: false })
    expect(ws.read('model.c4')).toBe(before)
  })

  it.each(['1abc', 'a b', '', 'a.b'])('UT-014: refuses the invalid name %j', async name => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(rename('cloud.api', name))).toEqual({
      success: false,
      code: 'invalid-name',
      error: `${name} is not a valid identifier`,
    })
  })

  it('UT-015: refuses a name taken by a sibling, accepts a name used elsewhere', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(rename('cloud.api', 'db'))).toEqual({
      success: false,
      code: 'name-collision',
      error: 'cloud already has db',
    })
    expect(await ws.apply(rename('customer', 'cloud'))).toEqual({
      success: false,
      code: 'name-collision',
      error: 'Top level already has cloud',
    })
    // `customer` is not a sibling of `cloud.api`
    expect(await ws.apply(rename('cloud.api', 'customer'))).toMatchObject({ success: true })
  })

  it('refuses unknown elements', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(rename('cloud.nope', 'x'))).toEqual({
      success: false,
      code: 'not-found',
      error: 'cloud.nope not found',
    })
  })
})

describe('rename-element of deployment items', () => {
  const deployment = `
    deployment {
      prod = env {
        server = vm 'Server' {
          instanceOf cloud.api
          main = instanceOf cloud.db
        }
        backup = vm
      }
      prod.server.api -> prod.server.main
    }
    deployment {
      extend prod.server {
        instanceOf customer
      }
    }
    views {
      deployment view deploy {
        include prod.**
        exclude prod.server.api
      }
    }
  `

  function renameDeployment(fqn: string, name: string) {
    return {
      viewId: 'index' as ViewId,
      change: { op: 'rename-element' as const, target: { deployment: fqn as DeploymentFqn }, name },
    }
  }

  it('UT-016: renames a deployment node, its extend, relations and view rules', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views, 'deployment.c4': deployment })
    expect(await ws.apply(renameDeployment('prod.server', 'host'))).toMatchObject({ success: true })
    expect(ws.read('deployment.c4')).toMatchInlineSnapshot(`
      "deployment {
        prod = env {
          host = vm 'Server' {
            instanceOf cloud.api
            main = instanceOf cloud.db
          }
          backup = vm
        }
        prod.host.api -> prod.host.main
      }
      deployment {
        extend prod.host {
          instanceOf customer
        }
      }
      views {
        deployment view deploy {
          include prod.**
          exclude prod.host.api
        }
      }
      "
    `)
  })

  it('UT-012: renaming an unnamed instance writes its name, and renames its references', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views, 'deployment.c4': deployment })
    expect(await ws.apply(renameDeployment('prod.server.api', 'apiMain'))).toMatchObject({ success: true })
    expect(ws.read('deployment.c4')).toContain(`    apiMain = instanceOf cloud.api\n`)
    expect(ws.read('deployment.c4')).toContain(`prod.server.apiMain -> prod.server.main`)
    expect(ws.read('deployment.c4')).toContain(`exclude prod.server.apiMain`)
    // the element is not renamed
    expect(ws.read('model.c4')).toBe(stripped(model))
  })

  it('UT-016: renames a named instance', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views, 'deployment.c4': deployment })
    expect(await ws.apply(renameDeployment('prod.server.main', 'primary'))).toMatchObject({ success: true })
    expect(ws.read('deployment.c4')).toContain(`primary = instanceOf cloud.db`)
    expect(ws.read('deployment.c4')).toContain(`prod.server.api -> prod.server.primary`)
  })

  it('UT-017: refuses a name taken by a sibling deployment item', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views, 'deployment.c4': deployment })
    expect(await ws.apply(renameDeployment('prod.server', 'backup'))).toEqual({
      success: false,
      code: 'name-collision',
      error: 'prod already has backup',
    })
    expect(await ws.apply(renameDeployment('prod.server.main', 'api'))).toEqual({
      success: false,
      code: 'name-collision',
      error: 'prod.server already has api',
    })
  })
})

describe('rename-element in the pipeline', () => {
  const manualViews = `
    views {
      view index {
        include *
      }
      view of cloud.api {
        include *
      }
    }
  `

  /**
   * Workspace with manual layouts saved for every view
   */
  async function withSnapshots(opts?: { lsp?: boolean }) {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': manualViews }, { ...opts, manualLayouts: true })
    const views = ws.services.likec4.Views
    for (const diagram of await views.diagrams()) {
      // as the diagram saves it
      const layout = { ...diagram, _layout: 'manual' as const }
      expect(await ws.apply({ viewId: diagram.id, change: { op: 'save-view-snapshot', layout } }))
        .toMatchObject({ success: true })
    }
    const viewOfApi = (await views.diagrams()).find(d => d.id !== 'index')!.id
    return { ws, viewOfApi }
  }

  async function drifts(ws: Awaited<ReturnType<typeof memfsWorkspace>>, viewId: string) {
    const out = await ws.services.likec4.Views.layoutView({
      viewId: viewId as ViewId,
      projectId: 'default' as never,
      layoutType: 'manual',
    })
    return { layout: out?.diagram._layout, drifts: out?.diagram.drifts }
  }

  it('IT-001: applies the rename through the FS and through one LSP workspace edit', async () => {
    const fsWs = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await fsWs.apply(rename('cloud.api', 'gateway'))).toMatchObject({ success: true })
    expect(fsWs.read('model.c4')).toContain('-> cloud.gateway')

    const lspWs = await memfsWorkspace({ 'model.c4': model, 'views.c4': views }, { lsp: true })
    expect(await lspWs.apply(rename('cloud.api', 'gateway'))).toMatchObject({ success: true })
    expect(lspWs.lsp!.applied).toHaveLength(1)
    expect(lspWs.read('model.c4')).toBe(fsWs.read('model.c4'))
  })

  it('IT-002: snapshots of every view follow the rename, without drift', async () => {
    const { ws } = await withSnapshots()
    expect(await drifts(ws, 'index')).toEqual({ layout: 'manual', drifts: undefined })

    expect(await ws.apply(rename('cloud', 'platform'))).toMatchObject({ success: true })
    expect(ws.snapshot('index')).toContain(`id: 'platform'`)
    expect(ws.snapshot('index')).not.toContain(`id: 'cloud'`)
    expect(await drifts(ws, 'index')).toEqual({ layout: 'manual', drifts: undefined })
  })

  it('IT-003: an unnamed `view of x` gets a new id: its snapshot moves, the result carries the id', async () => {
    const { ws, viewOfApi } = await withSnapshots()
    const res = await ws.services.likec4.ModelChanges.applyChange({
      ...rename('cloud.api', 'gateway'),
      viewId: viewOfApi as ViewId,
    })
    expect(res).toMatchObject({ success: true, viewId: expect.any(String) })
    const newId = res.success ? res.viewId! : ''
    expect(newId).not.toBe(viewOfApi)
    expect(ws.snapshot(viewOfApi)).toBeNull()
    expect(ws.snapshot(newId)).toContain(`'cloud.gateway'`)
    expect(await drifts(ws, newId)).toEqual({ layout: 'manual', drifts: undefined })
    // the view of the change kept its id: no `viewId` in the result
    expect(await ws.apply(rename('customer', 'client'))).not.toHaveProperty('viewId')
  })

  it('IT-005: refuses a rename that captures a short name, every file and snapshot unchanged', async () => {
    const files = {
      'model.c4': `
        specification { element system }
        model {
          cloud = system {
            api = system
            worker = system {
              -> store
            }
          }
          store = system
        }
      `,
      'views.c4': views,
    }
    const ws = await memfsWorkspace(files, { manualLayouts: true })
    const [index] = await ws.services.likec4.Views.diagrams()
    await ws.apply({
      viewId: 'index' as ViewId,
      change: { op: 'save-view-snapshot', layout: { ...index!, _layout: 'manual' } },
    })
    const before = { model: ws.read('model.c4'), snapshot: ws.snapshot('index') }

    // inside `cloud`, `store` would resolve to the renamed `cloud.store` instead of the root `store`
    expect(await ws.apply(rename('cloud.api', 'store'))).toEqual({
      success: false,
      code: 'invalid-result',
      error: 'The change would break model.c4:6',
    })
    expect({ model: ws.read('model.c4'), snapshot: ws.snapshot('index') }).toEqual(before)
  })

  it('IT-006: undo and redo restore and re-apply the files and the snapshots', async () => {
    const { ws, viewOfApi } = await withSnapshots()
    const before = { model: ws.read('model.c4'), index: ws.snapshot('index'), viewOf: ws.snapshot(viewOfApi) }
    const res = await ws.apply({ ...rename('cloud.api', 'gateway'), viewId: viewOfApi as ViewId })
    const newId = res.success ? res.viewId! : ''
    const after = { model: ws.read('model.c4'), index: ws.snapshot('index'), viewOf: ws.snapshot(newId) }

    const editor = ws.services.likec4.ModelChanges
    expect(await editor.undo({})).toMatchObject({ success: true })
    expect({ model: ws.read('model.c4'), index: ws.snapshot('index'), viewOf: ws.snapshot(viewOfApi) })
      .toEqual(before)
    expect(ws.snapshot(newId)).toBeNull()

    expect(await editor.redo({})).toMatchObject({ success: true })
    expect({ model: ws.read('model.c4'), index: ws.snapshot('index'), viewOf: ws.snapshot(newId) }).toEqual(after)
    expect(ws.snapshot(viewOfApi)).toBeNull()
  })

  it('IT-007: undo after an external edit of a touched file is refused, nothing restored', async () => {
    const { ws } = await withSnapshots()
    await ws.apply(rename('cloud.api', 'gateway'))
    const uri = URI.parse(ws.uri('views.c4'))
    vol.writeFileSync(uri.fsPath, ws.read('views.c4') + '// edited\n')
    await ws.services.shared.workspace.DocumentBuilder.update([uri], [])
    const after = { model: ws.read('model.c4'), index: ws.snapshot('index') }

    expect(await ws.services.likec4.ModelChanges.undo({})).toMatchObject({ success: false, code: 'stale-undo' })
    expect({ model: ws.read('model.c4'), index: ws.snapshot('index') }).toEqual(after)
  })
})

describe('rename-element across projects', () => {
  it('UT-030: the import and the references of the importing project follow the rename', async () => {
    const { services, validateAll, projects } = await createMultiProjectTestServices({
      projectA: {
        model: `
          specification { element system }
          model {
            cloud = system 'Cloud' {
              api = system 'API'
            }
          }
          views {
            view index {
              include *
            }
          }
        `,
      },
      projectB: {
        model: `
          import { cloud } from 'projectA'
          specification { element actor }
          model {
            customer = actor 'Customer' {
              -> cloud.api
              -> cloud
            }
          }
          views {
            view index {
              include *, cloud
            }
          }
        `,
      },
    })
    await validateAll()
    const files = new Map(services.shared.workspace.LangiumDocuments.all.map(d => [
      d.uri.toString(),
      d.textDocument.getText(),
    ]))
    const fs = services.shared.workspace.FileSystemProvider
    vi.spyOn(fs, 'readFile').mockImplementation(async uri => files.get(uri.toString()) ?? '')
    vi.spyOn(fs, 'writeFile').mockImplementation(async (uri, content) => {
      files.set(uri.toString(), content)
    })

    const res = await services.likec4.ModelChanges.applyChange({
      ...rename('cloud', 'platform'),
      projectId: 'projectA',
    })
    expect(res).toMatchObject({ success: true })
    expect(files.get(projects.projectA.model.uri.toString())).toContain(`platform = system 'Cloud'`)
    expect(files.get(projects.projectB.model.uri.toString())).toMatchInlineSnapshot(`
      "
      import { platform } from 'projectA'
      specification { element actor }
      model {
        customer = actor 'Customer' {
          -> platform.api
          -> platform
        }
      }
      views {
        view index {
          include *, platform
        }
      }
              "
    `)
  })
})
