import type { XYPoint } from '@likec4/core/geometry'
import type { LikeC4Model } from '@likec4/core/model'
import { type Fqn, type ViewChange, Fqn as toFqn } from '@likec4/core/types'
import { parentFqn } from '@likec4/core/utils'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconArrowMoveRight } from '@tabler/icons-react'
import { type ReactNode, createContext, useContext, useState } from 'react'
import { useOptionalLikeC4Model } from '../context/LikeC4ModelContext'
import { useCallbackRef } from '../hooks/useCallbackRef'
import { useXYFlow } from '../hooks/useXYFlow'
import type { ConnectableNode } from './connect'
import { PromptPortal } from './PromptPortal'
import { renameTargetOf } from './rename'
import { TitlePrompt } from './TitlePrompt'

/**
 * Option of the move list for the top level
 */
export const TOP_LEVEL = 'Top level'

/**
 * The element moved from a node: an element of this project (deployment items are not moved)
 */
export function moveTargetOf(node: ConnectableNode | null | undefined): Fqn | null {
  const target = renameTargetOf(node)
  return target && 'element' in target ? target.element : null
}

/**
 * Where the element can be moved: the top level (unless it is there), then the elements of this project,
 * except itself, its descendants and its current parent
 */
export function moveParents(model: LikeC4Model, element: Fqn): string[] {
  const current = parentFqn(element)
  const parents = [...model.elements()]
    .map(e => e.id as string)
    .filter(id => !id.startsWith('@') && id !== element && !id.startsWith(element + '.') && id !== current)
  return current === null ? parents : [TOP_LEVEL, ...parents]
}

type Moving = {
  element: Fqn
  parents: string[]
  center: XYPoint
}

/**
 * Opens the move prompt for a node, null when moving is not available
 */
const MoveContext = createContext<((nodeId: string) => void) | null>(null)

export const MoveProvider = MoveContext.Provider

/**
 * Prompt for the new parent of an element (node toolbar)
 */
export function useMovePrompt(onChange: (change: ViewChange.MoveElement) => void): {
  move: (nodeId: string) => void
  prompt: ReactNode
  close: () => void
} {
  const xyflow = useXYFlow()
  const model = useOptionalLikeC4Model()
  const [moving, setMoving] = useState<Moving | null>(null)

  const move = useCallbackRef((nodeId: string) => {
    const internal = xyflow.getInternalNode(nodeId)
    const element = moveTargetOf(internal)
    if (!internal || !element || !model) {
      return
    }
    const { x, y } = internal.internals.positionAbsolute
    setMoving({
      element,
      parents: moveParents(model, element),
      center: {
        x: x + (internal.measured.width ?? 0) / 2,
        y: y + (internal.measured.height ?? 0) / 2,
      },
    })
  })

  const prompt = moving && (
    <PromptPortal position={moving.center} centered>
      <TitlePrompt
        label="Move to"
        initialTitle=""
        confirmLabel="Move"
        options={moving.parents}
        onCancel={() => setMoving(null)}
        onConfirm={parent => {
          setMoving(null)
          onChange({
            op: 'move-element',
            element: moving.element,
            parent: parent === TOP_LEVEL ? null : toFqn(parent),
          })
        }}
      />
    </PromptPortal>
  )

  return { move, prompt, close: () => setMoving(null) }
}

/**
 * "Move to…" button of the node toolbar, absent when moving is not available
 */
export function MoveButton({ nodeId }: { nodeId: string }) {
  const move = useContext(MoveContext)
  if (!move) {
    return null
  }
  return (
    <Tooltip label="Move to…">
      <ActionIcon
        aria-label="Move to…"
        className="nodrag nopan"
        size="md"
        variant="subtle"
        color="gray"
        onClick={e => {
          e.stopPropagation()
          move(nodeId)
        }}>
        <IconArrowMoveRight size={16} />
      </ActionIcon>
    </Tooltip>
  )
}
