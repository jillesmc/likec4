import type { Fqn, StepPath, ViewId } from '@likec4/core'
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

describe('add-dynamic-step: position', () => {
  const views = `
    views {
      dynamic view checkout {
        web -> api
        api -> db
      }
    }
  `
  const addBefore = (beforeStep: string) => ({
    viewId: 'checkout' as ViewId,
    change: {
      op: 'add-dynamic-step' as const,
      source: 'db' as Fqn,
      target: 'web' as Fqn,
      beforeStep: beforeStep as StepPath,
    },
  })

  it('UT-230: inserts before the step', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(addBefore('step-02'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toContain(`    web -> api\n    db -> web\n    api -> db\n`)
  })

  it('UT-230: before a step inside a block, inserts before the block (top level)', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            web -> api
            parallel {
              api -> db
            }
          }
        }
      `,
    })
    const computed = await ws.services.likec4.ModelBuilder.computeModel()
    const inBlock = computed.view('checkout' as ViewId).$view.edges.find(e => e.source === 'api')!.id
    expect(await ws.apply(addBefore(inBlock))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toContain(`    web -> api\n    db -> web\n    parallel {`)
  })

  it('UT-231: appends when the step is not found', async () => {
    const ws = await memfsWorkspace({ 'model.c4': model, 'views.c4': views })
    expect(await ws.apply(addBefore('step-09'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toContain(`    api -> db\n    db -> web\n  }`)
  })
})

describe('remove-dynamic-step', () => {
  const removeStep = (step: string) => ({
    viewId: 'checkout' as ViewId,
    change: { op: 'remove-dynamic-step' as const, step: step as StepPath },
  })
  // id of the step `source -> target` in the computed view
  async function stepId(ws: Awaited<ReturnType<typeof memfsWorkspace>>, source: string, target: string) {
    const computed = await ws.services.likec4.ModelBuilder.computeModel()
    const edge = computed.view('checkout' as ViewId).$view.edges.find(e => e.source === source && e.target === target)
    return edge!.id
  }

  it('UT-240: removes a single top-level step', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            web -> api
            api -> db 'reads'
            include web
          }
        }
      `,
    })
    expect(await ws.apply(removeStep(await stepId(ws, 'api', 'db')))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(dsl(`
      views {
        dynamic view checkout {
          web -> api
          include web
        }
      }
    `))
  })

  it('UT-241 + UT-242: removes a step inside a block, the block stays', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            web -> api
            parallel {
              api -> db
              api -> web
            }
            alt {
              when 'ok' {
                db -> web
              }
            }
          }
        }
      `,
    })
    expect(await ws.apply(removeStep(await stepId(ws, 'api', 'db')))).toMatchObject({ success: true })
    expect(await ws.apply(removeStep(await stepId(ws, 'db', 'web')))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(dsl(`
      views {
        dynamic view checkout {
          web -> api
          parallel {
            api -> web
          }
          alt {
            when 'ok' {
            }
          }
        }
      }
    `))
  })

  it('UT-243: refuses a step of a chain', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            web -> api -> db
          }
        }
      `,
    })
    const before = ws.read('views.c4')
    for (const [source, target] of [['web', 'api'], ['api', 'db']] as const) {
      expect(await ws.apply(removeStep(await stepId(ws, source, target)))).toMatchObject({
        success: false,
        code: 'unsupported-in-view',
        error: 'Steps of a chain cannot be removed from the canvas',
      })
    }
    expect(ws.read('views.c4')).toBe(before)
  })

  it('UT-244: unknown step → not-found', async () => {
    const ws = await memfsWorkspace({
      'model.c4': model,
      'views.c4': `
        views {
          dynamic view checkout {
            web -> api
          }
        }
      `,
    })
    expect(await ws.apply(removeStep('step-09'))).toMatchObject({ success: false, code: 'not-found' })
  })
})
