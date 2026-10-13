import type { XYPoint } from '@likec4/core/geometry'
import type { ElementKind, Fqn, ViewChange } from '@likec4/core/types'
import { ViewportPortal } from '@xyflow/react'
import { type DragEvent, type ReactNode, useState } from 'react'
import { useCallbackRef } from '../hooks/useCallbackRef'
import { useXYFlow } from '../hooks/useXYFlow'
import { innermostNode, modelFqnOf } from './connect'
import { DropPopover } from './DropPopover'
import { PALETTE_DRAG_TYPE } from './ElementPalette'

type PendingDrop = {
  kind: ElementKind
  parent: Fqn | null
  position: XYPoint
}

/**
 * Handles dropping an element kind from the palette onto the canvas:
 * the element under the pointer becomes the parent, then the title is asked in a popover.
 */
export function useElementDrop(
  kinds: readonly ElementKind[],
  onAdd: (change: ViewChange.AddElement, position: XYPoint) => void,
): {
  onDragOver: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
  popover: ReactNode
} {
  const xyflow = useXYFlow()
  const [drop, setDrop] = useState<PendingDrop | null>(null)

  const onDragOver = useCallbackRef((event: DragEvent) => {
    if (event.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  })

  const onDrop = useCallbackRef((event: DragEvent) => {
    const dragged = event.dataTransfer.getData(PALETTE_DRAG_TYPE)
    const kind = kinds.find(k => k === dragged)
    if (!kind) {
      return
    }
    event.preventDefault()
    const position = xyflow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const parentNode = innermostNode(
      xyflow.getIntersectingNodes({ ...position, width: 1, height: 1 }).filter(n => modelFqnOf(n) !== null),
    )
    setDrop({ kind, parent: modelFqnOf(parentNode), position })
  })

  const popover = drop && (
    <ViewportPortal>
      <div style={{ position: 'absolute', transform: `translate(${drop.position.x}px, ${drop.position.y}px)` }}>
        <DropPopover
          kind={drop.kind}
          onCancel={() => setDrop(null)}
          onConfirm={title => {
            setDrop(null)
            onAdd(
              { op: 'add-element', parent: drop.parent, kind: drop.kind, title },
              drop.position,
            )
          }}
        />
      </div>
    </ViewportPortal>
  )

  return { onDragOver, onDrop, popover }
}
