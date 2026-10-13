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
 * Inline prompt for a title: Enter confirms a non-empty title, Escape cancels
 */
export function TitlePrompt({ label, initialTitle, confirmLabel, onConfirm, onCancel }: {
  label: string
  initialTitle: string
  confirmLabel: string
  onConfirm: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const isValid = title.trim().length > 0
  return (
    <div
      data-likec4-title-prompt
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
        aria-label={label}
        aria-invalid={!isValid}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onFocus={e => e.target.select()}
        onKeyDown={e => {
          e.stopPropagation()
          const action = titleKeyAction(e.key, title)
          if (action === 'confirm') onConfirm(title.trim())
          if (action === 'cancel') onCancel()
        }}
        style={{
          width: 180,
          fontSize: 13,
          padding: '2px 6px',
          outlineColor: isValid ? undefined : 'var(--mantine-color-red-6)',
        }}
      />
      <button type="button" disabled={!isValid} onClick={() => onConfirm(title.trim())}>{confirmLabel}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  )
}
