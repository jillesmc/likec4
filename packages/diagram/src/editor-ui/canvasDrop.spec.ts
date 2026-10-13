import { Builder } from '@likec4/core/builder'
import { describe, expect, it } from 'vitest'
import { canvasPalette } from './palette'
import { deploymentNodeOf, INSTANCE_ITEM } from './useCanvasDrop'

describe('deploymentNodeOf', () => {
  it('returns deployment nodes, not instances', () => {
    expect(deploymentNodeOf({ type: 'compound-deployment', data: { deploymentFqn: 'prod', modelFqn: null } })).toBe(
      'prod',
    )
    expect(deploymentNodeOf({ type: 'deployment', data: { deploymentFqn: 'prod.api', modelFqn: 'cloud.api' } }))
      .toBeNull()
    expect(deploymentNodeOf({ type: 'element', data: { modelFqn: 'cloud' } })).toBeNull()
  })
})

describe('canvasPalette', () => {
  const { builder, model: { model, system } } = Builder.forSpecification({
    elements: { system: {} },
    deployments: { env: {}, vm: {} },
  })
  const likec4model = builder.with(model(system('cloud'))).toLikeC4Model()

  it('lists element kinds in element views', () => {
    expect(canvasPalette('element', likec4model)?.items).toEqual([{ kind: 'system', label: 'system' }])
  })

  it('UT-140 (canvas): lists deployment node kinds and "Instance" in deployment views', () => {
    const palette = canvasPalette('deployment', likec4model)
    expect(palette?.items).toEqual([
      { kind: 'env', label: 'env' },
      { kind: 'vm', label: 'vm' },
      { kind: INSTANCE_ITEM, label: 'Instance' },
    ])
    expect(palette?.config).toMatchObject({ viewType: 'deployment', elements: ['cloud'] })
  })

  it('no palette in dynamic views', () => {
    expect(canvasPalette('dynamic', likec4model)).toBeNull()
  })
})
