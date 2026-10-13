import { describe, expect, it } from 'vitest'
import { innermostNode, resolveConnection, titleTargetOf } from './connect'

const node = (modelFqn: string, type = 'element', size = 100) => ({
  type,
  data: { modelFqn },
  measured: { width: size, height: size },
})

describe('resolveConnection', () => {
  it('creates add-relation between two elements', () => {
    expect(resolveConnection(node('a'), node('b'))).toEqual({ op: 'add-relation', source: 'a', target: 'b' })
  })

  it('accepts compound elements', () => {
    expect(resolveConnection(node('a', 'compound-element'), node('b'))).toEqual({
      op: 'add-relation',
      source: 'a',
      target: 'b',
    })
  })

  it('UT-060: ignores connection to itself', () => {
    expect(resolveConnection(node('a'), node('a'))).toBeNull()
  })

  it('UT-060: ignores connection without target (released on empty canvas)', () => {
    expect(resolveConnection(node('a'), null)).toBeNull()
  })

  it('UT-060: ignores nodes that are not model elements', () => {
    expect(resolveConnection(node('a'), node('g', 'view-group'))).toBeNull()
    expect(resolveConnection(node('a'), { type: 'element', data: {} })).toBeNull()
  })
})

describe('innermostNode', () => {
  it('returns the smallest node', () => {
    const outer = node('cloud', 'compound-element', 500)
    const inner = node('cloud.api', 'element', 100)
    expect(innermostNode([outer, inner])).toBe(inner)
    expect(innermostNode([])).toBeNull()
  })
})

describe('titleTargetOf', () => {
  it('uses the model element in element views', () => {
    expect(titleTargetOf(node('cloud.api'))).toBe('cloud.api')
  })

  it('uses the deployment element in deployment views', () => {
    expect(titleTargetOf({ type: 'deployment', data: { deploymentFqn: 'prod.vm', modelFqn: 'cloud.api' } })).toBe(
      'prod.vm',
    )
  })

  it('returns null for other nodes', () => {
    expect(titleTargetOf({ type: 'view-group', data: {} })).toBeNull()
  })
})
