import { nonexhaustive } from '@likec4/core'
import type { AutoLayoutDirection } from '@likec4/core/types'
import { Handle, Position, useStore } from '@xyflow/react'
/**
 * XYFlow requires handles to be defined on nodes.
 */
export function DefaultHandles({ direction = 'TB' }: { direction?: AutoLayoutDirection | undefined }) {
  // Handles are connectable only when the diagram allows connecting nodes (editor)
  const connectable = useStore(s => s.nodesConnectable)
  let sourcePosition: Position, targetPosition: Position

  switch (direction) {
    case 'TB': {
      sourcePosition = Position.Bottom
      targetPosition = Position.Top
      break
    }
    case 'BT': {
      sourcePosition = Position.Top
      targetPosition = Position.Bottom
      break
    }
    case 'LR': {
      sourcePosition = Position.Right
      targetPosition = Position.Left
      break
    }
    case 'RL': {
      sourcePosition = Position.Left
      targetPosition = Position.Right
      break
    }
    default: {
      nonexhaustive(direction)
    }
  }
  return (
    <>
      <Handle
        type={'source'}
        position={sourcePosition}
        isConnectable={connectable}
        isConnectableStart={connectable}
        isConnectableEnd={connectable}
        className="likec4-node-handle-center" />
      <Handle
        type={'target'}
        position={targetPosition}
        isConnectable={connectable}
        isConnectableStart={connectable}
        isConnectableEnd={connectable}
        className="likec4-node-handle-center" />
    </>
  )
}
