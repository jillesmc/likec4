import type { Fqn } from '@likec4/core/types'
import { ViewportPortal } from '@xyflow/react'
import type { GhostChange } from '../editor/actor/types'
import { useEditorActorContext } from '../hooks/useEditorActor'
import { useXYStore } from '../hooks/useXYFlow'

const NO_GHOSTS: GhostChange[] = []

type Point = { x: number; y: number }

function useNodeCenter(fqn: Fqn): Point | null {
  return useXYStore(state => {
    for (const node of state.nodeLookup.values()) {
      if ('modelFqn' in node.data && node.data.modelFqn === fqn) {
        const { x, y } = node.internals.positionAbsolute
        return {
          x: x + (node.measured.width ?? 0) / 2,
          y: y + (node.measured.height ?? 0) / 2,
        }
      }
    }
    return null
  })
}

function GhostEdge({ change }: { change: GhostChange }) {
  const source = useNodeCenter(change.source)
  const target = useNodeCenter(change.target)
  if (!source || !target) {
    return null
  }
  return (
    <svg
      data-likec4-ghost-edge
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke="var(--xy-edge-stroke)"
        strokeWidth={3}
        strokeDasharray="8 6"
        opacity={0.6}
      />
    </svg>
  )
}

/**
 * Relations created on the canvas, rendered as dashed lines until the view is synced
 */
export function GhostEdges() {
  const ghosts = useEditorActorContext(c => c.ghosts, NO_GHOSTS)
  if (ghosts.length === 0) {
    return null
  }
  return (
    <ViewportPortal>
      {ghosts.map((change, i) => <GhostEdge key={i} change={change} />)}
    </ViewportPortal>
  )
}
