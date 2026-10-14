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

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replaceAll(
  '\r\n',
  '\n',
)

function hexOf(block: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block)
  if (!match) throw new Error(`${name} not found`)
  return match[1]!
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe('atoms v3 review fixes', () => {
  it('text on rose (danger button, danger toast) is >= 4.5:1 in light and dark themes', () => {
    const darkStart = tokens.indexOf('.dark,\n.vt-dark {')
    const light = tokens.slice(0, darkStart)
    const dark = tokens.slice(darkStart, tokens.indexOf('\n}', darkStart))
    const lightRatio = contrast(hexOf(light, '--vt-on-rose'), hexOf(light, '--vt-rose'))
    const darkRatio = contrast(hexOf(dark, '--vt-on-rose'), hexOf(dark, '--vt-rose'))
    expect(lightRatio).toBeGreaterThanOrEqual(4.5)
    expect(darkRatio).toBeGreaterThanOrEqual(4.5)
    expect(rule('.vt-btn--rose')).toContain('var(--vt-on-rose)')
    expect(rule('.vt-toast--danger')).toContain('var(--vt-on-rose)')
  })

  it('reduced motion collapses spatial animation to a 150 ms fade instead of removing it', () => {
    const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(media).toContain('animation-name: vt-fade !important')
    expect(media).toContain('animation-duration: 150ms !important')
    for (const selector of ['.vt-sheet-panel', '.vt-popover', '.vt-toast', '.vt-alert-scrim'])
      expect(media).toContain(selector)
    expect(media).not.toContain('animation: none')
    expect(css).toContain('@keyframes vt-fade')
  })

  it('open select uses the ink border and an ink 8% ring', () => {
    expect(rule('.vt-select__button--open')).toContain('border-color: var(--vt-ink)')
    expect(rule('.vt-select__button--open')).toContain('var(--vt-ink) 8%')
  })
})
