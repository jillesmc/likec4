import { type CSSProperties, type ReactNode, useState } from 'react'

/**
 * Drag data type carrying the element kind
 */
export const PALETTE_DRAG_TYPE = 'application/x-likec4-element-kind'

const panel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 8,
  minWidth: 140,
  maxHeight: '60vh',
  overflowY: 'auto',
  borderRadius: 6,
  background: 'var(--mantine-color-body)',
  border: '1px solid var(--mantine-color-default-border)',
  color: 'var(--mantine-color-text)',
  fontSize: 12,
}

const item: CSSProperties = {
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px dashed var(--mantine-color-default-border)',
  cursor: 'grab',
  userSelect: 'none',
}

export type PaletteItem = {
  /**
   * Dragged value (kind, or a special item)
   */
  kind: string
  label: string
}

const toggle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  opacity: 0.7,
  cursor: 'pointer',
}

/**
 * Kinds from the specification (and special items), dragged onto the canvas to create elements.
 * Collapsed by clicking its title, to free the canvas in a narrow window.
 */
export function ElementPalette({ title, items, emptyMessage, notice }: {
  title: string
  items: readonly PaletteItem[]
  emptyMessage: string
  /**
   * Shown under the title, e.g. that the view has a manual layout
   */
  notice?: string | undefined
}) {
  const [collapsed, setCollapsed] = useState(false)
  let content: ReactNode
  switch (true) {
    case collapsed:
      content = null
      break
    case items.length === 0:
      content = <div style={{ opacity: 0.7 }}>{emptyMessage}</div>
      break
    default:
      content = items.map(({ kind, label }) => (
        <div
          key={kind}
          data-likec4-palette-kind={kind}
          draggable
          style={item}
          onDragStart={e => {
            e.dataTransfer.setData(PALETTE_DRAG_TYPE, kind)
            e.dataTransfer.effectAllowed = 'copy'
          }}>
          {label}
        </div>
      ))
  }
  return (
    <div data-likec4-palette style={panel} className="nodrag nopan nowheel">
      <button
        type="button"
        style={toggle}
        aria-expanded={!collapsed}
        title={collapsed ? 'Show the palette' : 'Hide the palette'}
        onClick={() => setCollapsed(c => !c)}>
        <span>{title}</span>
        <span aria-hidden>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && notice && <div data-likec4-palette-notice style={{ maxWidth: 180, opacity: 0.7 }}>{notice}</div>}
      {content}
    </div>
  )
}
