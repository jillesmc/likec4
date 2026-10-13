import type { Fqn, ViewId } from '@likec4/core'
import stripIndent from 'strip-indent'
import { describe, expect, it, vi } from 'vitest'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const dsl = (text: string) => stripIndent(text).trimStart().trimEnd() + '\n'

const addStep = (viewId: string, source = 'web', target = 'api') => ({
  viewId: viewId as ViewId,
  change: { op: 'add-dynamic-step' as const, source: source as Fqn, target: target as Fqn },
})

const model = `
  specification { element system }
  model {
    web = system 'Web'
    api = system 'API'
    db = system 'DB'
  }
`

describe('add-dynamic-step', () => {
  it('UT-150: appends after the last top-level step, no model relation is created', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            title 'Checkout'
            api -> db
            include web
          }
        }
      `,
    })
    const modelBefore = ws.read('model.c4')
    expect(await ws.apply(addStep('checkout'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(dsl(`
      views {
        dynamic view checkout {
          title 'Checkout'
          api -> db
          web -> api
          include web
        }
      }
    `))
    expect(ws.read('model.c4')).toBe(modelBefore)
  })

  it('UT-151: goes after a parallel block, at top level', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            parallel {
              web -> db
              api -> db
            }
          }
        }
      `,
    })
    expect(await ws.apply(addStep('checkout'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toContain(
      dsl(`
          parallel {
            web -> db
            api -> db
          }
          web -> api
        }
    `).replaceAll('\n', '\n  ').trimEnd(),
    )
  })

  it('UT-152: without steps, inserts before the first rule (or at the end of the body)', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view withRules {
            include web
          }
          dynamic view empty {
          }
        }
      `,
    })
    await ws.apply(addStep('withRules'))
    await ws.apply(addStep('empty'))
    expect(ws.read('views.c4')).toBe(dsl(`
      views {
        dynamic view withRules {
          web -> api
          include web
        }
        dynamic view empty {
          web -> api
        }
      }
    `))
  })

  it('UT-045: is not supported in element views', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          view index {
            include *
          }
        }
      `,
    })
    expect(await ws.apply(addStep('index'))).toEqual({
      success: false,
      code: 'unsupported-in-view',
      error: 'add-dynamic-step is not supported in element views',
    })
  })
})
