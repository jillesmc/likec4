import { Notification } from '@mantine/core'
import { useEffect } from 'react'
import { useEditorActorContext, useEditorActorRef } from '../hooks/useEditorActor'

const AUTO_CLOSE_MS = 6_000

/**
 * Shows the error of the last rejected change
 */
export function EditorErrorNotification() {
  const editor = useEditorActorRef()
  const error = useEditorActorContext(c => c.lastError, null)

  useEffect(() => {
    if (!error || !editor) {
      return
    }
    const timeout = setTimeout(() => editor.send({ type: 'error.dismiss' }), AUTO_CLOSE_MS)
    return () => clearTimeout(timeout)
  }, [error, editor])

  if (!error) {
    return null
  }
  return (
    <Notification
      data-likec4-editor-error
      role="alert"
      color="red"
      title="Change rejected"
      onClose={() => editor?.send({ type: 'error.dismiss' })}
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 480,
        zIndex: 100,
        whiteSpace: 'pre-line',
      }}>
      {error}
    </Notification>
  )
}
