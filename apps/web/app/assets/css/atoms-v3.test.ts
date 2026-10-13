import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./atoms-v3.css', import.meta.url), 'utf8').replaceAll(
  '\r\n',
  '\n',
)
const sheet = readFileSync(new URL('../../components/vt/Sheet.vue', import.meta.url), 'utf8')

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return ''
  return css.slice(start, css.indexOf('}', start) + 1)
}

describe('atoms v3 styles', () => {
  it('toggle is 36x20 with a 16px thumb, 150 ms and a 44x44 hit area', () => {
    expect(rule('.vt-toggle')).toContain('width: 36px')
    expect(rule('.vt-toggle')).toContain('height: 20px')
    expect(rule('.vt-toggle')).toContain('transition: background 0.15s')
    expect(rule('.vt-toggle__thumb')).toContain('width: 16px')
    expect(rule('.vt-toggle__thumb')).toContain('transition: left 0.15s')
    expect(rule('.vt-toggle::after')).toContain('width: 44px')
    expect(rule('.vt-toggle::after')).toContain('height: 44px')
  })

  it('popover is 210px, alert caps at 360px, toast lasts via token capsule above the dock', () => {
    expect(rule('.vt-popover')).toContain('width: 210px')
    expect(rule('.vt-popover')).toContain('var(--vt-pop-shadow)')
    expect(rule('.vt-alert')).toContain('min(86%, 360px)')
    expect(rule('.vt-alert')).toContain('var(--vt-modal-shadow)')
    expect(rule('.vt-toast')).toContain('var(--vt-toast-bg)')
    expect(rule('.vt-toast')).toContain('border-radius: var(--r-pill)')
    expect(rule('.vt-toast-host')).toContain('bottom: calc(84px')
  })

  it('sheet rises in 180 ms over the scrim token and motion is reduced on request', () => {
    expect(rule('.vt-sheet-panel')).toContain('vt-sheet-up 0.18s')
    expect(rule('.vt-sheet-scrim')).toContain('var(--vt-scrim)')
    expect(sheet).toContain('vt-sheet-scrim')
    expect(sheet).toContain('vt-sheet-panel')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('uses tokens only for colour', () => {
    const withoutVarFallbacks = css.replace(/var\([^)]*\)/g, '')
    expect(withoutVarFallbacks).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(withoutVarFallbacks).not.toMatch(/rgba?\(/)
  })
})
