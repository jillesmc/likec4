import type { DeploymentFqn, DeploymentKind, Fqn, ViewChange, ViewId } from '@likec4/core'
import stripIndent from 'strip-indent'
import { describe, expect, it, vi } from 'vitest'
import { memfsWorkspace } from './__test__/memfsWorkspace'

vi.mock('node:fs')
vi.mock('node:fs/promises')

const dsl = (text: string) => stripIndent(text).trimStart().trimEnd() + '\n'

const apply = (change: ViewChange, viewId = 'prod') => ({ viewId: viewId as ViewId, change })

const addNode = (parent: string | null, kind: string, title: string) =>
  apply({
    op: 'add-deployment-node',
    parent: parent as DeploymentFqn | null,
    kind: kind as DeploymentKind,
    title,
  })

const addInstance = (parent: string, element: string) =>
  apply({ op: 'add-instance', parent: parent as DeploymentFqn, element: element as Fqn })

const modelFile = `
  specification {
    element service
    deploymentNode env
    deploymentNode vm
  }
  model {
    cloud = service 'Cloud' {
      api = service 'API'
    }
  }
`

describe('add-deployment-node', () => {
  it('UT-140: writes the node inside the parent node block', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'deployment.c4': `
        deployment {
          prod = env 'Prod' {
            eu = env 'EU'
          }
        }
        views {
          deployment view prod {
            include prod.**
          }
        }
      `,
    })
    expect(await ws.apply(addNode('prod.eu', 'vm', 'Worker'))).toMatchObject({ success: true })
    expect(ws.read('deployment.c4')).toContain(dsl(`
      deployment {
        prod = env 'Prod' {
          eu = env 'EU' {
            worker = vm 'Worker'
          }
        }
      }
    `))
  })

  it('UT-141: creates the deployment block in the view file when missing, and includes the node', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          deployment view prod {
            include prod.**
          }
        }
      `,
    })
    expect(await ws.apply(addNode(null, 'env', 'Staging'))).toMatchObject({ success: true })
    expect(ws.read('views.c4')).toBe(dsl(`
      views {
        deployment view prod {
          include prod.**
          include staging
        }
      }

      deployment {
        staging = env 'Staging'
      }
    `))
  })

  it('UT-142: rejects unknown deployment node kind', async () => {
    const ws = await memfsWorkspace({
      'model.c4': modelFile,
      'views.c4': `
        views {
          deployment view prod {
            include prod.**
          }
        }
      `,
    })
    expect(await ws.apply(addNode(null, 'server', 'X'))).toEqual({
      success: false,
      code: 'unknown-kind',
      error: 'Unknown deployment node kind "server"',
    })
  })
})

describe('add-instance', () => {
  const deployment = `
    deployment {
      prod = env 'Prod' {
        worker = vm 'Worker'
      }
    }
    views {
      deployment view prod {
        include prod.**
      }
    }
  `

  it('UT-143: writes instanceOf inside the node', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'deployment.c4': deployment })
    expect(await ws.apply(addInstance('prod.worker', 'cloud.api'))).toMatchObject({ success: true })
    expect(ws.read('deployment.c4')).toContain(`    worker = vm 'Worker' {\n      instanceOf cloud.api\n    }\n`)
    const model = await ws.services.likec4.ModelBuilder.computeModel()
    expect(model.view('prod' as ViewId).$view.nodes.map(n => n.id)).toContain('prod.worker.api')
  })

  it('UT-144: names the second instance of the same element', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'deployment.c4': deployment })
    await ws.apply(addInstance('prod.worker', 'cloud.api'))
    await ws.apply(addInstance('prod.worker', 'cloud.api'))
    expect(ws.read('deployment.c4')).toContain(`      instanceOf cloud.api\n      api2 = instanceOf cloud.api\n`)
  })

  it('UT-145: rejects missing element', async () => {
    const ws = await memfsWorkspace({ 'model.c4': modelFile, 'deployment.c4': deployment })
    expect(await ws.apply(addInstance('prod.worker', 'cloud.db'))).toEqual({
      success: false,
      code: 'not-found',
      error: 'Element "cloud.db" not found',
    })
  })

  it('rejects in element views', async () => {
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
    expect(
      await ws.apply(apply({ op: 'add-instance', parent: 'prod' as DeploymentFqn, element: 'cloud' as Fqn }, 'index')),
    )
      .toMatchObject({ success: false, code: 'unsupported-in-view' })
  })
})
