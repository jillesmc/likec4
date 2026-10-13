import { useState } from 'react'

/**
 * Action for a key pressed in the title input
 */
export function titleKeyAction(key: string, title: string): 'confirm' | 'cancel' | null {
  switch (true) {
    case key === 'Escape':
      return 'cancel'
    case key === 'Enter' && title.trim().length > 0:
      return 'confirm'
    default:
      return null
  }
}

/**
 * Asks the title of the element dropped on the canvas
 */
export function DropPopover({ kind, initialTitle = `New ${kind}`, onConfirm, onCancel }: {
  kind: string
  initialTitle?: string
  onConfirm: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const isValid = title.trim().length > 0
  return (
    <div
      data-likec4-drop-popover
      className="nodrag nopan nowheel"
      style={{
        display: 'flex',
        gap: 4,
        padding: 6,
        borderRadius: 6,
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        boxShadow: 'var(--mantine-shadow-md)',
      }}>
      <input
        aria-label={`Title of the new ${kind}`}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          e.stopPropagation()
          const action = titleKeyAction(e.key, title)
          if (action === 'confirm') onConfirm(title.trim())
          if (action === 'cancel') onCancel()
        }}
        style={{ width: 180, fontSize: 13, padding: '2px 6px' }}
      />
      <button type="button" disabled={!isValid} onClick={() => onConfirm(title.trim())}>Add</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  )
}
