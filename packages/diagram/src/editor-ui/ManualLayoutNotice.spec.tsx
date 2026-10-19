import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ElementPalette } from './ElementPalette'
import { MANUAL_LAYOUT_NOTICE, takeManualLayoutToast } from './ManualLayoutNotice'

const items = [{ kind: 'system', label: 'system' }]

describe('manual layout notice', () => {
  it('UT-250: the palette shows the notice in views with manual layout only', () => {
    const manual = renderToStaticMarkup(
      <ElementPalette title="Elements" emptyMessage="" items={items} notice={MANUAL_LAYOUT_NOTICE} />,
    )
    expect(manual).toContain(MANUAL_LAYOUT_NOTICE)
    const auto = renderToStaticMarkup(<ElementPalette title="Elements" emptyMessage="" items={items} />)
    expect(auto).not.toContain('data-likec4-palette-notice')
  })

  it('UT-251: the toast is shown on the first drop in a manual layout view only', () => {
    const shown = new Set<string>()
    expect(takeManualLayoutToast(shown, 'index', true)).toBe(true)
    expect(takeManualLayoutToast(shown, 'index', true)).toBe(false)
    // another view gets its own toast
    expect(takeManualLayoutToast(shown, 'landscape', true)).toBe(true)
  })

  it('UT-251: no toast with auto layout', () => {
    expect(takeManualLayoutToast(new Set(), 'index', false)).toBe(false)
  })
})
