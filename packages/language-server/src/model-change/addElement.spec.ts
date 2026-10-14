import type { ElementKind, Fqn, ViewId } from '@likec4/core'
import stripIndent from 'strip-indent'
import { describe, expect, it, vi } from 'vitest'
import { createMultiProjectTestServices } from '../test'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const dsl = (text: string) => stripIndent(text).trimStart().trimEnd() + '\n'

const addElement = (parent: string | null, kind: string, title: string, name?: string) => ({
  viewId: 'index' as ViewId,
  change: {
    op: 'add-element' as const,
    parent: parent as Fqn | null,
    kind: kind as ElementKind,
    title,
    ...(name !== undefined && { name }),
  },
})

const modelFile = `
  specification {
    element system
    element service
  }
  model {
    cloud = system 'Cloud' {
      api = service 'API'
    }
  }
`

const viewsFile = `
  views {
    view index {
      include *, cloud.*
    }
  }
`

describe('add-element', () => {
  it('UT-013: writes the element as the last child of the parent block, in the parent file', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    const res = await ws.apply(addElement('cloud', 'service', 'Billing API'))
    expect(res).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toBe(dsl(`
      specification {
        element system
        element service
      }
      model {
        cloud = system 'Cloud' {
          api = service 'API'
          billingApi = service 'Billing API'
        }
      }
    `))
  })

  it('UT-014: writes a top-level element into the model of the view file', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        model {
          // view local elements
        }
        views {
          view index {
            include *
          }
        }
      `,
    })
    const modelBefore = ws.read('model.c4')
    await ws.apply(addElement(null, 'system', 'Billing'))
    expect(ws.read('model.c4')).toBe(modelBefore)
    expect(ws.read('views.c4')).toBe(dsl(`
      model {
        // view local elements
        billing = system 'Billing'
      }
      views {
        view index {
          include *
        }
      }
    `))
  })

  it('UT-015: creates model block in the view file when missing', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    const res = await ws.apply(addElement(null, 'system', 'Billing'))
    expect(res).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(dsl(`
      views {
        view index {
          include *
        }
      }

      model {
        billing = system 'Billing'
      }
    `))
  })

  it('UT-016: writes into the definition, not into extend', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        model {
          extend cloud {
            api -> cloud
          }
        }
        views {
          view index {
            include *, cloud.*
          }
        }
      `,
    })
    const viewsBefore = ws.read('views.c4')
    await ws.apply(addElement('cloud', 'service', 'Billing'))
    expect(ws.read('model.c4')).toContain(`    billing = service 'Billing'\n`)
    expect(ws.read('views.c4')).toBe(viewsBefore)
  })

  it('UT-022 + UT-024: dedupes the derived name and escapes quotes', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    const res = await ws.apply(addElement('cloud', 'service', `It's`))
    expect(res).toMatchObject({ success: true })
    await ws.apply(addElement('cloud', 'service', `It's`))
    expect(ws.read('model.c4')).toContain(
      [
        `    its = service 'It\\'s'`,
        `    its2 = service 'It\\'s'`,
      ].join('\n'),
    )
  })

  it('adds include when the element would not be visible', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          view index {
            include cloud
          }
        }
      `,
    })
    await ws.apply(addElement('cloud', 'service', 'Billing'))
    expect(ws.read('views.c4')).toContain('    include cloud.billing\n')
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    expect(model.view('index' as ViewId).$view.nodes.map(n => n.id)).toContain('cloud.billing')
  })

  it('UT-042: rejects unknown kind', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    const before = ws.read('model.c4')
    const res = await ws.apply(addElement('cloud', 'servise', 'Billing'))
    expect(res).toEqual({ success: false, code: 'unknown-kind', error: 'Unknown element kind "servise"' })
    expect(ws.read('model.c4')).toBe(before)
  })

  it('issue 006: rejects inherited keys as kind', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    expect(await ws.apply(addElement('cloud', 'constructor', 'X'))).toMatchObject({ code: 'unknown-kind' })
  })

  it('issue 013: returns the created fqn', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    expect(await ws.apply(addElement('cloud', 'service', 'Billing API'))).toMatchObject({
      success: true,
      created: 'cloud.billingApi',
    })
  })

  it('UT-043: rejects invalid explicit name', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    const res = await ws.apply(addElement('cloud', 'service', 'Billing', 'billing api'))
    expect(res).toEqual({ success: false, code: 'invalid-name', error: 'Invalid identifier "billing api"' })
  })

  it('UT-044: rejects explicit name that already exists', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': viewsFile })
    const res = await ws.apply(addElement('cloud', 'service', 'API', 'api'))
    expect(res).toEqual({ success: false, code: 'name-collision', error: 'Element "cloud.api" already exists' })
  })
})

describe('add-element: parent from another project', () => {
  it('UT-041: rejects with read-only-target', async () => {
    const { services, validateAll } = await createMultiProjectTestServices({
      projectA: {
        model: `
          import { cloud } from 'projectB'
          specification { element system }
          model {
            customer = system 'Customer'
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
          specification { element system }
          model { cloud = system 'Cloud' }
        `,
      },
    })
    await validateAll()
    const res = await services.likec4.ModelChanges.applyChange({
      ...addElement('@projectB.cloud', 'system', 'Billing'),
      projectId: 'projectA',
    })
    expect(res).toEqual({
      success: false,
      code: 'read-only-target',
      error: '"@projectB.cloud" is defined in another project',
    })
  })
})
