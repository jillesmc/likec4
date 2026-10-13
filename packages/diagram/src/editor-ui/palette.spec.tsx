import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DropPopover, titleKeyAction } from './DropPopover'
import { ElementPalette } from './ElementPalette'

describe('ElementPalette', () => {
  it('UT-070: lists element kinds in the given order', () => {
    const html = renderToStaticMarkup(<ElementPalette kinds={['actor', 'system', 'service']} />)
    const kinds = [...html.matchAll(/data-likec4-palette-kind="([^"]+)"/g)].map(m => m[1])
    expect(kinds).toEqual(['actor', 'system', 'service'])
  })

  it('UT-071: shows empty state without kinds', () => {
    const html = renderToStaticMarkup(<ElementPalette kinds={[]} />)
    expect(html).toContain('No element kinds in specification')
    expect(html).not.toContain('data-likec4-palette-kind')
  })
})

describe('DropPopover', () => {
  const noop = () => {}

  it('UT-072: disables confirm when the title is empty', () => {
    const html = renderToStaticMarkup(<DropPopover kind="system" initialTitle="  " onConfirm={noop} onCancel={noop} />)
    expect(html).toMatch(/<button type="button" disabled="">Add<\/button>/)
  })

  it('prefills the title with the kind', () => {
    const html = renderToStaticMarkup(<DropPopover kind="system" onConfirm={noop} onCancel={noop} />)
    expect(html).toContain('value="New system"')
  })

  it('UT-072: Escape cancels, Enter confirms only a non-empty title', () => {
    expect(titleKeyAction('Escape', 'Billing')).toBe('cancel')
    expect(titleKeyAction('Enter', 'Billing')).toBe('confirm')
    expect(titleKeyAction('Enter', '   ')).toBeNull()
    expect(titleKeyAction('a', 'Billing')).toBeNull()
  })
})
