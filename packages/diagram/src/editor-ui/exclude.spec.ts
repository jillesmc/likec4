import { describe, expect, it } from 'vitest'
import { excludeChangeOf } from './exclude'

const node = (id: string, modelFqn = id) => ({ id, type: 'element', data: { modelFqn } })
const nodes = new Map([node('a'), node('b')].map(n => [n.id, n]))

describe('excludeChangeOf', () => {
  it('excludes nodes and edges', () => {
    expect(excludeChangeOf('element', [node('a')], [{ source: 'a', target: 'b' }], id => nodes.get(id))).toEqual({
      op: 'exclude-from-view',
      targets: [{ node: 'a' }, { edge: { source: 'a', target: 'b' } }],
    })
  })

  it('UT-063: does nothing in dynamic views', () => {
    expect(excludeChangeOf('dynamic', [node('a')], [], id => nodes.get(id))).toBeNull()
  })

  it('does nothing without model elements', () => {
    expect(excludeChangeOf('element', [{ type: 'view-group', data: {} }], [], () => undefined)).toBeNull()
  })
})
