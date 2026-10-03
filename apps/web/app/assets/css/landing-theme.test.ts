// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const tokens = readFileSync('apps/web/app/assets/css/tokens.css', 'utf8')
const landingCss = readFileSync('apps/web/app/assets/css/landing.css', 'utf8')

// These are the accepted light reference values, independent of the stylesheet.
const referencePalette = {
  '--vt-bone': '#f4f4f6',
  '--vt-bone-2': '#ececf0',
  '--vt-ink': '#15161a',
  '--vt-ink-3': '#3d3e45',
  '--vt-mute-2': '#5b5c64',
  '--vt-flame': '#2437c9',
  '--vt-blue-ink': '#1f2e96',
  '--vt-orange': '#ff6b1f',
  '--vt-orange-soft': '#ffe9dc',
  '--vt-orange-ink': '#a33c08',
  '--vt-amber': '#ffb627',
  '--vt-amber-ink': '#74490a',
  '--vt-grass': '#456f34',
  '--vt-grass-ink': '#33521f',
  '--vt-focus': '#15161a',
  '--vt-shadow-card': '0 1px 2px rgba(21, 22, 26, 0.04), 0 10px 28px -10px rgba(21, 22, 26, 0.14)',
  '--vt-shadow-accent': 'none',
  '--vt-tg-blue': '#2aabee',
}

function style(selector: string): CSSStyleDeclaration {
  const element = document.querySelector(selector)
  if (!element) throw new Error(`Missing landing fixture: ${selector}`)
  return getComputedStyle(element)
}

beforeEach(() => {
  const sheet = document.createElement('style')
  sheet.dataset.landingThemeTest = 'true'
  sheet.textContent = tokens + landingCss
  document.head.append(sheet)
  document.body.innerHTML = `
    <div id="ancestor">
      <div id="app-theme-probe" style="color: var(--vt-ink)"></div>
      <div class="landing">
        <div id="landing-token-probe"></div>
        <section class="landing__features">
          <h2 id="features-title">Всё для тренировок</h2>
          <article class="landing__feature landing__feature--4">
            <h3>Учёт оплат</h3><p>Расчёт после закрытия</p>
            <div class="landing__ledger-row"><svg></svg>Оплата<small>Подтверждена</small></div>
          </article>
          <article class="landing__feature landing__feature--6">
            <h3>Состав</h3><p>Игроки и очередь</p>
            <div class="landing__roster-example"><i>АК</i></div>
          </article>
        </section>
      </div>
    </div>`
})

afterEach(() => {
  document.documentElement.className = ''
  document.body.innerHTML = ''
  document.querySelector('[data-landing-theme-test]')?.remove()
})

describe.each([
  ['light', '', ''],
  ['html.dark', 'dark', ''],
  ['html.vt-dark', 'vt-dark', ''],
  ['parent.dark', '', 'dark'],
  ['parent.vt-dark', '', 'vt-dark'],
])('landing reference palette under %s ancestry', (_appearance, htmlClass, parentClass) => {
  beforeEach(() => {
    document.documentElement.className = htmlClass
    document.querySelector('#ancestor')!.className = parentClass
  })

  it('keeps every consumed palette role local without changing the ancestor app palette', () => {
    for (const [token, expected] of Object.entries(referencePalette)) {
      const probe = document.querySelector<HTMLElement>('#landing-token-probe')!
      const property = token.startsWith('--vt-shadow') ? 'box-shadow' : 'color'
      probe.style.setProperty(property, `var(${token})`)
      expect(getComputedStyle(probe).getPropertyValue(property), token).toBe(expected)
    }
    // happy-dom resolves ordinary var() colors, but does not render color-mix().
    // Check these two local derivations in its parsed CSSOM; Chrome owns the pixel check.
    const rule = [...document.styleSheets[0]!.cssRules].find(
      (candidate) => candidate instanceof CSSStyleRule && candidate.selectorText === '.landing',
    ) as CSSStyleRule
    expect(rule.style.getPropertyValue('--vt-amber-soft')).toBe(
      'color-mix(in oklab, var(--vt-amber) 16%, transparent)',
    )
    expect(rule.style.getPropertyValue('--vt-grass-soft')).toBe(
      'color-mix(in oklab, var(--vt-grass) 14%, transparent)',
    )
    expect(style('#app-theme-probe').color).toBe(htmlClass || parentClass ? '#f2f2f5' : '#15161a')
  })

  it('keeps the features heading and white ledger readable in the reference font roles', () => {
    expect(style('.landing').backgroundColor).toBe('#fff')
    expect(style('#features-title').color).toBe('#15161a')
    expect(style('#features-title').fontFamily).toBe('Oswald, "Golos Text", system-ui, sans-serif')
    expect(style('.landing__feature--4').backgroundColor).toBe('#fff')
    expect(style('.landing__feature--4 h3').color).toBe('#15161a')
    expect(style('.landing__feature--4 p').color).toBe('#3d3e45')
    expect(style('.landing__ledger-row').color).toBe('#15161a')
    expect(style('.landing__ledger-row small').color).toBe('#5b5c64')
    expect(style('.landing__ledger-row svg').color).toBe('#456f34')
    expect(style('.landing__feature--4 p').fontFamily).toBe('"Golos Text", system-ui, sans-serif')
  })

  it('keeps the inverse roster dark with its white foregrounds', () => {
    expect(style('.landing__feature--6').backgroundColor).toBe('#15161a')
    expect(style('.landing__feature--6 h3').color).toBe('#fff')
    expect(style('.landing__feature--6 p').color).toBe('rgba(255, 255, 255, 0.82)')
    expect(style('.landing__roster-example i').color).toBe('#fff')
    expect(style('.landing__roster-example i').backgroundColor).toBe('rgba(255, 255, 255, 0.15)')
  })
})
