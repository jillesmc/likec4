import type { DeploymentFqn, Fqn, RelationId, ViewChange, ViewId } from '@likec4/core'
import stripIndent from 'strip-indent'
import { describe, expect, it, vi } from 'vitest'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const dsl = (text: string) => stripIndent(text).trimStart().trimEnd() + '\n'

const apply = (viewId: string, change: ViewChange) => ({ viewId: viewId as ViewId, change })

const exclude = (viewId: string, ...targets: ViewChange.ExcludeTarget[]) =>
  apply(viewId, { op: 'exclude-from-view', targets: targets as [ViewChange.ExcludeTarget] })

const node = (fqn: string): ViewChange.ExcludeTarget => ({ node: fqn as Fqn })

const modelFile = `
  specification {
    element system
    deploymentNode vm
  }
  model {
    cloud = system 'Cloud' {
      api = system 'API'
      db = system 'DB'
      api -> db
    }
  }
  deployment {
    prod = vm {
      eu = vm
    }
  }
`

describe('exclude-from-view', () => {
  const views = `
    views {
      view index {
        include *, cloud.*
      }
      deployment view prod {
        include prod.**
      }
      dynamic view flow {
        cloud.api -> cloud.db
      }
    }
  `

  it('UT-110 + UT-111 + UT-112: appends one exclude per target, the model is unchanged', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': views })
    const modelBefore = ws.read('model.c4')
    const res = await ws.apply(exclude(
      'index',
      node('cloud.db'),
      { edge: { source: 'cloud.api' as Fqn, target: 'cloud.db' as Fqn } },
      node('cloud'),
    ))
    expect(res).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toBe(modelBefore)
    expect(ws.read('views.c4')).toContain(
      dsl(`
      view index {
        include *, cloud.*
        exclude cloud.db
        exclude cloud.api -> cloud.db
        exclude cloud
      }
    `).replaceAll('\n', '\n  ').trimEnd(),
    )
  })

  it('UT-113: excludes deployment elements in deployment views', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': views })
    await ws.apply(exclude('prod', { node: 'prod.eu' as DeploymentFqn }))
    expect(ws.read('views.c4')).toContain(`    include prod.**\n    exclude prod.eu\n`)
  })

  it('rejects dynamic views', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': views })
    expect(await ws.apply(exclude('flow', node('cloud.db')))).toMatchObject({
      success: false,
      code: 'unsupported-in-view',
    })
  })

  it('IT-006: the excluded element disappears from the view, not from the model', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': views })
    await ws.apply(exclude('index', node('cloud.db')))
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    expect(model.view('index' as ViewId).$view.nodes.map(n => n.id)).not.toContain('cloud.db')
    expect(model.findElement('cloud.db')).not.toBeNull()
  })
})

describe('delete-from-model', () => {
  const deleteElement = (fqn: string) => apply('index', { op: 'delete-from-model', target: { element: fqn as Fqn } })
  const views = `
    views {
      view index {
        include *
      }
    }
  `

  it('UT-120: refuses while the element is referenced', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          legacy = system 'Legacy'
          web = system 'Web'
        }
      `,
      'relations.c4': `
        model {
          web -> legacy
        }
      `,
      'views.c4': views,
    })
    const before = ws.read('model.c4')
    expect(await ws.apply(deleteElement('legacy'))).toEqual({
      success: false,
      code: 'has-references',
      error: 'Element "legacy" is referenced in 1 place: relations.c4:2',
    })
    expect(ws.read('model.c4')).toBe(before)
  })

  it('UT-120: refuses while the element has nested entries', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': views })
    expect(await ws.apply(deleteElement('cloud'))).toMatchObject({ success: false, code: 'has-references' })
  })

  it('UT-121: removes the whole definition, keeping the comment above and a single blank line', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          web = system 'Web'

          // legacy system
          legacy = system 'Legacy' {
            description 'old'
          }

          api = system 'API'
        }
      `,
      'views.c4': views,
    })
    expect(await ws.apply(deleteElement('legacy'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toBe(dsl(`
      specification { element system }
      model {
        web = system 'Web'

        // legacy system

        api = system 'API'
      }
    `))
  })

  it('UT-122: removes a relation statement', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'views.c4': views })
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    const relation = [...model.relationships()].find(r => r.source.id === 'cloud.api')!
    const res = await ws.apply(apply('index', {
      op: 'delete-from-model',
      target: { relation: relation.id as RelationId },
    }))
    expect(res).toMatchObject({ success: true })
    expect(ws.read('model.c4')).not.toContain('api -> db')
    expect(ws.read('model.c4')).toContain(`    db = system 'DB'\n  }\n`)
  })

  it('UT-123: rechecks references on the server (view rules count)', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          legacy = system 'Legacy'
        }
      `,
      'views.c4': `
        views {
          view index {
            include legacy
          }
        }
      `,
    })
    expect(await ws.apply(deleteElement('legacy'))).toEqual({
      success: false,
      code: 'has-references',
      error: 'Element "legacy" is referenced in 1 place: views.c4:3',
    })
  })

  it('removes an unreferenced element', async () => {
    const ws = await memfsWorkspace({
      'model.c4': `
        specification { element system }
        model {
          web = system 'Web'
          legacy = system 'Legacy'
        }
      `,
      'views.c4': views,
    })
    expect(await ws.apply(deleteElement('legacy'))).toMatchObject({ success: true })
    expect(ws.read('model.c4')).toBe(dsl(`
      specification { element system }
      model {
        web = system 'Web'
      }
    `))
  })
})
