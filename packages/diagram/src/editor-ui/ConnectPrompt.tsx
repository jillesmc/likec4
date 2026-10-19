import type { XYPoint } from '@likec4/core/geometry'
import type { RelationshipKind, ViewChange } from '@likec4/core/types'
import { ViewportPortal } from '@xyflow/react'
import { type KeyboardEvent, type ReactNode, useState } from 'react'

export type ConnectValues = {
  title: string
  kind: string
  technology: string
}

/**
 * The relation to create, with only the filled values
 */
export function connectChange(
  base: ViewChange.AddRelation,
  values: ConnectValues,
  kinds: readonly RelationshipKind[],
): ViewChange.AddRelation {
  const title = values.title.trim()
  const technology = values.technology.trim()
  const kind = kinds.find(k => k === values.kind)
  return {
    op: 'add-relation',
    source: base.source,
    target: base.target,
    ...title && { title },
    ...kind && { kind },
    ...technology && { technology },
  }
}

const inputStyle = { width: 150, fontSize: 13, padding: '2px 6px' }

/**
 * Prompt shown after connecting two elements: title, kind and technology, all optional.
 * Enter confirms with what is filled, Escape cancels.
 */
export function ConnectPrompt({ kinds, onConfirm, onCancel }: {
  /**
   * Relationship kinds declared in the specification
   */
  kinds: readonly RelationshipKind[]
  onConfirm: (values: ConnectValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<ConnectValues>({ title: '', kind: '', technology: '' })
  const set = (key: keyof ConnectValues) => (e: { target: { value: string } }) =>
    setValues(v => ({ ...v, [key]: e.target.value }))
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    switch (e.key) {
      case 'Enter':
        onConfirm(values)
        break
      case 'Escape':
        onCancel()
        break
    }
  }
  return (
    <div
      data-likec4-connect-prompt
      className="nodrag nopan nowheel"
      onKeyDown={onKeyDown}
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
        aria-label="Relation title"
        placeholder="Title"
        autoFocus
        value={values.title}
        onChange={set('title')}
        style={inputStyle} />
      {kinds.length > 0 && (
        <select aria-label="Relation kind" value={values.kind} onChange={set('kind')} style={{ fontSize: 13 }}>
          <option value="">no kind</option>
          {kinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      )}
      <input
        aria-label="Relation technology"
        placeholder="Technology"
        value={values.technology}
        onChange={set('technology')}
        style={inputStyle} />
      <button type="button" onClick={() => onConfirm(values)}>Connect</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  )
}

/**
 * Asks for the details of a relation created by connecting two elements,
 * at the point where the connection was released
 */
export function useConnectPrompt(
  kinds: readonly RelationshipKind[],
  onAdd: (change: ViewChange.AddRelation) => void,
): {
  open: (change: ViewChange.AddRelation, position: XYPoint) => void
  prompt: ReactNode
} {
  const [pending, setPending] = useState<{ change: ViewChange.AddRelation; position: XYPoint } | null>(null)
  const prompt = pending && (
    <ViewportPortal>
      <div style={{ position: 'absolute', transform: `translate(${pending.position.x}px, ${pending.position.y}px)` }}>
        <ConnectPrompt
          kinds={kinds}
          onCancel={() => setPending(null)}
          onConfirm={values => {
            setPending(null)
            onAdd(connectChange(pending.change, values, kinds))
          }}
        />
      </div>
    </ViewportPortal>
  )
  return { open: (change, position) => setPending({ change, position }), prompt }
}
