import type { DeploymentFqn, Fqn, ViewChange } from '@likec4/core/types'
import { ViewportPortal } from '@xyflow/react'
import { type ReactNode, useState } from 'react'
import { useCallbackRef } from '../hooks/useCallbackRef'
import { useXYFlow } from '../hooks/useXYFlow'
import { type ConnectableNode, titleTargetOf } from './connect'
import { TitlePrompt } from './TitlePrompt'

type Editing = {
  target: Fqn | DeploymentFqn
  title: string
  center: { x: number; y: number }
}

/**
 * Double-click on a node edits its title in place
 */
export function useTitleEditing(onChange: (change: ViewChange.ChangeTitle) => void): {
  onNodeDoubleClick: (event: { stopPropagation: () => void }, node: ConnectableNode & { id: string }) => void
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

  const editor = editing && (
    <ViewportPortal>
      <div
        style={{
          position: 'absolute',
          transform: `translate(${editing.center.x}px, ${editing.center.y}px) translate(-50%, -50%)`,
          zIndex: 1000,
        }}>
        <TitlePrompt
          label="Title"
          initialTitle={editing.title}
          confirmLabel="Save"
          onCancel={() => setEditing(null)}
          onConfirm={title => {
            setEditing(null)
            if (title !== editing.title) {
              onChange({ op: 'change-title', target: editing.target, title })
            }
          }}
        />
      </div>
    </ViewportPortal>
  )

  return { onNodeDoubleClick, editor }
}
