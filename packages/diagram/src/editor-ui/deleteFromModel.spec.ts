import { Builder } from '@likec4/core/builder'
import { describe, expect, it } from 'vitest'
import { editorAffordances } from './affordances'
import { canDeleteFromModel, clientReferences } from './deleteFromModel'

describe('clientReferences', () => {
  const { builder, model: { model, system, rel } } = Builder.forSpecification({
    elements: { system: {} },
  })
  const likec4model = builder
    .with(
      model(
        system('web'),
        system('legacy').with(
          system('db'),
        ),
        system('unused'),
        rel('web', 'legacy'),
      ),
    )
    .toLikeC4Model()

  it('UT-073: lists relations and nested elements, which block the deletion', () => {
    expect(clientReferences(likec4model, 'legacy')).toEqual([
      'Relation web -> legacy',
      'Nested element legacy.db',
    ])
  })

  it('UT-073: an unreferenced element can be deleted', () => {
    expect(clientReferences(likec4model, 'unused')).toEqual([])
  })
})

describe('canDeleteFromModel', () => {
  it('UT-074: not offered for edges with more than one relation', () => {
    expect(canDeleteFromModel({ relations: ['r1'] })).toBe(true)
    expect(canDeleteFromModel({ relations: ['r1', 'r2'] })).toBe(false)
  })

  it('UT-074: not offered for elements from other projects', () => {
    expect(canDeleteFromModel({ element: 'cloud.api' })).toBe(true)
    expect(canDeleteFromModel({ element: '@shared.auth' })).toBe(false)
  })
})

describe('editorAffordances', () => {
  it('UT-064: nothing is editable when read-only or in the graph variant', () => {
    const none = { nodesConnectable: false, titlesEditable: false, itemsCreatable: false }
    expect(editorAffordances({ enableReadOnly: true, isGraphVariant: false, viewType: 'element' })).toEqual(none)
    expect(editorAffordances({ enableReadOnly: false, isGraphVariant: true, viewType: 'element' })).toEqual(none)
  })

  it('connecting only in element views, titles in element and deployment views', () => {
    expect(editorAffordances({ enableReadOnly: false, isGraphVariant: false, viewType: 'element' })).toEqual({
      nodesConnectable: true,
      titlesEditable: true,
      itemsCreatable: true,
    })
    expect(editorAffordances({ enableReadOnly: false, isGraphVariant: false, viewType: 'deployment' })).toEqual({
      nodesConnectable: false,
      titlesEditable: true,
      itemsCreatable: true,
    })
    expect(editorAffordances({ enableReadOnly: false, isGraphVariant: false, viewType: 'dynamic' })).toEqual({
      nodesConnectable: false,
      titlesEditable: false,
      itemsCreatable: false,
    })
  })
})
