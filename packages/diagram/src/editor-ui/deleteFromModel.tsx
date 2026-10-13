import type { LikeC4Model } from '@likec4/core/model'
import type { aux, ViewChange } from '@likec4/core/types'
import { ActionIcon, Button, Group, List, Modal, Text, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useOptionalLikeC4Model } from '../context/LikeC4ModelContext'
import { useEditorActorRef } from '../hooks/useEditorActor'
import { useMantinePortalProps } from '../hooks/useMantinePortalProps'

export type DeleteTarget = ViewChange.DeleteFromModel['target']

/**
 * Whether "Delete from model" is offered:
 * - not for elements imported from other projects
 * - not for edges that aggregate more than one relation
 */
export function canDeleteFromModel(target: { element: string } | { relations: readonly string[] }): boolean {
  return 'element' in target ? !target.element.startsWith('@') : target.relations.length === 1
}

/**
 * References of an element that can be found in the model on the client:
 * relations, nested elements and deployed instances.
 * View rules and `extend` are checked by the server.
 */
export function clientReferences<A extends aux.Any>(model: LikeC4Model<A>, fqn: string): string[] {
  const element = [...model.elements()].find(e => e.id === fqn)
  if (!element) {
    return []
  }
  const references = [] as string[]
  for (const relation of model.relationships()) {
    if (relation.source.id === fqn || relation.target.id === fqn) {
      references.push(`Relation ${relation.source.id} -> ${relation.target.id}`)
    }
  }
  for (const child of element.children()) {
    references.push(`Nested element ${child.id}`)
  }
  for (const instance of model.deployment.instancesOf(element)) {
    references.push(`Deployed instance ${instance.id}`)
  }
  return references
}

/**
 * Confirmation dialog: lists references (deletion blocked), or asks to confirm.
 */
export function DeleteFromModelDialog({ target, title, references, onConfirm, onClose }: {
  target: DeleteTarget
  title: string
  references: readonly string[]
  onConfirm: () => void
  onClose: () => void
}) {
  const portalProps = useMantinePortalProps()
  const isRelation = 'relation' in target
  return (
    <Modal
      opened
      onClose={onClose}
      title={`Delete "${title}" from model?`}
      data-likec4-delete-dialog
      {...portalProps}>
      {references.length > 0
        ? (
          <>
            <Text size="sm">Remove these references first:</Text>
            <List size="sm" mt="xs">
              {references.map(ref => <List.Item key={ref}>{ref}</List.Item>)}
            </List>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>Close</Button>
            </Group>
          </>
        )
        : (
          <>
            <Text size="sm">
              {isRelation
                ? 'The relation will be removed from the sources, in all views.'
                : 'The definition will be removed from the sources.'}
            </Text>
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button color="red" onClick={onConfirm}>Delete</Button>
            </Group>
          </>
        )}
    </Modal>
  )
}

/**
 * Button opening the "Delete from model" dialog (node toolbar, edge label)
 */
export function DeleteFromModelButton({ target, title, button = 'toolbar' }: {
  target: DeleteTarget
  title: string
  button?: 'toolbar' | 'edge'
}) {
  const editor = useEditorActorRef()
  const model = useOptionalLikeC4Model()
  const [opened, setOpened] = useState(false)
  if (!editor) {
    return null
  }
  const references = model && 'element' in target ? clientReferences(model, target.element) : []
  return (
    <>
      <Tooltip label="Delete from model">
        <ActionIcon
          aria-label="Delete from model"
          className="nodrag nopan"
          size={button === 'toolbar' ? 'md' : 'sm'}
          variant={button === 'toolbar' ? 'subtle' : 'filled'}
          color={button === 'toolbar' ? 'gray' : 'red'}
          onClick={e => {
            e.stopPropagation()
            setOpened(true)
          }}>
          <IconTrash stroke={1.8} style={{ width: '65%' }} />
        </ActionIcon>
      </Tooltip>
      {opened && (
        <DeleteFromModelDialog
          target={target}
          title={title}
          references={references}
          onClose={() => setOpened(false)}
          onConfirm={() => {
            setOpened(false)
            editor.send({ type: 'change.view', change: { op: 'delete-from-model', target } })
          }}
        />
      )}
    </>
  )
}
