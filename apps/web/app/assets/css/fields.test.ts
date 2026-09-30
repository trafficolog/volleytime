import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./main.css', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const context = css.match(/\/\* Gray surface fields[^]*?\*\/\s*([^]*?)\{([^]*?)\}/)

describe('fields on gray surfaces', () => {
  it('gives gray fields a separate paper fill and neutral boundary without changing outside fields', () => {
    expect(context, 'missing contextual field rule').not.toBeNull()
    expect(context?.[2]).toContain('background: var(--vt-paper)')
    expect(context?.[2]).toContain('border-color: var(--vt-field-border)')
    expect(css.match(/\.vt-field \{([^]*?)\}/)?.[1]).toContain('background: var(--vt-bone)')
    expect(css.match(/\.vt-field:focus-visible \{([^]*?)\}/)?.[1]).toContain(
      'border-color: var(--vt-flame)',
    )
  })

  it('limits the context to gray surfaces and native textual fields, preserving focus specificity', () => {
    const selector = context?.[1] ?? ''
    expect(selector).toContain(':where(')
    expect(selector).toContain('.bg-vt-bone-2')
    for (const variant of ['raised', 'hero', 'warm', 'cool']) {
      expect(selector).toContain(`.vt-card--${variant}`)
    }
    for (const type of [
      'checkbox',
      'radio',
      'button',
      'submit',
      'reset',
      'image',
      'hidden',
      'range',
      'color',
    ]) {
      expect(selector).toContain(`[type='${type}']`)
    }
    expect(selector).toContain('select')
    expect(selector).toContain('textarea')
    expect(selector).not.toContain(':disabled')
    expect(selector).not.toContain('[readonly]')
  })

  it('uses theme-aware neutral boundaries that exceed 3:1 against paper and both gray surfaces', () => {
    const colors = [...tokens.matchAll(/--vt-field-border: (#[\da-f]{6});/g)].map(
      (match) => match[1],
    )
    expect(colors).toHaveLength(2)
    const luminance = (hex: string) => {
      const [r, g, b] = hex
        .slice(1)
        .match(/../g)!
        .map((channel) => {
          const value = Number.parseInt(channel, 16) / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    for (const [index, surfaces] of [
      ['#ffffff', '#f4f4f6', '#ececf0'],
      ['#0f1013', '#1a1b20', '#24252b'],
    ].entries()) {
      for (const surface of surfaces) {
        const foreground = luminance(colors[index]!)
        const background = luminance(surface)
        expect(
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
