// SPDX-License-Identifier: MIT
//
// Copyright (c) 2023-2026 Denis Davydkov
// Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
//
// Portions of this file have been modified by NVIDIA CORPORATION & AFFILIATES.

import { type EdgeId, type NodeId, nonNullable } from '@likec4/core'
import { cx } from '@likec4/styles/css'
import { useDebouncedCallback, useTimeout } from '@mantine/hooks'
import { useCustomCompareMemo } from '@react-hookz/web'
import { Controls as XYFlowControls, Panel } from '@xyflow/react'
import type { OnMove, OnMoveEnd, Viewport } from '@xyflow/system'
import { shallowEqual } from 'fast-equals'
import { type MouseEvent as ReactMouseEvent, type PropsWithChildren, useMemo } from 'react'
import type { JSX } from 'react/jsx-runtime'
import { isEmpty } from 'remeda'
import type { Simplify } from 'type-fest'
import { BaseXYFlow } from '../base/BaseXYFlow'
import { IS_SERVER } from '../base/const'
import { useDiagramEventHandlers } from '../context'
import { useOptionalLikeC4Model } from '../context/LikeC4ModelContext'
import { useRootContainer } from '../context/RootContainerContext'
import {
  canvasPalette,
  editorAffordances,
  ElementPalette,
  excludeChangeOf,
  Ghosts,
  innermostNode,
  MANUAL_LAYOUT_NOTICE,
  relationshipKinds,
  relationTitleTargetOf,
  removeStepChangesOf,
  resolveConnection,
  stepPositions,
  useCanvasDrop,
  useConnectPrompt,
  useManualLayoutToast,
  useTitleEditing,
} from '../editor-ui'
import {
  selectDiagramSnapshot,
  useCallbackRef,
  useDiagramSelector,
  useUpdateEffect,
} from '../hooks'
import { useDiagram } from '../hooks/useDiagram'
import { useEditorActorStateHasTag } from '../hooks/useEditorActor'
import { depsShallowEqual } from '../hooks/useUpdateEffect'
import { useXYFlow } from '../hooks/useXYFlow'
import type { LikeC4DiagramProperties, NodeRenderers, ViewPaddings } from '../LikeC4Diagram.props'
import { BuiltinEdges, BuiltinNodes } from './custom'
import { deriveToggledFeatures } from './state/machine.setup'
import { viewBounds } from './state/utils'
import type { Types } from './types'
import { useLayoutConstraints } from './useLayoutConstraints'
import { useGraphForceSimulation } from './xyflow-graph/useGraphForceSimulation'

const edgeTypes = {
  relationship: BuiltinEdges.RelationshipEdge,
  'seq-step': BuiltinEdges.SequenceStepEdge,
}

const builtinNodes = {
  element: BuiltinNodes.ElementNode,
  deployment: BuiltinNodes.DeploymentNode,
  'compound-element': BuiltinNodes.CompoundElementNode,
  'compound-deployment': BuiltinNodes.CompoundDeploymentNode,
  'view-group': BuiltinNodes.ViewGroupNode,
  'seq-actor': BuiltinNodes.SequenceActorNode,
  'seq-parallel': BuiltinNodes.SequenceParallelArea,
  'seq-subflow': BuiltinNodes.SequenceSubflowArea,
  'graph-element': BuiltinNodes.GraphElementNode,
}
function prepareNodeTypes(nodeTypes?: NodeRenderers): Types.NodeRenderers {
  if (!nodeTypes || isEmpty(nodeTypes)) {
    return builtinNodes
  }
  return {
    element: nodeTypes.element ?? builtinNodes.element,
    deployment: nodeTypes.deployment ?? builtinNodes.deployment,
    'compound-element': nodeTypes.compoundElement ?? builtinNodes['compound-element'],
    'compound-deployment': nodeTypes.compoundDeployment ?? builtinNodes['compound-deployment'],
    'view-group': nodeTypes.viewGroup ?? builtinNodes['view-group'],
    'seq-actor': nodeTypes.seqActor ?? builtinNodes['seq-actor'],
    'seq-parallel': nodeTypes.seqParallel ?? builtinNodes['seq-parallel'],
    'seq-subflow': nodeTypes.seqSubflow ?? builtinNodes['seq-subflow'],
    'graph-element': nodeTypes.graphElement ?? builtinNodes['graph-element'],
  }
}

export function resolveControlledViewport(
  enableFitView: boolean,
  initialZoom: number | undefined,
  bounds: { x: number; y: number },
): Viewport | undefined {
  if (enableFitView || initialZoom !== undefined) {
    return undefined
  }
  return {
    x: -bounds.x,
    y: -bounds.y,
    zoom: 1,
  }
}

const DELETE_KEYS = ['Backspace', 'Delete']

export function resolveInteractionEnabled(
  enabled: boolean,
  override: boolean | undefined,
  isEditorBusy: boolean,
): boolean {
  return (override ?? enabled) && !isEditorBusy
}

const selectXYProps = selectDiagramSnapshot(({ context: ctx, children }) => {
  const { enableReadOnly } = deriveToggledFeatures(ctx)
  const controlledViewport = resolveControlledViewport(
    ctx.features.enableFitView,
    ctx.initialZoom,
    viewBounds(ctx),
  )

  const editorSnapshot = enableReadOnly ? null : children.editor?.getSnapshot()

  const isNotEditingEdge = enableReadOnly || editorSnapshot?.context.editing?.subject !== 'edge'

  const isGraphVariant = ctx.elementViewVariant === 'graph' && ctx.view._type === 'element'

  let nodesDraggable = !enableReadOnly && ctx.nodesDraggable
  // if dynamic view display mode is sequence, disable nodes draggable
  if ((ctx.dynamicViewVariant === 'sequence' && ctx.view._type === 'dynamic')) {
    nodesDraggable = false
  }
  // in "graph" display variant, dragging is a physics-driven, non-persisting interaction -
  // it doesn't mutate the model, so it stays available even in read-only mode
  if (isGraphVariant) {
    nodesDraggable = ctx.nodesDraggable
  }

  const { nodesConnectable, titlesEditable, itemsCreatable } = editorAffordances({
    enableReadOnly,
    // sequence variant of dynamic views is not editable on the canvas
    isGraphVariant: isGraphVariant || (ctx.view._type === 'dynamic' && ctx.dynamicViewVariant === 'sequence'),
    viewType: ctx.view._type,
  })

  return ({
    enableReadOnly,
    isGraphVariant,
    nodesConnectable,
    titlesEditable,
    itemsCreatable,
    viewType: ctx.view._type,
    // During SSR, consider initialized as true to avoid flashing
    initialized: IS_SERVER || (ctx.initialized.xydata && ctx.initialized.xyflow),
    nodes: ctx.xynodes,
    edges: ctx.xyedges,
    pannable: ctx.pannable,
    zoomable: ctx.zoomable,
    minZoom: ctx.minZoom,
    maxZoom: ctx.maxZoom,
    nodesDraggable,
    nodesSelectable: ctx.nodesSelectable && isNotEditingEdge,
    fitViewPadding: ctx.fitViewPadding,
    enableFitView: ctx.features.enableFitView,
    enableControls: ctx.features.enableControls,
    ...(controlledViewport && {
      viewport: controlledViewport,
    }),
  })
}, ({ nodes: aNodes, edges: aEdges, ...a }, { nodes: bNodes, edges: bEdges, ...b }) => {
  return shallowEqual(a, b) && shallowEqual(aNodes, bNodes) && shallowEqual(aEdges, bEdges)
})

export type LikeC4DiagramXYFlowProps = PropsWithChildren<
  Simplify<
    Pick<
      LikeC4DiagramProperties<any>,
      | 'background'
      | 'reactFlowProps'
      | 'renderNodes'
    >
  >
>
export function LikeC4DiagramXYFlow({
  background = 'dots',
  reactFlowProps = {},
  children,
  renderNodes,
}: LikeC4DiagramXYFlowProps): JSX.Element {
  const {
    nodesDraggable: nodesDraggableOverride,
    elementsSelectable: nodesSelectableOverride,
    ...safeReactFlowProps
  } = reactFlowProps
  const diagram = useDiagram()
  const xyflow = useXYFlow()
  const likec4model = useOptionalLikeC4Model()
  let {
    enableReadOnly,
    isGraphVariant,
    nodesConnectable,
    titlesEditable,
    itemsCreatable,
    viewType,
    initialized,
    nodes,
    edges,
    enableFitView,
    nodesDraggable,
    nodesSelectable,
    enableControls,
    ...props
  } = useDiagramSelector(selectXYProps)
  const isEditorBusy = useEditorActorStateHasTag('busy')
  // New elements in a view with manual layout stay where they are dropped
  const viewId = useDiagramSelector(s => s.context.view.id)
  const isManualLayout = useDiagramSelector(s => s.context.view._layout === 'manual')
  const manualLayoutToast = useManualLayoutToast(viewId, isManualLayout)
  // Palette of kinds to create items, available only with the model
  const palette = useMemo(
    () => itemsCreatable && likec4model ? canvasPalette(viewType, likec4model) : null,
    [itemsCreatable, likec4model, viewType],
  )
  const relationKinds = useMemo(() => likec4model ? relationshipKinds(likec4model) : [], [likec4model])
  const connectPrompt = useConnectPrompt(relationKinds, change => {
    diagram.editorActor().send({ type: 'change.view', change })
  })
  const titleEditing = useTitleEditing(change => {
    diagram.editorActor().send({ type: 'change.view', change })
  })
  const canvasDrop = useCanvasDrop(
    palette?.config ?? { viewType: 'element', kinds: [] },
    (change, position) => {
      diagram.editorActor().send({ type: 'change.view', change, position })
      manualLayoutToast.onDrop()
    },
    message => {
      diagram.editorActor().send({ type: 'error.show', message })
    },
  )
  nodesDraggable = resolveInteractionEnabled(nodesDraggable, nodesDraggableOverride, isEditorBusy)
  nodesSelectable = resolveInteractionEnabled(nodesSelectable, nodesSelectableOverride, isEditorBusy)

  const {
    onNodeContextMenu,
    onCanvasContextMenu,
    onEdgeContextMenu,
    onNodeClick,
    onEdgeClick,
    onCanvasClick,
    onCanvasDblClick,
  } = useDiagramEventHandlers()

  const { reducedGraphics, $panning } = useRootContainer()

  const isReducedGraphics = reducedGraphics,
    layoutConstraints = useLayoutConstraints(),
    graphForceHandlers = useGraphForceSimulation({ enabled: isGraphVariant, nodes, edges }),
    $isPanning = $panning,
    isPanning = useTimeout(() => {
      $isPanning.set(true)
    }, isReducedGraphics ? 200 : 1000),
    notPanning = useDebouncedCallback(() => {
      isPanning.clear()
      $isPanning.set(false)
    }, 200),
    onMove: OnMove = useCallbackRef((event) => {
      if (!event) {
        $isPanning.set(false)
        isPanning.clear()
        return
      }
      if (!$isPanning.get()) {
        isPanning.start()
      } else {
        notPanning()
      }
    }),
    onMoveEnd: OnMoveEnd = useCallbackRef((event, viewport) => {
      if (!event) {
        $isPanning.set(false)
        isPanning.clear()
        notPanning.cancel()
      } else {
        notPanning()
      }
      diagram.send({
        type: 'xyflow.viewportMoved',
        viewport,
        manually: !!event,
      })
    }),
    onViewportResize = useCallbackRef(() => {
      diagram.send({ type: 'xyflow.resized' })
    }),
    nodeTypes = useCustomCompareMemo(
      () => prepareNodeTypes(renderNodes),
      [renderNodes],
      depsShallowEqual,
    )

  useUpdateEffect(() => {
    console.warn('renderNodes changed - this might degrade performance')
  }, [nodeTypes])

  return (
    <BaseXYFlow<Types.AnyNode, Types.AnyEdge>
      nodes={nodes}
      edges={edges}
      className={cx(initialized ? 'initialized' : 'not-initialized')}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={useCallbackRef((changes) => {
        diagram.send({ type: 'xyflow.applyChanges', nodes: changes })
      })}
      onEdgesChange={useCallbackRef((changes) => {
        diagram.send({ type: 'xyflow.applyChanges', edges: changes })
      })}
      background={initialized ? background : 'transparent'}
      // Fitview is handled in onInit
      fitView={false}
      onNodeClick={useCallbackRef((e, node) => {
        if (e.isPropagationStopped()) {
          return
        }
        e.stopPropagation()
        diagram.send({ type: 'xyflow.nodeClick', node })
        onNodeClick?.(diagram.findDiagramNode(node.id as NodeId)!, e)
      })}
      onEdgeClick={useCallbackRef((e, edge) => {
        if (e.isPropagationStopped()) {
          return
        }
        e.stopPropagation()
        diagram.send({ type: 'xyflow.edgeClick', edge })
        onEdgeClick?.(diagram.findDiagramEdge(edge.id as EdgeId)!, e)
      })}
      onEdgeDoubleClick={useCallbackRef((e, edge) => {
        if (e.isPropagationStopped()) {
          return
        }
        e.stopPropagation()
        // Edit the title of the relation (element views, edges of a single relation)
        const relation = titlesEditable && viewType === 'element'
          ? relationTitleTargetOf(diagram.findDiagramEdge(edge.id as EdgeId)?.relations ?? [])
          : null
        if (relation) {
          const title = typeof edge.data.label === 'string' ? edge.data.label : ''
          titleEditing.editRelationTitle(relation, title, xyflow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
          return
        }
        diagram.send({ type: 'xyflow.edgeDoubleClick', edge })
      })}
      deleteKeyCode={DELETE_KEYS}
      onBeforeDelete={useCallbackRef(async ({ nodes, edges }) => {
        // Deleting on the canvas excludes items from this view (the model is not changed).
        // Items disappear once the view is synced, so nothing is removed locally.
        if (!enableReadOnly) {
          // In dynamic views (no `exclude` there), deleting a step removes it from the view
          const changes = viewType === 'dynamic'
            ? removeStepChangesOf(edges)
            : [excludeChangeOf(viewType, nodes, edges, id => xyflow.getNode(id))].filter(c => c !== null)
          for (const change of changes) {
            diagram.editorActor().send({ type: 'change.view', change })
          }
        }
        return false
      })}
      nodesConnectable={nodesConnectable}
      {...titlesEditable && {
        onNodeDoubleClick: titleEditing.onNodeDoubleClick,
      }}
      {...palette && {
        onDragOver: canvasDrop.onDragOver,
        onDrop: canvasDrop.onDrop,
      }}
      onConnectEnd={useCallbackRef((event, connection) => {
        const pointer = 'changedTouches' in event ? event.changedTouches[0] : event
        if (!nodesConnectable || !connection.fromNode || !pointer) {
          return
        }
        const released = xyflow.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY })
        // Released outside a handle: take the innermost node under the pointer
        const toNode = connection.toNode
          ?? innermostNode(xyflow.getIntersectingNodes({ ...released, width: 1, height: 1 }))
        const change = resolveConnection(connection.fromNode, toNode, viewType)
        // Ask for the details first: title, kind and technology (relations), title and position (steps)
        switch (change?.op) {
          case 'add-relation':
            connectPrompt.open({ change, position: released })
            break
          case 'add-dynamic-step': {
            const titleOf = (id: string) => {
              const title = xyflow.getNode(id)?.data.title
              return typeof title === 'string' ? title : id
            }
            connectPrompt.open({ change, position: released, positions: stepPositions(xyflow.getEdges(), titleOf) })
            break
          }
        }
      })}
      onPaneClick={useCallbackRef((e) => {
        e.stopPropagation()
        diagram.send({ type: 'xyflow.paneClick' })
        onCanvasClick?.(e as any)
      })}
      onDoubleClick={useCallbackRef(e => {
        e.stopPropagation()
        e.preventDefault()
        diagram.send({ type: 'xyflow.paneDblClick' })
        onCanvasDblClick?.(e as any)
      })}
      onNodeMouseEnter={useCallbackRef((event, node) => {
        event.stopPropagation()
        diagram.send({ type: 'xyflow.nodeMouseEnter', node })
      })}
      onNodeMouseLeave={useCallbackRef((event, node) => {
        event.stopPropagation()
        diagram.send({ type: 'xyflow.nodeMouseLeave', node })
      })}
      onEdgeMouseEnter={useCallbackRef((event, edge) => {
        event.stopPropagation()
        diagram.send({ type: 'xyflow.edgeMouseEnter', edge, event })
      })}
      onEdgeMouseLeave={useCallbackRef((event, edge) => {
        event.stopPropagation()
        diagram.send({ type: 'xyflow.edgeMouseLeave', edge, event })
      })}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      onInit={useCallbackRef((instance) => {
        diagram.send({ type: 'xyflow.init', instance })
      })}
      onNodeContextMenu={useCallbackRef((event, node) => {
        const diagramNode = diagram.findDiagramNode(node.data.id)
        if (diagramNode) {
          onNodeContextMenu?.(diagramNode, event)
        }
      })}
      onEdgeContextMenu={useCallbackRef((event, edge) => {
        const diagramEdge = nonNullable(
          diagram.findDiagramEdge(edge.id as EdgeId),
          `diagramEdge ${edge.id} not found`,
        )
        onEdgeContextMenu?.(diagramEdge, event)
      })}
      {...onCanvasContextMenu && {
        onPaneContextMenu: onCanvasContextMenu as ((event: ReactMouseEvent | MouseEvent) => void),
      }}
      {...enableFitView && {
        onViewportResize,
      }}
      nodesFocusable
      edgesFocusable
      elevateEdgesOnSelect={!enableReadOnly}
      zIndexMode="manual"
      {...(nodesDraggable && (isGraphVariant ? graphForceHandlers : layoutConstraints))}
      {...props}
      {...safeReactFlowProps}
      nodesDraggable={nodesDraggable}
      nodesSelectable={nodesSelectable}>
      {enableControls && (
        <Controls
          fitViewPadding={props.fitViewPadding}
          minZoom={props.minZoom}
          maxZoom={props.maxZoom}
        />
      )}
      {itemsCreatable && <Ghosts />}
      {palette && (
        <Panel position="center-right">
          <ElementPalette
            title={palette.title}
            items={palette.items}
            emptyMessage={palette.emptyMessage}
            notice={isManualLayout ? MANUAL_LAYOUT_NOTICE : undefined} />
        </Panel>
      )}
      {palette && canvasDrop.popover}
      {palette && manualLayoutToast.toast}
      {titlesEditable && titleEditing.editor}
      {nodesConnectable && connectPrompt.prompt}
      {children}
    </BaseXYFlow>
  )
}

const Controls = (
  { fitViewPadding, minZoom, maxZoom }: Pick<typeof selectXYProps.Out, 'fitViewPadding' | 'minZoom' | 'maxZoom'>,
) => (
  <XYFlowControls
    showInteractive={false}
    fitViewOptions={{
      padding: fitViewPadding,
      minZoom,
      // Fit-to-view never scales up beyond 1, even if `maxZoom` allows it
      maxZoom: Math.min(maxZoom, 1),
      duration: 350,
    }}
    position="bottom-left"
  />
)
