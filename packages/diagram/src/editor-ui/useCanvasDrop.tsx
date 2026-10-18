import type { XYPoint } from '@likec4/core/geometry'
import { type DeploymentKind, type ElementKind, type ViewChange, DeploymentFqn, Fqn } from '@likec4/core/types'
import { deriveIdentifier } from '@likec4/core/utils'
import { ViewportPortal } from '@xyflow/react'
import { type DragEvent, type ReactNode, useMemo, useState } from 'react'
import { useOptionalLikeC4Model } from '../context/LikeC4ModelContext'
import { useCallbackRef } from '../hooks/useCallbackRef'
import { useXYFlow } from '../hooks/useXYFlow'
import { type ConnectableNode, innermostNode, modelFqnOf } from './connect'
import { PALETTE_DRAG_TYPE } from './ElementPalette'
import { takenNames } from './identifier'
import { type IdentifierField, TitlePrompt } from './TitlePrompt'

/**
 * Palette item to deploy a model element (`instanceOf`)
 */
export const INSTANCE_ITEM = '@instance'

export const INVALID_INSTANCE_DROP = 'Drop "Instance" on a deployment node'

export type CanvasDropConfig =
  | { viewType: 'element'; kinds: readonly ElementKind[] }
  | { viewType: 'deployment'; kinds: readonly DeploymentKind[]; elements: readonly string[] }

export type CanvasDropChange = ViewChange.AddElement | ViewChange.AddDeploymentNode | ViewChange.AddInstance

type PendingDrop =
  | { op: 'add-element'; kind: ElementKind; parent: Fqn | null; position: XYPoint }
  | { op: 'add-deployment-node'; kind: DeploymentKind; parent: DeploymentFqn | null; position: XYPoint }
  | { op: 'add-instance'; parent: DeploymentFqn; position: XYPoint }

/**
 * Deployment node (not an instance) represented by the node
 */
export function deploymentNodeOf(node: ConnectableNode | null | undefined): DeploymentFqn | null {
  if (!node || !('deploymentFqn' in node.data) || typeof node.data.deploymentFqn !== 'string') {
    return null
  }
  const isInstance = 'modelFqn' in node.data && typeof node.data.modelFqn === 'string'
  return isInstance ? null : DeploymentFqn(node.data.deploymentFqn)
}

/**
 * Handles dropping a palette item onto the canvas:
 * - element views: element kind, the element under the pointer becomes the parent
 * - deployment views: deployment node kind, or "Instance" (requires a deployment node under the pointer)
 * Then the title (or the element to deploy) is asked in a popover.
 */
export function useCanvasDrop(
  config: CanvasDropConfig,
  onAdd: (change: CanvasDropChange, position: XYPoint) => void,
  onInvalidDrop?: (message: string) => void,
): {
  onDragOver: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
  popover: ReactNode
} {
  const xyflow = useXYFlow()
  const model = useOptionalLikeC4Model()
  const [drop, setDrop] = useState<PendingDrop | null>(null)

  // Identifier asked with the title, prefilled with the suggestion (without model, the server derives it)
  const identifier = useMemo((): IdentifierField | undefined => {
    if (!drop || !model) {
      return undefined
    }
    const label = 'Identifier'
    switch (drop.op) {
      case 'add-element': {
        const taken = takenNames(model, { model: 'element', parent: drop.parent })
        return { label, taken, suggest: title => deriveIdentifier(title, drop.kind, taken) }
      }
      case 'add-deployment-node': {
        const taken = takenNames(model, { model: 'deployment', parent: drop.parent })
        return { label, taken, suggest: title => deriveIdentifier(title, drop.kind, taken) }
      }
      case 'add-instance': {
        const taken = takenNames(model, { model: 'deployment', parent: drop.parent })
        return {
          label,
          taken,
          // named after the element to deploy
          suggest: value => {
            const element = model.findElement(value)
            return element ? deriveIdentifier(element.name, element.name, taken) : ''
          },
        }
      }
    }
  }, [drop, model])

  const onDragOver = useCallbackRef((event: DragEvent) => {
    if (event.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  })

  const onDrop = useCallbackRef((event: DragEvent) => {
    const dragged = event.dataTransfer.getData(PALETTE_DRAG_TYPE)
    if (!dragged) {
      return
    }
    event.preventDefault()
    const position = xyflow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const underPointer = xyflow.getIntersectingNodes({ ...position, width: 1, height: 1 })
    if (config.viewType === 'element') {
      const kind = config.kinds.find(k => k === dragged)
      if (kind) {
        const parent = modelFqnOf(innermostNode(underPointer.filter(n => modelFqnOf(n) !== null)))
        setDrop({ op: 'add-element', kind, parent, position })
      }
      return
    }
    const parent = deploymentNodeOf(innermostNode(underPointer.filter(n => deploymentNodeOf(n) !== null)))
    if (dragged === INSTANCE_ITEM) {
      // An instance needs a deployment node
      if (parent) {
        setDrop({ op: 'add-instance', parent, position })
      } else {
        onInvalidDrop?.(INVALID_INSTANCE_DROP)
      }
      return
    }
    const kind = config.kinds.find(k => k === dragged)
    if (kind) {
      setDrop({ op: 'add-deployment-node', kind, parent, position })
    }
  })

  const confirm = (value: string, name?: string) => {
    if (!drop) {
      return
    }
    setDrop(null)
    const named = name ? { name } : {}
    switch (drop.op) {
      case 'add-element':
        onAdd({ op: 'add-element', parent: drop.parent, kind: drop.kind, title: value, ...named }, drop.position)
        break
      case 'add-deployment-node':
        onAdd(
          { op: 'add-deployment-node', parent: drop.parent, kind: drop.kind, title: value, ...named },
          drop.position,
        )
        break
      case 'add-instance':
        onAdd({ op: 'add-instance', parent: drop.parent, element: Fqn(value), ...named }, drop.position)
        break
    }
  }

  const popover = drop && (
    <ViewportPortal>
      <div style={{ position: 'absolute', transform: `translate(${drop.position.x}px, ${drop.position.y}px)` }}>
        {drop.op === 'add-instance'
          ? (
            <TitlePrompt
              label="Element to deploy"
              initialTitle=""
              confirmLabel="Add"
              options={config.viewType === 'deployment' ? config.elements : []}
              {...identifier && { identifier }}
              onCancel={() => setDrop(null)}
              onConfirm={confirm}
            />
          )
          : (
            <TitlePrompt
              label={`Title of the new ${drop.kind}`}
              initialTitle={`New ${drop.kind}`}
              confirmLabel="Add"
              {...identifier && { identifier }}
              onCancel={() => setDrop(null)}
              onConfirm={confirm}
            />
          )}
      </div>
    </ViewportPortal>
  )

  return { onDragOver, onDrop, popover }
}
