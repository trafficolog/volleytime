// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import Root from './root.vue'

let wrapper: VueWrapper | undefined
let me: unknown
let pending: boolean

const policiesOf = (...names: string[]) => ['self', ...names]
const ROLES: Record<string, { userId: number; role: string; policies: string[] }> = {
  owner: {
    userId: 1,
    role: 'owner',
    policies: policiesOf(
      'overview',
      'organizations',
      'users',
      'balance',
      'subscriptions',
      'groupPages',
      'audit',
      'settings',
      'team',
    ),
  },
  support: {
    userId: 3,
    role: 'support',
    policies: policiesOf('overview', 'organizations', 'users', 'groupPages', 'audit'),
  },
  analyst: {
    userId: 6,
    role: 'analyst',
    policies: policiesOf('overview', 'organizations', 'balance', 'subscriptions'),
  },
}

beforeEach(() => {
  me = ROLES.owner
  pending = false
  vi.stubGlobal('useAuth', () => ({ user: ref({ email: 'root@volleytime.by', name: 'Root' }) }))
  vi.stubGlobal('useRoute', () => ({ path: '/root' }))
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useFetch', () => ({ data: ref(null) }))
  vi.stubGlobal('usePlatformStaffMe', () => ({
    data: ref(me),
    pending: ref(pending),
    refresh: vi.fn(),
  }))
  vi.stubGlobal('computed', computed)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(Root, {
    attachTo: document.body,
    slots: { default: '<p>content</p>' },
    global: {
      stubs: {
        VtIcon: true,
        NuxtLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

const links = (w: VueWrapper) => w.findAll('.vt-root__nav a').map((a) => a.text())

describe('layout root: menu by role (29.3.1, R-15)', () => {
  it('Owner sees every section', async () => {
    const w = await render()
    expect(links(w)).toEqual([
      'Обзор платформы',
      'Организации',
      'Пользователи',
      'Баланс и тарифы',
      'Подписки и выплаты',
      'Страницы групп',
      'Аналитика функций',
      'Аудит',
      'Настройки',
    ])
    expect(w.get('[data-testid="root-role"]').text()).toContain('Owner')
    expect(w.get('[data-testid="root-role"]').text()).toContain('Владелец платформы')
  })

  it('Support sees no money and no settings', async () => {
    me = ROLES.support
    const w = await render()
    expect(links(w)).toEqual([
      'Обзор платформы',
      'Организации',
      'Пользователи',
      'Страницы групп',
      'Аналитика функций',
      'Аудит',
    ])
    expect(w.get('[data-testid="root-role"]').text()).toContain('Support')
  })

  it('Analyst sees only overview, organizations and money', async () => {
    me = ROLES.analyst
    const w = await render()
    expect(links(w)).toEqual([
      'Обзор платформы',
      'Организации',
      'Баланс и тарифы',
      'Подписки и выплаты',
      'Аналитика функций',
    ])
  })

  it('shows no sections while the role loads, so a hidden section never flashes', async () => {
    me = null
    pending = true
    const w = await render()
    expect(links(w)).toEqual([])
    expect(w.find('[data-testid="root-role"]').exists()).toBe(false)
  })

  it('without a role after a failed load falls back to the full menu: the server still decides', async () => {
    me = null
    pending = false
    const w = await render()
    expect(links(w)).toHaveLength(9)
  })
})
