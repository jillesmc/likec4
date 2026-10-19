import { Notification } from '@mantine/core'
import { type ReactNode, useEffect, useState } from 'react'

export const MANUAL_LAYOUT_NOTICE =
  'This view has a manual layout. New elements are placed where you drop them; move them to where they belong.'

const AUTO_CLOSE_MS = 6_000

/**
 * Views where the notice was already shown as a toast (once per view per session)
 */
const shownInSession = new Set<string>()

/**
 * Whether the toast is shown for this drop, and remembers it
 */
export function takeManualLayoutToast(shown: Set<string>, viewId: string, isManual: boolean): boolean {
  if (!isManual || shown.has(viewId)) {
    return false
  }
  shown.add(viewId)
  return true
}

/**
 * Info toast shown on the first element dropped in a view with manual layout
 */
export function useManualLayoutToast(viewId: string, isManual: boolean): {
  onDrop: () => void
  toast: ReactNode
} {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!visible) {
      return
    }
    const timeout = setTimeout(() => setVisible(false), AUTO_CLOSE_MS)
    return () => clearTimeout(timeout)
  }, [visible])

  const onDrop = () => {
    if (takeManualLayoutToast(shownInSession, viewId, isManual)) {
      setVisible(true)
    }
  }
  const toast = visible && (
    <Notification
      data-likec4-manual-layout-notice
      color="blue"
      title="Manual layout"
      onClose={() => setVisible(false)}
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 480,
        zIndex: 100,
      }}>
      {MANUAL_LAYOUT_NOTICE}
    </Notification>
  )
  return { onDrop, toast }
}
