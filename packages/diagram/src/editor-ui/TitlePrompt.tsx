import { type KeyboardEvent, useState } from 'react'
import { identifierError, shownIdentifier } from './identifier'

/**
 * Action for a key pressed in the title input
 */
export function titleKeyAction(
  key: string,
  title: string,
  options?: readonly string[],
  identifierValid = true,
  allowEmpty = false,
): 'confirm' | 'cancel' | null {
  switch (true) {
    case key === 'Escape':
      return 'cancel'
    case key === 'Enter' && identifierValid && isValidValue(title, options, allowEmpty):
      return 'confirm'
    default:
      return null
  }
}

/**
 * A non-empty value, one of the options when they are given
 */
function isValidValue(value: string, options?: readonly string[], allowEmpty = false): boolean {
  const trimmed = value.trim()
  return (allowEmpty || trimmed.length > 0) && (!options || options.includes(trimmed))
}

let promptSeq = 0

/**
 * Identifier field of the prompt
 */
export type IdentifierField = {
  label: string
  /**
   * Suggested identifier for the value, followed until the user types one
   */
  suggest: (value: string) => string
  /**
   * Names taken by the siblings
   */
  taken: ReadonlySet<string>
}

/**
 * Inline prompt for a value: Enter confirms a non-empty value, Escape cancels.
 * With `options`, the value must be one of them (suggested while typing).
 * With `identifier`, also asks for the identifier, prefilled with the suggestion:
 * Enter accepts it, typing in the field (its text is selected on focus) replaces it.
 */
export function TitlePrompt(
  { label, initialTitle, confirmLabel, options, identifier, allowEmpty = false, onConfirm, onCancel }: {
    label: string
    initialTitle: string
    confirmLabel: string
    options?: readonly string[]
    identifier?: IdentifierField
    /**
     * An empty value is accepted (e.g. removes the title of a relation)
     */
    allowEmpty?: boolean
    onConfirm: (title: string, name?: string) => void
    onCancel: () => void
  },
) {
  const [title, setTitle] = useState(initialTitle)
  // Identifier typed by the user, empty while following the suggestion
  const [typedName, setTypedName] = useState('')
  const [listId] = useState(() => `likec4-title-prompt-options-${++promptSeq}`)
  const name = identifier ? shownIdentifier(typedName, identifier.suggest(title.trim())) : undefined
  const nameError = identifier && name !== undefined ? identifierError(name, identifier.taken) : null
  const isValid = isValidValue(title, options, allowEmpty) && nameError === null
  const confirm = () => onConfirm(title.trim(), name)
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    const action = titleKeyAction(e.key, title, options, nameError === null, allowEmpty)
    if (action === 'confirm') confirm()
    if (action === 'cancel') onCancel()
  }
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
        onKeyDown={onKeyDown}
        style={{
          width: 180,
          fontSize: 13,
          padding: '2px 6px',
          outlineColor: isValidValue(title, options, allowEmpty) ? undefined : 'var(--mantine-color-red-6)',
        }}
      />
      {identifier && (
        <input
          aria-label={identifier.label}
          aria-invalid={nameError !== null}
          title={nameError ?? undefined}
          value={name}
          onChange={e => setTypedName(e.target.value)}
          onFocus={e => e.target.select()}
          onKeyDown={onKeyDown}
          style={{
            width: 140,
            fontSize: 13,
            fontFamily: 'var(--mantine-font-family-monospace)',
            padding: '2px 6px',
            outlineColor: nameError ? 'var(--mantine-color-red-6)' : undefined,
          }}
        />
      )}
      {nameError && (
        <span role="alert" style={{ alignSelf: 'center', fontSize: 12, color: 'var(--mantine-color-red-6)' }}>
          {nameError}
        </span>
      )}
      {options && (
        <datalist id={listId}>
          {options.map(option => <option key={option} value={option} />)}
        </datalist>
      )}
      <button type="button" disabled={!isValid} onClick={confirm}>{confirmLabel}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  )
}
