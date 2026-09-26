import { describe, expect, it } from 'vitest'

import { landingMotionMode } from './landing-motion'

describe('landing motion policy', () => {
  const normal = { reducedMotion: false, finePointer: true, inViewport: true, pageVisible: true }

  it('runs full effects only in a visible fine-pointer view', () => {
    expect(landingMotionMode(normal)).toEqual({
      particles: true,
      pointerEffects: true,
      reveal: true,
    })
    expect(landingMotionMode({ ...normal, finePointer: false }).pointerEffects).toBe(false)
  })

  it('pauses expensive work when hidden or offscreen', () => {
    expect(landingMotionMode({ ...normal, pageVisible: false }).particles).toBe(false)
    expect(landingMotionMode({ ...normal, inViewport: false }).particles).toBe(false)
  })

  it('does not spatially animate reduced-motion content', () => {
    expect(landingMotionMode({ ...normal, reducedMotion: true })).toEqual({
      particles: false,
      pointerEffects: false,
      reveal: false,
    })
  })
})
