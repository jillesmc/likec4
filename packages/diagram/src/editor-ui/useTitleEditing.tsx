import type { XYPoint } from '@likec4/core/geometry'
import type { RelationId, ViewChange } from '@likec4/core/types'
import { type ReactNode, useState } from 'react'
import { useCallbackRef } from '../hooks/useCallbackRef'
import { useXYFlow } from '../hooks/useXYFlow'
import { type ConnectableNode, titleTargetOf } from './connect'
import { PromptPortal } from './PromptPortal'
import { TitlePrompt } from './TitlePrompt'

type Editing = {
  target: ViewChange.ChangeTitle['target']
  title: string
  center: XYPoint
}

/**
 * The relation whose title can be edited from an edge: only an edge of a single relation
 */
export function relationTitleTargetOf(relations: readonly RelationId[]): RelationId | null {
  return relations.length === 1 ? relations[0]! : null
}

/**
 * Double-click on a node (or a relation edge) edits its title in place
 */
export function useTitleEditing(onChange: (change: ViewChange.ChangeTitle) => void): {
  onNodeDoubleClick: (event: { stopPropagation: () => void }, node: ConnectableNode & { id: string }) => void
  editRelationTitle: (relation: RelationId, title: string, at: XYPoint) => void
  editor: ReactNode
} {
  const xyflow = useXYFlow()
  const [editing, setEditing] = useState<Editing | null>(null)

  const onNodeDoubleClick = useCallbackRef(
    (event: { stopPropagation: () => void }, node: ConnectableNode & { id: string }) => {
      const target = titleTargetOf(node)
      const internal = xyflow.getInternalNode(node.id)
      if (!target || !internal) {
        return
      }
      event.stopPropagation()
      const { x, y } = internal.internals.positionAbsolute
      const title = 'title' in node.data && typeof node.data.title === 'string' ? node.data.title : ''
      setEditing({
        target,
        title,
        center: {
          x: x + (internal.measured.width ?? 0) / 2,
          y: y + (internal.measured.height ?? 0) / 2,
        },
      })
    },
  )

  const editRelationTitle = useCallbackRef((relation: RelationId, title: string, at: XYPoint) => {
    setEditing({ target: { relation }, title, center: at })
  })

  const editor = editing && (
    <PromptPortal position={editing.center} centered>
      <TitlePrompt
        label="Title"
        initialTitle={editing.title}
        confirmLabel="Save"
        // an empty title removes the title of a relation
        allowEmpty={typeof editing.target === 'object'}
        onCancel={() => setEditing(null)}
        onConfirm={title => {
          setEditing(null)
          if (title !== editing.title) {
            onChange({ op: 'change-title', target: editing.target, title })
          }
        }}
      />
    </PromptPortal>
  )

  return { onNodeDoubleClick, editRelationTitle, editor }
}
