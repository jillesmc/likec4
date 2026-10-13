import { useState } from 'react'

/**
 * Action for a key pressed in the title input
 */
export function titleKeyAction(
  key: string,
  title: string,
  options?: readonly string[],
): 'confirm' | 'cancel' | null {
  switch (true) {
    case key === 'Escape':
      return 'cancel'
    case key === 'Enter' && isValidValue(title, options):
      return 'confirm'
    default:
      return null
  }
}

/**
 * A non-empty value, one of the options when they are given
 */
function isValidValue(value: string, options?: readonly string[]): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && (!options || options.includes(trimmed))
}

let promptSeq = 0

/**
 * Inline prompt for a value: Enter confirms a non-empty value, Escape cancels.
 * With `options`, the value must be one of them (suggested while typing).
 */
export function TitlePrompt({ label, initialTitle, confirmLabel, options, onConfirm, onCancel }: {
  label: string
  initialTitle: string
  confirmLabel: string
  options?: readonly string[]
  onConfirm: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initialTitle)
  const [listId] = useState(() => `likec4-title-prompt-options-${++promptSeq}`)
  const isValid = isValidValue(title, options)
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
        {...options && { list: listId }}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onFocus={e => e.target.select()}
        onKeyDown={e => {
          e.stopPropagation()
          const action = titleKeyAction(e.key, title, options)
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
      {options && (
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
      )}
      <button type="button" disabled={!isValid} onClick={() => onConfirm(title.trim())}>{confirmLabel}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  )
}
