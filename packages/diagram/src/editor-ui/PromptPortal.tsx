import type { XYPoint } from '@likec4/core/geometry'
import { useStore, ViewportPortal } from '@xyflow/react'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'

type Box = { left: number; top: number; right: number; bottom: number }

const MARGIN = 8

/**
 * CSS transform of a prompt anchored at a point of the canvas, at a constant size on screen:
 * the inverse of the zoom cancels the scale of the viewport.
 * `shift` (screen pixels) moves it back inside the canvas.
 */
export function promptTransform(position: XYPoint, zoom: number, centered = false, shift: XYPoint = { x: 0, y: 0 }) {
  const scale = zoom > 0 ? 1 / zoom : 1
  return `translate(${position.x}px, ${position.y}px) scale(${scale})`
    + (shift.x !== 0 || shift.y !== 0 ? ` translate(${shift.x}px, ${shift.y}px)` : '')
    + (centered ? ' translate(-50%, -50%)' : '')
}

/**
 * Shift (screen pixels) that keeps the prompt inside the container, given where it is without shift
 */
export function fitShift(prompt: Box, container: Box, margin = MARGIN): XYPoint {
  const axis = (start: number, end: number, min: number, max: number) => {
    switch (true) {
      case end > max - margin:
        return Math.max(max - margin - end, min + margin - start)
      case start < min + margin:
        return min + margin - start
      default:
        return 0
    }
  }
  // whole pixels: the measured position has rounding errors, the shift must not follow them
  return {
    x: Math.round(axis(prompt.left, prompt.right, container.left, container.right)),
    y: Math.round(axis(prompt.top, prompt.bottom, container.top, container.bottom)),
  }
}

/**
 * Renders a prompt at a point of the canvas (flow coordinates):
 * - above the nodes (it usually opens over a node)
 * - clickable (the viewport portal of xyflow does not receive pointer events)
 * - at the same size whatever the zoom
 * - moved back inside the canvas when it would overflow
 */
export function PromptPortal({ position, centered = false, children }: {
  position: XYPoint
  /**
   * Centered on the point, otherwise its top-left corner is at the point
   */
  centered?: boolean
  children: ReactNode
}) {
  const zoom = useStore(s => s.transform[2])
  const ref = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState<XYPoint>({ x: 0, y: 0 })
  // shift applied by the last render, the measured position includes it
  const applied = useRef(shift)
  useLayoutEffect(() => {
    applied.current = shift
  })

  useLayoutEffect(() => {
    const prompt = ref.current
    const container = prompt?.closest('.react-flow')
    if (!prompt || !container) {
      return
    }
    const measure = () => {
      const r = prompt.getBoundingClientRect()
      const { x, y } = applied.current
      const next = fitShift(
        { left: r.left - x, right: r.right - x, top: r.top - y, bottom: r.bottom - y },
        container.getBoundingClientRect(),
      )
      // update only for a real move (at least a pixel), or it would never settle
      if (Math.abs(next.x - x) >= 1 || Math.abs(next.y - y) >= 1) {
        setShift(next)
      }
    }
    measure()
    // the prompt may grow after the first layout (fields, validation messages)
    const observer = new ResizeObserver(measure)
    observer.observe(prompt)
    return () => observer.disconnect()
  }, [position.x, position.y, zoom])

  return (
    <ViewportPortal>
      <div
        ref={ref}
        style={{
          position: 'absolute',
          transform: promptTransform(position, zoom, centered, shift),
          transformOrigin: '0 0',
          // its own width, not the room left up to the edge (it must not change when shifted)
          width: 'max-content',
          zIndex: 1000,
          pointerEvents: 'all',
        }}>
        {children}
      </div>
    </ViewportPortal>
  )
}
