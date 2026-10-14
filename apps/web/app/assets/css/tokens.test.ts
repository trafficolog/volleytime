import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const tailwind = readFileSync(new URL('../../../tailwind.config.ts', import.meta.url), 'utf8')
const nuxt = readFileSync(new URL('../../../nuxt.config.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.css', import.meta.url), 'utf8')
const desktop = readFileSync(new URL('./desktop.css', import.meta.url), 'utf8')
const landing = readFileSync(new URL('./landing.css', import.meta.url), 'utf8')
const publicDir = fileURLToPath(new URL('../../../public/', import.meta.url))
const FS_SCALE_PX = [11, 12, 13, 14, 16, 18, 20, 24, 28, 34, 44, 56, 72]

function contrastRatio(foreground: string | undefined, background: string | undefined): number {
  if (!foreground || !background) return 0
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    const [r = 0, g = 0, b = 0] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function declarations(selector: ':root' | '.dark'): Record<string, string> {
  const escaped =
    selector === '.dark' ? '(?:\\.dark\\s*,\\s*\\.vt-dark|\\.dark|\\.vt-dark)' : ':root'
  const blocks = [...tokens.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
  const result: Record<string, string> = {}
  for (const block of blocks) {
    const body = block[1]
    if (!body) continue
    for (const declaration of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      const [, name, value] = declaration
      if (name && value) result[name] = value.trim()
    }
  }
  return result
}

describe('Bento Bold design token contract', () => {
  it('uses the final light palette instead of the old warm reference layer', () => {
    expect(declarations(':root')).toMatchObject({
      '--vt-paper': '#ffffff',
      '--vt-bone': '#f4f4f6',
      '--vt-bone-2': '#ececf0',
      '--vt-ink': '#15161a',
      '--vt-mute': '#6a6b73',
      '--vt-flame': '#2437c9',
      '--vt-flame-deep': '#1a2aa3',
      '--vt-orange-soft': '#ffe9dc',
      '--vt-blue-soft-tile': '#e8ebff',
    })
  })

  it('exposes the final type and spacing roles without conflating numbers and code', () => {
    expect(declarations(':root')).toMatchObject({
      '--f-display': "'Oswald', 'Golos Text', system-ui, sans-serif",
      '--f-body': "'Golos Text', system-ui, sans-serif",
      '--f-num': "'Oswald', 'Golos Text', system-ui, sans-serif",
      '--f-mono': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      '--r-card': '20px',
      '--r-btn': '14px',
      '--s-4': '16px',
    })
    expect(nuxt).toContain("'~/assets/css/landing-fonts.css'")
    expect(nuxt).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
    expect(nuxt).not.toMatch(/Space\+Grotesk|family=Manrope/)
    expect(tailwind).toContain("display: ['var(--f-display)']")
    expect(tailwind).toContain("body: ['var(--f-body)']")
    expect(tailwind).toContain("num: ['var(--f-num)']")
    expect(main).toContain('font-family: var(--f-num)')
  })

  it('keeps a deliberate dark palette and semantic success/danger roles', () => {
    expect(declarations('.dark')).toMatchObject({
      '--vt-paper': '#0f1013',
      '--vt-ink': '#f2f2f5',
    })
    expect(declarations(':root')).toMatchObject({
      '--vt-grass': '#456f34',
      '--vt-rose': '#be2f3f',
    })
  })

  it('keeps accent links and success buttons readable in both themes', () => {
    const light = declarations(':root')
    const dark = { ...light, ...declarations('.dark') }
    for (const theme of [light, dark]) {
      expect(contrastRatio(theme['--vt-link'], theme['--vt-paper'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(theme['--vt-link'], theme['--vt-bone'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(theme['--vt-on-grass'], theme['--vt-grass'])).toBeGreaterThanOrEqual(4.5)
    }
    expect(tailwind).toContain("link: v('link')")
    expect(main).toContain('color: var(--vt-on-grass)')
    expect(main).toContain('color: var(--vt-flame-ink)')
    expect(main.match(/color: var\(--vt-on-grass\)/g)).toHaveLength(2)
  })

  it('keeps OTP fields monospace despite generic field font inheritance', () => {
    const field = main.indexOf('.vt-field {')
    const override = main.indexOf('.vt-field.vt-code {')
    expect(field).toBeGreaterThanOrEqual(0)
    expect(override).toBeGreaterThan(field)
    expect(main.slice(override)).toContain('font-family: var(--f-mono)')
    const numericOverride = main.indexOf('.vt-field.vt-mono {')
    expect(numericOverride).toBeGreaterThan(field)
    expect(main.slice(numericOverride)).toContain('font-family: var(--f-num)')
  })
})

describe('Bento Bold v3 token scale and overlays', () => {
  it('defines the v3 type scale as --fs-* steps', () => {
    expect(declarations(':root')).toMatchObject({
      '--fs-2xs': '11px',
      '--fs-xs': '12px',
      '--fs-sm': '13px',
      '--fs-base': '14px',
      '--fs-md': '16px',
      '--fs-lg': '18px',
      '--fs-xl': '20px',
      '--fs-2xl': '24px',
      '--fs-3xl': '28px',
      '--fs-4xl': '34px',
      '--fs-5xl': '44px',
      '--fs-6xl': '56px',
      '--fs-7xl': '72px',
      '--text-cap': 'var(--fs-2xs)',
      '--text-nano': '10px',
    })
  })

  it('defines the v3 radii and spacing steps', () => {
    expect(declarations(':root')).toMatchObject({
      '--r-xs': '4px',
      '--r-sm': '8px',
      '--r-chip': '10px',
      '--r-field': '12px',
      '--r-btn': '14px',
      '--r-tile': '18px',
      '--r-card': '20px',
      '--r-pill': '999px',
      '--s-10': '40px',
      '--s-12': '48px',
    })
  })

  it('defines on-hero text, status and overlay tokens with v3 values', () => {
    // Compare in canonical form: case, whitespace after commas and leading zeros are formatting only.
    const canonical = (value: string) =>
      value
        .toLowerCase()
        .replace(/,\s+/g, ',')
        .replace(/(^|[^\d])\.(\d)/g, '$10.$2')
    const actual = Object.fromEntries(
      Object.entries(declarations(':root')).map(([name, value]) => [name, canonical(value)]),
    )
    expect(actual).toMatchObject({
      '--vt-on-hero': '#ffffff',
      '--vt-on-hero-2': 'rgba(255,255,255,0.86)',
      '--vt-on-hero-3': 'rgba(255,255,255,0.74)',
      '--vt-on-hero-line': 'rgba(255,255,255,0.22)',
      '--vt-on-hero-fill': 'rgba(255,255,255,0.14)',
      '--vt-grass-on-hero': '#c4f2ae',
      '--vt-meter-ok-on-hero': '#9edb86',
      '--vt-amber-on-hero': '#ffc94d',
      '--vt-rose-on-hero': '#ff9aa6',
      '--vt-rose-on-ink': '#ffb4bc',
      '--vt-scrim': 'rgba(14,14,16,0.45)',
      '--vt-toast-bg': 'rgba(14,14,16,0.88)',
      '--vt-seg-shadow': '0 1px 2px rgba(0,0,0,0.06)',
      '--vt-sheet-shadow': '0 -12px 32px rgba(0,0,0,0.18)',
      '--vt-pop-shadow': '0 12px 32px rgba(0,0,0,0.15),0 0 0 0.5px rgba(0,0,0,0.04)',
      '--vt-modal-shadow': '0 24px 48px rgba(0,0,0,0.25)',
      '--vt-toast-shadow': '0 8px 24px rgba(0,0,0,0.25)',
      '--vt-shadow-accent': '0 16px 32px -16px rgba(21,22,26,0.28)',
    })
  })

  it('keeps text on hero and rose-on-ink tokens readable', () => {
    const light = declarations(':root')
    for (const token of [
      '--vt-on-hero',
      '--vt-grass-on-hero',
      '--vt-meter-ok-on-hero',
      '--vt-amber-on-hero',
      '--vt-rose-on-hero',
    ]) {
      expect(contrastRatio(light[token], light['--vt-blue-ink']), token).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio(light['--vt-rose-on-ink'], light['--vt-ink'])).toBeGreaterThanOrEqual(4.5)
  })

  it('uses only scale-step px font sizes in shared stylesheets', () => {
    const pattern = new RegExp(`font-size:\\s*(?:${FS_SCALE_PX.join('|')})px\\b`)
    for (const [name, css] of Object.entries({
      'main.css': main,
      'desktop.css': desktop,
      'landing.css': landing,
    })) {
      expect(css.match(pattern)?.[0], name).toBeUndefined()
    }
  })

  it('ships the v3 SVG logo set and points the favicon at it', () => {
    for (const file of [
      'vt-mark-color.svg',
      'vt-favicon.svg',
      'vt-apple-touch-icon.svg',
      'vt-app-blue.svg',
    ]) {
      expect(existsSync(join(publicDir, 'logo', file)), file).toBe(true)
    }
    expect(nuxt).toContain("href: '/logo/vt-favicon.svg'")
    expect(nuxt).toContain("type: 'image/svg+xml'")
    expect(nuxt).not.toContain('/favicon.png')
  })

  it('switches the colour logo mark to the on-blue variant on dark surfaces', () => {
    expect(existsSync(join(publicDir, 'logo', 'vt-mark-on-blue.svg'))).toBe(true)
    expect(main).toMatch(
      /:is\(\.dark, \.vt-dark\) img\[src\$='\/logo\/vt-mark-color\.svg'\]\s*\{\s*content:\s*url\('\/logo\/vt-mark-on-blue\.svg'\)/,
    )
  })

  it('does not reference the retired PNG logo from app code', () => {
    function scan(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return scan(path)
        if (!/\.(vue|ts|css)$/.test(path) || /\.test\.ts$/.test(path)) return []
        return readFileSync(path, 'utf8').includes('/logo.png') ? [path] : []
      })
    }
    expect(scan(fileURLToPath(new URL('../..', import.meta.url)))).toEqual([])
    expect(existsSync(join(publicDir, 'logo.png'))).toBe(false)
  })

  it('documents the deliberate --text-nano deviation from v3', () => {
    expect(tokens).toMatch(/eliberate deviation[\s\S]*?--text-nano: 10px;/)
    expect(tokens).toContain('19.0.2')
  })

  it('ports plain v3 color tokens with light and dark values', () => {
    expect(declarations(':root')).toMatchObject({
      '--vt-raised': '#ffffff',
      '--vt-dock': '#15161a',
      '--vt-dock-idle': '#8a8c96',
      '--vt-night': '#15161a',
      '--vt-orange-ink': '#a33c08',
      '--vt-inverse-bg': '#15161a',
      '--vt-inverse-fg': '#ffffff',
    })
    expect(declarations('.dark')).toMatchObject({
      '--vt-raised': '#23242b',
      '--vt-dock': '#24252c',
      '--vt-dock-idle': '#8c8d96',
      '--vt-orange-ink': '#ffb38a',
      '--vt-inverse-bg': '#f2f2f5',
      '--vt-inverse-fg': '#15161a',
    })
  })

  it('defines the v3 surface-aware control tokens with their defaults', () => {
    expect(declarations(':root')).toMatchObject({
      '--vt-ctl': 'var(--vt-bone)',
      '--vt-ctl-hover': 'var(--vt-bone-2)',
      '--vt-ctl-lift': 'none',
      '--vt-ctl-ink': 'var(--vt-ink)',
      '--vt-ctl-chip': 'var(--vt-bone-2)',
      '--vt-ctl-track': 'var(--vt-bone-2)',
    })
  })

  it('overrides control tokens per surface as in v3', () => {
    expect(overrides('.vt-card--hero')).toMatchObject({
      '--vt-ctl': 'var(--vt-on-hero-fill)',
      '--vt-ctl-hover': 'var(--vt-on-hero-line)',
      '--vt-ctl-lift': 'none',
      '--vt-ctl-ink': 'var(--vt-on-hero)',
      '--vt-ctl-chip': 'var(--vt-on-hero-fill)',
      '--vt-ctl-track': 'var(--vt-on-hero-fill)',
    })
    expect(overrides('.vt-on-hero')).toMatchObject({ '--vt-ctl-ink': 'var(--vt-on-hero)' })
    expect(overrides('.vt-card--raised')).toMatchObject({
      '--vt-ctl': 'var(--vt-bone)',
      '--vt-ctl-hover': 'var(--vt-bone-2)',
      '--vt-ctl-lift': 'none',
    })
    expect(overrides('.vt-on-paper')).toMatchObject({ '--vt-ctl': 'var(--vt-bone)' })
    expect(overrides('.vt-on-tone')).toMatchObject({
      '--vt-ctl': 'var(--vt-paper)',
      '--vt-ctl-hover': 'var(--vt-paper)',
      '--vt-ctl-lift': 'var(--vt-shadow-card)',
    })
    expect(overrides('.vt-card--warm')).toMatchObject({ '--vt-ctl': 'var(--vt-paper)' })
    expect(overrides('.vt-card--cool')).toMatchObject({ '--vt-ctl': 'var(--vt-paper)' })
    expect(overrides('.vt-card:not([class*="vt-card--"])')).toMatchObject({
      '--vt-ctl': 'var(--vt-paper)',
      '--vt-ctl-lift': 'var(--vt-shadow-card)',
    })
  })

  it('overrides control tokens for dark surfaces as in v3', () => {
    expect(overrides('.vt-dark .vt-card--raised')).toMatchObject({
      '--vt-ctl': 'var(--vt-bone-2)',
      '--vt-ctl-hover': '#2b2c33',
      '--vt-ctl-chip': '#2b2c33',
      '--vt-ctl-track': '#2b2c33',
    })
    expect(overrides('.vt-dark .vt-on-tone')).toMatchObject({
      '--vt-ctl': '#2b2c33',
      '--vt-ctl-hover': '#34353d',
      '--vt-ctl-lift': 'none',
    })
  })

  it('ships a 180px PNG apple-touch icon and uses it as the PNG fallback', () => {
    const png = readFileSync(join(publicDir, 'logo', 'vt-apple-touch-icon.png'))
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(180)
    expect(png.readUInt32BE(20)).toBe(180)
    const links = [
      ...nuxt
        .replace(/\s+/g, ' ')
        .matchAll(/\{ rel: '([^']+)', type: '([^']+)'[^}]*?href: '([^']+)'/g),
    ].map((match) => ({ rel: match[1], type: match[2], href: match[3] }))
    const svgIcon = links.findIndex(
      (link) => link.type === 'image/svg+xml' && link.href === '/logo/vt-favicon.svg',
    )
    const pngIcon = links.findIndex(
      (link) =>
        link.type === 'image/png' &&
        link.href === '/logo/vt-apple-touch-icon.png' &&
        link.rel === 'icon',
    )
    const touchIcon = links.find((link) => link.rel === 'apple-touch-icon')
    expect(svgIcon).toBeGreaterThanOrEqual(0)
    expect(pngIcon).toBeGreaterThan(svgIcon)
    expect(touchIcon).toEqual({
      rel: 'apple-touch-icon',
      type: 'image/png',
      href: '/logo/vt-apple-touch-icon.png',
    })
  })
})

/** Declarations of every rule whose selector list contains the exact selector part. */
function overrides(selectorPart: string): Record<string, string> {
  const result: Record<string, string> = {}
  const source = tokens.replace(/\/\*[\s\S]*?\*\//g, '')
  const wanted = selectorPart.replace(/"/g, "'")
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const parts = selectors!
      .split(',')
      .map((part) => part.replace(/\s+/g, ' ').replace(/"/g, "'").trim())
    if (!parts.includes(wanted)) continue
    for (const [, name, value] of body!.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      result[name!] = value!.trim()
    }
  }
  return result
}
