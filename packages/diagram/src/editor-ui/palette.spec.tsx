import { RelationId } from '@likec4/core/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ElementPalette } from './ElementPalette'
import { titleKeyAction, TitlePrompt } from './TitlePrompt'
import { relationTitleTargetOf } from './useTitleEditing'

describe('ElementPalette', () => {
  it('UT-070: lists element kinds in the given order', () => {
    const html = renderToStaticMarkup(
      <ElementPalette
        title="Elements"
        emptyMessage="No element kinds in specification"
        items={['actor', 'system', 'service'].map(kind => ({ kind, label: kind }))}
      />,
    )
    const kinds = [...html.matchAll(/data-likec4-palette-kind="([^"]+)"/g)].map(m => m[1])
    expect(kinds).toEqual(['actor', 'system', 'service'])
  })

  it('UT-071: shows empty state without kinds', () => {
    const html = renderToStaticMarkup(
      <ElementPalette title="Elements" emptyMessage="No element kinds in specification" items={[]} />,
    )
    expect(html).toContain('No element kinds in specification')
    expect(html).not.toContain('data-likec4-palette-kind')
  })
})

describe('TitlePrompt', () => {
  const noop = () => {}

  it('UT-072: disables confirm when the title is empty', () => {
    const html = renderToStaticMarkup(
      <TitlePrompt label="Title" initialTitle="  " confirmLabel="Add" onConfirm={noop} onCancel={noop} />,
    )
    expect(html).toMatch(/<button type="button" disabled="">Add<\/button>/)
  })

  it('prefills the title', () => {
    const html = renderToStaticMarkup(
      <TitlePrompt label="Title" initialTitle="New system" confirmLabel="Add" onConfirm={noop} onCancel={noop} />,
    )
    expect(html).toContain('value="New system"')
  })

  it('UT-072 + US-003 EC-2: Escape cancels, Enter confirms only a non-empty title', () => {
    expect(titleKeyAction('Escape', 'Billing')).toBe('cancel')
    expect(titleKeyAction('Enter', 'Billing')).toBe('confirm')
    expect(titleKeyAction('Enter', '   ')).toBeNull()
    expect(titleKeyAction('a', 'Billing')).toBeNull()
  })

  it('with options, accepts only one of them', () => {
    expect(titleKeyAction('Enter', 'cloud.api', ['cloud.api'])).toBe('confirm')
    expect(titleKeyAction('Enter', 'cloud.db', ['cloud.api'])).toBeNull()
  })
})

describe('relation title', () => {
  it('UT-225: only an edge of a single relation offers the title editor', () => {
    expect(relationTitleTargetOf([RelationId('r1')])).toBe('r1')
    expect(relationTitleTargetOf([RelationId('r1'), RelationId('r2')])).toBeNull()
    expect(relationTitleTargetOf([])).toBeNull()
  })

  it('UT-223 (canvas): an empty title is accepted for relations only', () => {
    expect(titleKeyAction('Enter', '', undefined, true, true)).toBe('confirm')
    expect(titleKeyAction('Enter', '')).toBeNull()
  })
})
