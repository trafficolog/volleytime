type MotionInputs = {
  reducedMotion: boolean
  finePointer: boolean
  inViewport: boolean
  pageVisible: boolean
}

export function landingMotionMode(input: MotionInputs) {
  const active = !input.reducedMotion && input.pageVisible && input.inViewport
  return {
    particles: active,
    pointerEffects: active && input.finePointer,
    reveal: !input.reducedMotion,
  }
}
