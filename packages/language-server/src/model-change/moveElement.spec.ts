import type { Fqn, ViewId } from '@likec4/core'
import { describe, expect, it, vi } from 'vitest'
import { createMultiProjectTestServices } from '../test'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const model = `
  specification {
    element actor
    element system
    element container
  }
  model {
    customer = actor 'Customer'
    cloud = system 'Cloud' {
      api = container 'API' {
        -> db 'reads'
      }
      // the main database
      // (postgres)
      db = container 'Database' {
        table = container 'Table'

        -> api 'notifies'
      }
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

function move(element: string, parent: string | null, viewId = 'index') {
  return {
    viewId: viewId as ViewId,
    change: { op: 'move-element' as const, element: element as Fqn, parent: parent as Fqn | null },
  }
}

describe('move-element', () => {
  it('UT-020 + UT-021 + UT-022 + UT-025 + UT-026: moves the statement with its comments, rewrites references', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(move('cloud.db', 'customer'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toMatchInlineSnapshot(`
      "specification {
        element actor
        element system
        element container
      }
      model {
        customer = actor 'Customer' {
          // the main database
          // (postgres)
          db = container 'Database' {
            table = container 'Table'

            -> cloud.api 'notifies'
          }
        }
        cloud = system 'Cloud' {
          api = container 'API' {
            -> customer.db 'reads'
          }
        }
      }
      "
    `)
  })

  it('UT-021: a comment separated by a blank line stays', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          cloud = system {
            // about the block

            db = system
          }
          other = system
        }
      `,
      'views.c4': views,
    })
    expect(await ws.apply(move('cloud.db', 'other'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toMatchInlineSnapshot(`
      "specification { element system }
      model {
        cloud = system {
          // about the block

        }
        other = system {
          db = system
        }
      }
      "
    `)
  })

  it('UT-020: re-indents with tabs', async () => {
    const ws = await memfsWorkspace({
      'model.c4':
        'specification { element system }\nmodel {\n\tcloud = system {\n\t\tdb = system {\n\t\t\ttable = system\n\t\t}\n\t}\n\tother = system {\n\t\tx = system\n\t}\n}\n',
      'views.c4': views,
    })
    expect(await ws.apply(move('cloud.db', 'other'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toBe(
      'specification { element system }\nmodel {\n\tcloud = system {\n\t}\n\tother = system {\n\t\tx = system\n\t\tdb = system {\n\t\t\ttable = system\n\t\t}\n\t}\n}\n',
    )
  })

  it('UT-023: moves the statement to the file of the new parent, references in a third file follow', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'other.c4': `
        model {
          billing = system 'Billing' {
            ledger = container
          }
        }
      `,
      'views.c4': `
        views {
          view index {
            include *, cloud.db.table
          }
          view of cloud.db {
            include *
          }
        }
      `,
    })
    expect(await ws.apply(move('cloud.db', 'billing'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).not.toContain('Database')
    expect(ws.read('other.c4')).toMatchInlineSnapshot(`
      "model {
        billing = system 'Billing' {
          ledger = container
          // the main database
          // (postgres)
          db = container 'Database' {
            table = container 'Table'

            -> cloud.api 'notifies'
          }
        }
      }
      "
    `)
    expect(ws.read('views.c4')).toMatchInlineSnapshot(`
      "views {
        view index {
          include *, billing.db.table
        }
        view of billing.db {
          include *
        }
      }
      "
    `)
  })

  it('UT-024: to the top level, the statement goes to the first model of the view file', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        model {
          extra = system
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    expect(await ws.apply(move('cloud.api', null))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).not.toContain(`api = container 'API'`)
    expect(ws.read('model.c4')).toContain(`-> api 'notifies'`)
    expect(ws.read('views.c4')).toMatchInlineSnapshot(`
      "model {
        extra = system
        api = container 'API' {
          -> cloud.db 'reads'
        }
      }
      views {
        view index {
          include *
        }
      }
      "
    `)
  })

  it('UT-027: appends an include when the moved element would be hidden, only then', async () => {
    const files = {
      'model.c4': model,
      'views.c4': `
        views {
          view index {
            include *
          }
          view cloudView of cloud {
            include cloud.*
          }
        }
      `,
    }
    const ws = await memfsWorkspace(files)
    // `cloud.*` does not show `customer.db`
    expect(await ws.apply(move('cloud.db', 'customer', 'cloudView'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toContain(`include cloud.*\n    include customer.db\n`)

    const ws2 = await memfsWorkspace(files)
    // `include *` of index shows top-level elements: `db` moved to the top level is visible
    expect(await ws2.apply(move('cloud.db', null))).toMatchObject({ success: true })
    expect(ws2.read('views.c4')).not.toContain('include db')

    const ws3 = await memfsWorkspace(files)
    // `cloud.api` is not shown in index before the move: nothing to keep visible
    expect(await ws3.apply(move('cloud.api', 'customer'))).toMatchObject({ success: true })
    expect(ws3.read('views.c4')).not.toContain('include customer.api')
  })

  it('review 001-001: children declared in an extend elsewhere move along, their references follow', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          cloud = system {
            db = system
          }
          billing = system
          customer = system
        }
        views {
          view index {
            include *
          }
        }
      `,
      'extra.c4': `
        model {
          extend cloud.db {
            table = system
          }
          customer -> cloud.db.table
        }
      `,
    })
    expect(await ws.apply(move('cloud.db', 'billing'))).toMatchObject({ success: true })
    expect(ws.read('extra.c4')).toMatchInlineSnapshot(`
      "model {
        extend billing.db {
          table = system
        }
        customer -> billing.db.table
      }
      "
    `)
  })

  it('review 001-003: manual layouts follow the moved element and its descendants', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          cloud = system {
            db = system {
              table = system
            }
          }
          billing = system
        }
        views {
          view index {
            include *, cloud.db, cloud.db.table
          }
          view dbOnly {
            include cloud.db, cloud.db.table
          }
        }
      `,
    }, { manualLayouts: true })
    const views = ws.services.likec4.Views
    for (const diagram of await views.diagrams()) {
      await ws.apply({
        viewId: diagram.id,
        change: { op: 'save-view-snapshot', layout: { ...diagram, _layout: 'manual' } },
      })
    }
    const drifts = async (viewId: string) =>
      (await views.layoutView({ viewId: viewId as ViewId, projectId: 'default' as never, layoutType: 'manual' }))
        ?.diagram.drifts

    expect(await ws.apply(move('cloud.db', 'billing'))).toMatchObject({ success: true })
    for (const viewId of ['index', 'dbOnly']) {
      const snapshot = ws.snapshot(viewId) ?? ''
      expect(snapshot).toContain(`id: 'billing.db'`)
      expect(snapshot).toContain(`id: 'billing.db.table'`)
      expect(snapshot).not.toContain(`'cloud.db`)
    }
    // the new parent is not shown: the nodes keep their place, no drift
    expect(await drifts('dbOnly')).toBeUndefined()
    // the new parent is shown: the node changes parent in that view, drift is reported (rule 9)
    expect(await drifts('index')).toEqual(expect.arrayContaining(['nodes-drift']))
  })

  it('UT-028: refuses a name taken in the new parent', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          cloud = system {
            db = system
          }
          other = system {
            db = system
          }
        }
      `,
      'views.c4': views,
    })
    expect(await ws.apply(move('cloud.db', 'other'))).toEqual({
      success: false,
      code: 'name-collision',
      error: 'other already has db',
    })
  })

  it('UT-029: refuses its own subtree, its current parent, and unknown parents', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(move('cloud', 'cloud.db'))).toEqual({
      success: false,
      code: 'invalid-parent',
      error: 'cloud cannot be moved into cloud.db',
    })
    expect(await ws.apply(move('cloud.db', 'cloud'))).toEqual({
      success: false,
      code: 'invalid-parent',
      error: 'cloud.db cannot be moved into cloud',
    })
    expect(await ws.apply(move('customer', null))).toEqual({
      success: false,
      code: 'invalid-parent',
      error: 'customer cannot be moved into Top level',
    })
    expect(await ws.apply(move('cloud.db', 'nope'))).toEqual({
      success: false,
      code: 'not-found',
      error: 'nope not found',
    })
  })

  it('IT-004: moves across files in one LSP workspace edit, undo restores both files', async () => {
    const files = {
      'model.c4': model,
      'other.c4': `
        model {
          billing = system 'Billing'
        }
      `,
      'views.c4': views,
    }
    const ws = await memfsWorkspace(files, { lsp: true })
    const before = { model: ws.read('model.c4'), other: ws.read('other.c4') }
    expect(await ws.apply(move('cloud.db', 'billing'))).toMatchObject({ success: true })
    expect(ws.lsp!.applied).toHaveLength(1)
    expect(ws.read('other.c4')).toContain(`billing = system 'Billing' {`)
    expect(ws.read('model.c4')).toContain(`-> billing.db 'reads'`)

    expect(await ws.services.likec4.ModelChanges.undo({})).toMatchObject({ success: true })
    expect({ model: ws.read('model.c4'), other: ws.read('other.c4') }).toEqual(before)
  })
})

describe('move-element of an imported element', () => {
  it('UT-031: refuses to move a top-level element imported by another project', async () => {
    const { services, validateAll } = await createMultiProjectTestServices({
      projectA: {
        model: `
          specification { element system }
          model {
            cloud = system
            other = system
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
            customer = actor {
              -> cloud
            }
          }
        `,
      },
    })
    await validateAll()
    expect(await services.likec4.ModelChanges.applyChange({ ...move('cloud', 'other'), projectId: 'projectA' }))
      .toEqual({
        success: false,
        code: 'has-references',
        error: 'cloud is imported in 1 place: model.c4:2',
      })
  })
})
