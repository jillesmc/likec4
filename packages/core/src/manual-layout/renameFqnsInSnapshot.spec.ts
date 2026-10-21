import { indexBy } from 'remeda'
import { describe, expect, it } from 'vitest'
import { prepareFixtures } from './__test__/fixture'
import { calcDriftsFromSnapshot } from './calcDriftsFromSnapshot'
import { renameFqnsInSnapshot } from './renameFqnsInSnapshot'

const elements = new Map([['saas', 'platform']])

describe('renameFqnsInSnapshot', () => {
  it('UT-040: maps node ids, parents, children, model refs and edge ends, exact and as prefix', () => {
    const { snapshot } = prepareFixtures()
    const renamed = renameFqnsInSnapshot(snapshot, { elements })
    const nodes: Record<string, (typeof renamed.nodes)[number]> = indexBy(renamed.nodes, n => n.id)

    expect(Object.keys(nodes).sort()).toEqual(['customer', 'platform', 'platform.api', 'platform.frontend'])
    expect(nodes['platform']).toMatchObject({
      modelRef: 'platform',
      children: ['platform.frontend', 'platform.api'],
    })
    expect(nodes['platform.api']).toMatchObject({ parent: 'platform', modelRef: 'platform.api' })
    expect(nodes['customer']).toBe(snapshot.nodes.find(n => n.id === 'customer'))
    expect(renamed.edges.map(e => [e.id, e.source, e.target])).toEqual([
      ['edge1', 'customer', 'platform.frontend'],
      ['edge2', 'platform.frontend', 'platform.api'],
    ])
  })

  it('UT-040: leaves ids that only share a prefix, and returns the same snapshot when nothing changes', () => {
    const { snapshot } = prepareFixtures()
    // `saas.api` must not match `saas.apiX`, and `sa` must not match `saas`
    expect(renameFqnsInSnapshot(snapshot, { elements: new Map([['sa', 'x'], ['saas.apiX', 'y']]) })).toBe(snapshot)
    // element renames do not apply to deployment ids and vice versa
    expect(renameFqnsInSnapshot(snapshot, { deployments: elements })).toBe(snapshot)
  })

  it('UT-041: the renamed snapshot matches the view computed with the new names (no drift)', () => {
    const { snapshot, layouted } = prepareFixtures()
    // the recomputed view has the new ids
    const recomputed = renameFqnsInSnapshot(layouted, { elements })
    const result = calcDriftsFromSnapshot(recomputed, renameFqnsInSnapshot(snapshot, { elements }))
    expect(result.drifts).toBeUndefined()
    // without the rename the snapshot drifts
    expect(calcDriftsFromSnapshot(recomputed, snapshot).drifts).toBeDefined()
  })
})
