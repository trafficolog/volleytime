import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./landing.css', import.meta.url), 'utf8')
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function color(value: string): string | undefined {
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${[...value.slice(1)].map((digit) => digit.repeat(2)).join('')}`
  }
  if (value.startsWith('#')) return value
  const name = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  if (!name) return undefined
  const declaration = new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i')
  return (css.match(declaration) ?? tokens.match(declaration))?.[1]
}

function declaration(selector: string, property: string): string | undefined {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return undefined
  const end = css.indexOf('}', start)
  return css.slice(start, end).match(new RegExp(`(?:^|\\n)\\s*${property}:\\s*([^;]+);`))?.[1]
}

function contrastRatio(foreground: string | undefined, background: string | undefined): number {
  if (!foreground || !background) return 0
  const luminance = (hex: string) => {
    const [r = 0, g = 0, b = 0] = [1, 3, 5]
      .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

describe('landing contrast contract', () => {
  it('preserves the explicitly requested reference orange and records its contrast limitation', () => {
    const paper = color('var(--vt-paper)')
    const hero = color(declaration('.landing h1 em', 'color') ?? '')
    expect(hero?.toLowerCase()).toBe('#ff6b1f')
    // Task 3.11.7: exact color is approved; WCAG color acceptance remains open.
    expect(contrastRatio(hero, paper)).toBeGreaterThan(2.8)
    expect(contrastRatio(hero, paper)).toBeLessThan(3)
  })

  it('records the same open limitation for white text on the reference orange pill', () => {
    const foreground = color(declaration('.landing-preview__pill', 'color') ?? '')
    const background = color(declaration('.landing-preview__pill', 'background') ?? '')
    expect(contrastRatio(foreground, background)).toBeLessThan(3)
    expect(contrastRatio(foreground, background)).toBeGreaterThan(2.8)
  })

  it('keeps keyboard focus visible on the dark organizer card', () => {
    const outline = color(
      declaration('.landing__role--organizer a:focus-visible', 'outline-color') ?? '',
    )
    const background = color(declaration('.landing__role--organizer', 'background') ?? '')
    expect(contrastRatio(outline, background)).toBeGreaterThanOrEqual(3)
  })
})
