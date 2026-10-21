import type { XYPoint } from '@likec4/core/geometry'
import type { RelationshipKind, ViewChange } from '@likec4/core/types'
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import { PromptPortal } from './PromptPortal'
import type { StepPosition } from './steps'

export type ConnectValues = {
  title: string
  kind: string
  technology: string
  /**
   * Step to insert before, empty for "At the end"
   */
  position: string
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

/**
 * The step to add, with the title and position when given
 */
export function stepChange(
  base: ViewChange.AddDynamicStep,
  values: ConnectValues,
  positions: readonly StepPosition[],
): ViewChange.AddDynamicStep {
  const title = values.title.trim()
  const before = positions.find(p => p.step === values.position)
  return {
    op: 'add-dynamic-step',
    source: base.source,
    target: base.target,
    ...title && { title },
    ...before && { beforeStep: before.step },
  }
}

const inputStyle = { width: 150, fontSize: 13, padding: '2px 6px' }

/**
 * Prompt shown after connecting two elements, all fields optional:
 * - relations: title, kind and technology
 * - dynamic steps: title and position
 * Enter confirms with what is filled, Escape cancels.
 */
export function ConnectPrompt({ kinds, positions, onConfirm, onCancel }: {
  /**
   * Relationship kinds declared in the specification (relations)
   */
  kinds: readonly RelationshipKind[]
  /**
   * Where a step can be inserted; given only for dynamic steps
   */
  positions?: readonly StepPosition[] | undefined
  onConfirm: (values: ConnectValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<ConnectValues>({ title: '', kind: '', technology: '', position: '' })
  const set = (key: keyof ConnectValues) => (e: { target: { value: string } }) =>
    setValues(v => ({ ...v, [key]: e.target.value }))
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    switch (true) {
      case e.key === 'Escape':
        onCancel()
        break
      // a focused button keeps its own action (Enter clicks it)
      case e.key === 'Enter' && !(e.target instanceof HTMLButtonElement):
        onConfirm(values)
        break
    }
  }
  const isStep = positions !== undefined
  return (
    <div
      data-likec4-connect-prompt
      className="nodrag nopan nowheel"
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        // wraps in a narrow window
        flexWrap: 'wrap',
        maxWidth: 340,
        gap: 4,
        padding: 6,
        borderRadius: 6,
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        boxShadow: 'var(--mantine-shadow-md)',
      }}>
      <input
        aria-label={isStep ? 'Step title' : 'Relation title'}
        placeholder="Title"
        autoFocus
        value={values.title}
        onChange={set('title')}
        style={inputStyle} />
      {!isStep && kinds.length > 0 && (
        <select aria-label="Relation kind" value={values.kind} onChange={set('kind')} style={{ fontSize: 13 }}>
          <option value="">no kind</option>
          {kinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      )}
      {!isStep && (
        <input
          aria-label="Relation technology"
          placeholder="Technology"
          value={values.technology}
          onChange={set('technology')}
          style={inputStyle} />
      )}
      {isStep && positions.length > 0 && (
        <select aria-label="Step position" value={values.position} onChange={set('position')} style={{ fontSize: 13 }}>
          <option value="">At the end</option>
          {positions.map(p => <option key={p.step} value={p.step}>{p.label}</option>)}
        </select>
      )}
      <button type="button" onClick={() => onConfirm(values)}>{isStep ? 'Add step' : 'Connect'}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  )
}

type Pending =
  | { change: ViewChange.AddRelation; position: XYPoint }
  | { change: ViewChange.AddDynamicStep; position: XYPoint; positions: readonly StepPosition[] }

/**
 * Asks for the details of a relation (or a dynamic step) created by connecting two elements,
 * at the point where the connection was released
 */
export function useConnectPrompt(
  kinds: readonly RelationshipKind[],
  onAdd: (change: ViewChange.AddRelation | ViewChange.AddDynamicStep) => void,
): {
  open: (pending: Pending) => void
  close: () => void
  prompt: ReactNode
} {
  const [pending, setPending] = useState<Pending | null>(null)
  const prompt = pending && (
    <PromptPortal position={pending.position}>
      <ConnectPrompt
        kinds={kinds}
        positions={'positions' in pending ? pending.positions : undefined}
        onCancel={() => setPending(null)}
        onConfirm={values => {
          setPending(null)
          onAdd(
            'positions' in pending
              ? stepChange(pending.change, values, pending.positions)
              : connectChange(pending.change, values, kinds),
          )
        }}
      />
    </PromptPortal>
  )
  return { open: setPending, close: () => setPending(null), prompt }
}
