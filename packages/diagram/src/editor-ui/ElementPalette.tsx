import type { CSSProperties } from 'react'

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

/**
 * Kinds from the specification (and special items), dragged onto the canvas to create elements
 */
export function ElementPalette({ title, items, emptyMessage }: {
  title: string
  items: readonly PaletteItem[]
  emptyMessage: string
}) {
  return (
    <div data-likec4-palette style={panel} className="nodrag nopan nowheel">
      <div style={{ fontWeight: 600, opacity: 0.7 }}>{title}</div>
      {items.length === 0
        ? <div style={{ opacity: 0.7 }}>{emptyMessage}</div>
        : items.map(({ kind, label }) => (
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
        ))}
    </div>
  )
}
