import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./main.css', import.meta.url), 'utf8')
const tabBar = readFileSync(new URL('../../components/vt/TabBar.vue', import.meta.url), 'utf8')
const header = readFileSync(new URL('../../components/vt/MiniHeader.vue', import.meta.url), 'utf8')
const empty = readFileSync(new URL('../../components/EmptyState.vue', import.meta.url), 'utf8')
const skeleton = readFileSync(new URL('../../components/SkeletonList.vue', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../../layouts/miniapp-org.vue', import.meta.url), 'utf8')
const settings = readFileSync(
  new URL('../../pages/m/orgs/[orgId]/settings.vue', import.meta.url),
  'utf8',
)

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return ''
  const end = css.indexOf('}', start)
  return css.slice(start, end + 1)
}

describe('Bento Bold MVP atoms', () => {
  it('uses toned surfaces and named hero variants, not a permanent card outline', () => {
    expect(rule('.vt-card')).toContain('border: 0')
    expect(rule('.vt-card')).toContain('border-radius: var(--r-card)')
    expect(rule('.vt-card--raised')).toContain('box-shadow: var(--vt-shadow-card)')
    expect(rule('.vt-card.vt-card--hero')).toContain('background: var(--vt-blue-ink)')
    expect(rule('.vt-card--warm')).toContain('background: var(--vt-orange-soft)')
    expect(rule('.vt-card--cool')).toContain('background: var(--vt-blue-soft-tile)')
    expect(settings).toContain('class="vt-card p-4 mt-5 border border-vt-rose"')
  })

  it('keeps button variants, focus, disabled and reduced-motion states usable', () => {
    expect(rule('.vt-btn')).toContain('border-radius: var(--r-btn)')
    expect(rule('.vt-btn')).toContain('min-height: 44px')
    expect(rule('.vt-btn--ghost')).toContain('background: var(--vt-bone)')
    expect(css).toContain(".vt-btn[aria-disabled='true']")
    expect(css).toContain('box-shadow: none')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('animation: none !important')
  })

  it('uses tonal chips, fields, avatars, and a six-pixel meter', () => {
    expect(rule('.vt-chip')).toContain('border-radius: var(--r-chip)')
    expect(rule('.vt-chip')).toContain('border: 1px solid transparent')
    expect(rule('.vt-field')).toContain('background: var(--vt-bone)')
    expect(rule('.vt-field')).toContain('border-radius: var(--r-field)')
    expect(rule('.vt-field:focus-visible')).toContain('background: var(--vt-paper)')
    expect(rule('.vt-avi')).toContain('border: 0')
    expect(rule('.vt-meter')).toContain('height: 6px')
  })

  it('keeps Mini App navigation semantic with a floating dark tab bar', () => {
    expect(rule('.vt-miniheader')).toContain('border-bottom: 0')
    expect(rule('.vt-tabbar')).toContain('background: var(--vt-tabbar-bg)')
    expect(rule('.vt-tabbar')).toContain('margin: 0 12px 14px')
    expect(rule('.vt-tabbar a')).toContain('min-height: 58px')
    expect(rule('.vt-tabbar a:focus-visible')).toContain('outline-color: var(--vt-tabbar-active)')
    expect(tabBar).toContain('<nav class="vt-tabbar"')
    expect(tabBar).toContain('<NuxtLink')
    expect(tabBar).toContain(':aria-current="isActive(t) ? \'page\' : undefined"')
    expect(header).toContain('useBackButton')
    expect(header).toContain('v-if="back && !useNativeBack"')
    expect(layout).toContain('pb-[calc(86px+env(safe-area-inset-bottom))]')
  })

  it('keeps empty and loading states accessible and theme-ready', () => {
    expect(empty).toContain('bg-vt-bone-2')
    expect(empty).not.toContain('border border-vt-stroke')
    expect(empty).toContain('font-body')
    expect(skeleton).toContain('aria-busy="true"')
    expect(skeleton).toContain('aria-label="Загрузка"')
  })
})
