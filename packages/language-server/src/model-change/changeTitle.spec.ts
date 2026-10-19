import type { Fqn, RelationId, ViewId } from '@likec4/core'
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

describe('change-title of a relation', () => {
  const relationTitle = (relation: string, title: string) => ({
    viewId: 'index' as ViewId,
    change: { op: 'change-title' as const, target: { relation: relation as RelationId }, title },
  })
  const model = (relation: string) => `
    specification { element service }
    model {
      api = service 'API' {
        ${relation}
      }
      db = service 'DB'
    }
  `
  // Applies the title to the only relation of the model, returns the model file
  async function retitle(relation: string, title: string) {
    const ws = await workspace(model(relation))
    const computed = await ws.services.likec4.ModelBuilder.computeModel()
    const [rel] = [...computed.relationships()]
    const res = await ws.apply(relationTitle(rel!.id, title))
    return { res, text: ws.read('model.c4') }
  }

  it('UT-220: replaces the positional title', async () => {
    const { res, text } = await retitle(`-> db 'reads'`, 'reads orders')
    expect(res).toMatchObject({ success: true })
    expect(text).toContain(`    -> db 'reads orders'\n`)
  })

  it('UT-221: inserts the title after the target, also before tags and body', async () => {
    expect((await retitle(`-> db`, 'reads')).text).toContain(`    -> db 'reads'\n`)
    expect((await retitle(`-> db #critical {\n          technology 'SQL'\n        }`, 'reads')).text)
      .toContain(`    -> db 'reads' #critical {`)
  })

  it('UT-222: updates the title property of the body', async () => {
    const { text } = await retitle(`-> db {\n          title 'reads'\n        }`, 'reads orders')
    expect(text).toContain(`      title 'reads orders'\n`)
  })

  it('UT-223: an empty title removes the literal or the property', async () => {
    expect((await retitle(`-> db 'reads'`, '')).text).toContain(`    -> db\n`)
    const property = (await retitle(`-> db {\n          title 'reads'\n          technology 'SQL'\n        }`, '')).text
    expect(property).not.toContain(`title`)
    expect(property).toContain(`technology 'SQL'`)
    // with a positional description, the title is kept empty (the description would become the title)
    expect((await retitle(`-> db 'reads' 'all orders'`, '')).text).toContain(`    -> db '' 'all orders'\n`)
  })

  it('UT-224: unknown relation → not-found, nothing written', async () => {
    const ws = await workspace(model(`-> db 'reads'`))
    const before = ws.read('model.c4')
    expect(await ws.apply(relationTitle('missing', 'x'))).toMatchObject({ success: false, code: 'not-found' })
    expect(ws.read('model.c4')).toBe(before)
  })
})
