import type { Fqn, ViewId } from '@likec4/core'
import { describe, expect, it, vi } from 'vitest'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const changeTitle = (target: string, title: string) => ({
  viewId: 'index' as ViewId,
  change: {
    op: 'change-title' as const,
    target: target as Fqn,
    title,
  },
})

const views = `
  views {
    view index {
      include *
    }
  }
`

const workspace = (model: string) => memfsWorkspace({ 'model.c4': model, 'views.c4': views })

describe('change-title', () => {
  it('UT-100: replaces the positional title', async () => {
    const ws = await workspace(`
      specification { element service }
      model {
        api = service 'API' 'Summary'
      }
    `)
    expect(await ws.apply(changeTitle('api', 'Public API'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toContain(`  api = service 'Public API' 'Summary'\n`)
  })

  it('UT-101: replaces the title property, keeping positional strings', async () => {
    const ws = await workspace(`
      specification { element service }
      model {
        api = service 'API' {
          title 'API title'
        }
      }
    `)
    await ws.apply(changeTitle('api', 'Public API'))
    const text = ws.read('model.c4')
    expect(text).toContain(`  api = service 'API' {\n    title 'Public API'\n`)
  })

  it('UT-102: inserts the title after the kind when there is none', async () => {
    const ws = await workspace(`
      specification { element service }
      model {
        api = service {
          description 'no title'
        }
        service web
      }
    `)
    await ws.apply(changeTitle('api', 'Public API'))
    await ws.apply(changeTitle('web', 'Web'))
    const text = ws.read('model.c4')
    expect(text).toContain(`  api = service 'Public API' {\n`)
    expect(text).toContain(`  service web 'Web'\n`)
  })

  it('UT-103: same title does not change anything', async () => {
    const ws = await workspace(`
      specification { element service }
      model {
        api = service 'API'
      }
    `)
    const before = ws.read('model.c4')
    expect(await ws.apply(changeTitle('api', 'API'))).toEqual({ success: false, error: 'No changes to apply' })
    expect(ws.read('model.c4')).toBe(before)
  })

  it('UT-104: replaces the title of a deployment node', async () => {
    const ws = await workspace(`
      specification {
        element service
        deploymentNode vm
      }
      model {
        api = service 'API'
      }
      deployment {
        prod = vm 'Prod'
      }
    `)
    expect(await ws.apply(changeTitle('prod', 'Production'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toContain(`  prod = vm 'Production'\n`)
  })

  it('UT-105: replaces the title of a deployed instance', async () => {
    const ws = await workspace(`
      specification {
        element service
        deploymentNode vm
      }
      model {
        api = service 'API'
      }
      deployment {
        prod = vm 'Prod' {
          inst = instanceOf api 'Old'
          other = instanceOf api
        }
      }
    `)
    await ws.apply(changeTitle('prod.inst', 'New'))
    await ws.apply(changeTitle('prod.other', 'Other'))
    const text = ws.read('model.c4')
    expect(text).toContain(`    inst = instanceOf api 'New'\n`)
    expect(text).toContain(`    other = instanceOf api 'Other'\n`)
  })

  it('rejects empty title and unknown target', async () => {
    const ws = await workspace(`
      specification { element service }
      model {
        api = service 'API'
      }
    `)
    expect(await ws.apply(changeTitle('api', '  '))).toEqual({
      success: false,
      code: 'invalid-name',
      error: 'Title must not be empty',
    })
    expect(await ws.apply(changeTitle('nope', 'X'))).toEqual({
      success: false,
      code: 'not-found',
      error: 'Element "nope" not found',
    })
  })
})
