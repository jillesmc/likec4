import { describe, expect, it } from 'vitest'
import { fitShift, promptTransform } from './PromptPortal'

describe('promptTransform', () => {
  it('keeps the prompt at the same size on screen, whatever the zoom', () => {
    expect(promptTransform({ x: 10, y: 20 }, 0.5)).toBe('translate(10px, 20px) scale(2)')
    expect(promptTransform({ x: 10, y: 20 }, 2)).toBe('translate(10px, 20px) scale(0.5)')
    expect(promptTransform({ x: 10, y: 20 }, 1)).toBe('translate(10px, 20px) scale(1)')
  })

  it('applies the shift in screen pixels, and centers the prompt when asked', () => {
    expect(promptTransform({ x: 10, y: 20 }, 1, true)).toBe('translate(10px, 20px) scale(1) translate(-50%, -50%)')
    expect(promptTransform({ x: 10, y: 20 }, 0.5, false, { x: -30, y: 0 }))
      .toBe('translate(10px, 20px) scale(2) translate(-30px, 0px)')
  })
})

describe('fitShift', () => {
  const container = { left: 0, top: 0, right: 400, bottom: 300 }

  it('no shift inside the container', () => {
    expect(fitShift({ left: 50, top: 50, right: 250, bottom: 100 }, container)).toEqual({ x: 0, y: 0 })
  })

  it('moves back a prompt overflowing on the right or the bottom', () => {
    expect(fitShift({ left: 300, top: 280, right: 500, bottom: 340 }, container)).toEqual({ x: -108, y: -48 })
  })

  it('moves back a prompt overflowing on the left or the top', () => {
    expect(fitShift({ left: -20, top: -10, right: 180, bottom: 40 }, container)).toEqual({ x: 28, y: 18 })
  })

  it('a prompt larger than the container keeps its start visible', () => {
    expect(fitShift({ left: 100, top: 10, right: 600, bottom: 50 }, container)).toEqual({ x: -92, y: 0 })
  })
})
