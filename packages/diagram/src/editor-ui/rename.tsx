import type { XYPoint } from '@likec4/core/geometry'
import type { Fqn, ViewChange } from '@likec4/core/types'
import { nameFromFqn, parentFqn } from '@likec4/core/utils'
import { ActionIcon, Tooltip } from '@mantine/core'
import { IconCursorText } from '@tabler/icons-react'
import { type ReactNode, createContext, useContext, useState } from 'react'
import { useOptionalLikeC4Model } from '../context/LikeC4ModelContext'
import { useCallbackRef } from '../hooks/useCallbackRef'
import { useXYFlow } from '../hooks/useXYFlow'
import { type ConnectableNode, modelFqnOf } from './connect'
import { identifierError, takenNames } from './identifier'
import { PromptPortal } from './PromptPortal'
import { TitlePrompt } from './TitlePrompt'

/**
 * The element renamed from a node: an element of this project (not imported)
 */
export function renameTargetOf(node: ConnectableNode | null | undefined): Fqn | null {
  const fqn = modelFqnOf(node)
  return fqn && !fqn.startsWith('@') ? fqn : null
}

/**
 * F2 pressed outside of text fields
 */
export function isRenameHotkey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>, target: unknown) {
  const inTextField = typeof target === 'object' && target !== null && (
    ('isContentEditable' in target && target.isContentEditable === true)
    || ('tagName' in target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(target.tagName)))
  )
  return event.key === 'F2' && !event.ctrlKey && !event.metaKey && !event.altKey && !inTextField
}

type Renaming = {
  element: Fqn
  name: string
  taken: ReadonlySet<string>
  center: XYPoint
}

/**
 * Opens the rename prompt for a node, null when renaming is not available
 */
const RenameContext = createContext<((nodeId: string) => void) | null>(null)

export const RenameProvider = RenameContext.Provider

/**
 * Prompt for a new identifier of an element (F2, or the node toolbar)
 */
export function useRenamePrompt(onChange: (change: ViewChange.RenameElement) => void): {
  /**
   * Opens the prompt for the node, if it is an element of this project
   */
  rename: (nodeId: string) => void
  /**
   * Opens the prompt for the only selected node (F2)
   */
  renameSelected: () => void
  prompt: ReactNode
  close: () => void
} {
  const xyflow = useXYFlow()
  const model = useOptionalLikeC4Model()
  const [renaming, setRenaming] = useState<Renaming | null>(null)

  const rename = useCallbackRef((nodeId: string) => {
    const internal = xyflow.getInternalNode(nodeId)
    const element = renameTargetOf(internal)
    if (!internal || !element) {
      return
    }
    const name = nameFromFqn(element)
    const taken = model ? takenNames(model, { model: 'element', parent: parentFqn(element) }) : new Set<string>()
    taken.delete(name)
    const { x, y } = internal.internals.positionAbsolute
    setRenaming({
      element,
      name,
      taken,
      center: {
        x: x + (internal.measured.width ?? 0) / 2,
        y: y + (internal.measured.height ?? 0) / 2,
      },
    })
  })

  const renameSelected = useCallbackRef(() => {
    const selected = xyflow.getNodes().filter(node => node.selected)
    if (selected.length === 1) {
      rename(selected[0]!.id)
    }
  })

  const prompt = renaming && (
    <PromptPortal position={renaming.center} centered>
      <TitlePrompt
        label="Identifier"
        initialTitle={renaming.name}
        confirmLabel="Rename"
        validate={value => identifierError(value, renaming.taken)}
        onCancel={() => setRenaming(null)}
        onConfirm={name => {
          setRenaming(null)
          if (name !== renaming.name) {
            onChange({ op: 'rename-element', target: { element: renaming.element }, name })
          }
        }}
      />
    </PromptPortal>
  )

  return { rename, renameSelected, prompt, close: () => setRenaming(null) }
}

/**
 * "Rename identifier" button of the node toolbar, absent when renaming is not available
 */
export function RenameButton({ nodeId }: { nodeId: string }) {
  const rename = useContext(RenameContext)
  if (!rename) {
    return null
  }
  return (
    <Tooltip label="Rename identifier (F2)">
      <ActionIcon
        aria-label="Rename identifier"
        className="nodrag nopan"
        size="md"
        variant="subtle"
        color="gray"
        onClick={e => {
          e.stopPropagation()
          rename(nodeId)
        }}>
        <IconCursorText size={16} />
      </ActionIcon>
    </Tooltip>
  )
}
