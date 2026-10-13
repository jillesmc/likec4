import type { Fqn } from '@likec4/core/types'
import { ViewportPortal } from '@xyflow/react'
import type { Ghost } from '../editor/actor/types'
import { useEditorActorContext } from '../hooks/useEditorActor'
import { useXYStore } from '../hooks/useXYFlow'

const NO_GHOSTS: Ghost[] = []

const GHOST_ELEMENT = { width: 200, height: 110 }

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

function GhostEdge({ source, target }: { source: Fqn; target: Fqn }) {
  const from = useNodeCenter(source)
  const to = useNodeCenter(target)
  if (!from || !to) {
    return null
  }
  return (
    <svg
      data-likec4-ghost-edge
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="var(--xy-edge-stroke)"
        strokeWidth={3}
        strokeDasharray="8 6"
        opacity={0.6}
      />
    </svg>
  )
}

function GhostElement({ title, position }: { title: string; position: Point }) {
  return (
    <div
      data-likec4-ghost-element
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        transform: `translate(${position.x - GHOST_ELEMENT.width / 2}px, ${position.y - GHOST_ELEMENT.height / 2}px)`,
        width: GHOST_ELEMENT.width,
        height: GHOST_ELEMENT.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed var(--xy-edge-stroke)',
        borderRadius: 6,
        opacity: 0.6,
        fontSize: 14,
      }}>
      {title}
    </div>
  )
}

/**
 * Items created on the canvas, rendered as dashed placeholders until the view is synced
 */
export function Ghosts() {
  const ghosts = useEditorActorContext(c => c.ghosts, NO_GHOSTS)
  if (ghosts.length === 0) {
    return null
  }
  return (
    <ViewportPortal>
      {ghosts.map(({ change, position }, i) => {
        switch (true) {
          case change.op === 'add-relation' || change.op === 'add-dynamic-step':
            return <GhostEdge key={i} source={change.source} target={change.target} />
          case (change.op === 'add-element' || change.op === 'add-deployment-node') && position !== null:
            return <GhostElement key={i} title={change.title} position={position} />
          case change.op === 'add-instance' && position !== null:
            return <GhostElement key={i} title={change.element} position={position} />
          default:
            return null
        }
      })}
    </ViewportPortal>
  )
}
