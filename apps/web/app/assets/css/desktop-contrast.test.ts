import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const mainCss = readFileSync(new URL('./main.css', import.meta.url), 'utf8')
const desktopCss = readFileSync(new URL('./desktop.css', import.meta.url), 'utf8')
const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function property(css: string, selector: string, name: string): string | undefined {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1]
  return body?.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`))?.[1]?.trim()
}

function color(value: string | undefined): string {
  if (!value) throw new Error('Expected a CSS color')
  const token = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  return token ? color(property(tokensCss, ':root', token)) : value
}

function luminance(hex: string): number {
  const channels = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)?.slice(1)
  if (!channels) throw new Error(`Expected an opaque sRGB hex color, got ${hex}`)
  const [red, green, blue] = channels.map((channel) => {
    const srgb = Number.parseInt(channel, 16) / 255
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter! + 0.05) / (darker! + 0.05)
}

describe('desktop cashbox hero', () => {
  it('keeps its small balance caption readable against the blue card', () => {
    const caption =
      property(desktopCss, '.vt-desktop-cashbox__stats .vt-card--hero .vt-cap', 'color') ??
      property(mainCss, '.vt-cap', 'color')
    const background = property(mainCss, '.vt-card.vt-card--hero', 'background')

    expect(contrastRatio(color(caption), color(background))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('desktop dashboard balance hero (dark theme)', () => {
  const heroRule = '.vt-desktop-dashboard .vt-card.vt-desktop-dashboard__balance'

  it('takes primary text from the on-hero token, not the theme-dependent paper', () => {
    expect(property(desktopCss, heroRule, 'color')).toBe('var(--vt-on-hero)')
    expect(property(desktopCss, '.vt-desktop-dashboard__balance .vt-cap', 'color')).toBe(
      'var(--vt-on-hero)',
    )
    expect(desktopCss).not.toMatch(/vt-desktop-dashboard__balance[^}]*var\(--vt-paper\)/)
  })

  it('takes the explanatory line from the on-hero-2 token', () => {
    expect(
      property(
        desktopCss,
        '.vt-desktop-dashboard__balance > p:not(.vt-desktop-dashboard__balance-value)',
        'color',
      ),
    ).toBe('var(--vt-on-hero-2)')
  })

  it('keeps on-hero text readable on blue ink, and the dark theme does not override it', () => {
    // Token declarations may follow a comment line, which the shared property() helper does not match.
    const tokenValue = (name: string) =>
      tokensCss.match(new RegExp(`[\\s;]${name}:\\s*([^;]+);`))?.[1]?.trim()
    expect(
      contrastRatio(tokenValue('--vt-on-hero') ?? '', tokenValue('--vt-blue-ink') ?? ''),
    ).toBeGreaterThanOrEqual(4.5)
    const darkBlock = tokensCss.match(/\.dark,\s*\.vt-dark\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(darkBlock).not.toContain('--vt-on-hero')
    expect(darkBlock).not.toContain('--vt-blue-ink')
  })
})
