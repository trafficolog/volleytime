// @vitest-environment happy-dom
import type { User } from '@volley-time/db'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, onMounted, ref } from 'vue'

import { useAuth } from '../composables/useAuth'

import Landing from './index.vue'

const storedUser: User = {
  id: 112,
  email: 'landing-qa@example.test',
  emailVerified: true,
  name: null,
  telegramUserId: null,
  telegramUsername: null,
  phone: null,
  image: null,
  isActive: true,
  isRootAdmin: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  botBlockedAt: null,
  createdAt: new Date('2026-09-28T00:00:00Z'),
  updatedAt: new Date('2026-09-28T00:00:00Z'),
}
const loginHref = '/auth/login?redirect=%2Fm%2Forgs%2Fcreate'
const mounted: VueWrapper[] = []

const catalog = [
  { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', badge: null },
  { code: 'events_30', units: 30, amount: 12000, currency: 'BYN', badge: 'popular' },
  { code: 'events_100', units: 100, amount: 35000, currency: 'BYN', badge: 'discount' },
]

function setup(
  response: () => Promise<{ user: User | null }>,
  initialUser: User | null = null,
  packages: () => Promise<{ packages: unknown[] }> = async () => ({ packages: [] }),
) {
  const states = new Map<string, ReturnType<typeof ref>>()
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  })
  vi.stubGlobal('$fetch', async (url: string) => {
    if (url === '/api/public/event-balance-packages') return packages()
    if (url !== '/api/auth/get-session') throw new Error(`Unexpected request: ${url}`)
    return response()
  })
  vi.stubGlobal('useAuth', useAuth)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { telegramBotUsername: 'volleytimeby_bot' } }))
  vi.stubGlobal('useHead', () => undefined)
  const auth = useAuth()
  auth.user.value = initialUser
  const errors: unknown[] = []
  const wrapper = mount(Landing, {
    global: {
      config: { errorHandler: (error) => errors.push(error) },
      stubs: { VtIcon: true, LandingPreview: true, LandingMotion: true },
      components: {
        NuxtLink: defineComponent({
          props: { to: { type: String, required: true } },
          setup:
            (props, { slots }) =>
            () =>
              h('a', { href: props.to }, slots.default?.()),
        }),
      },
    },
  })
  mounted.push(wrapper)
  return { wrapper, errors, auth }
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('landing session fallback', () => {
  it('handles a rejected session request without escaping to the Vue error handler', async () => {
    const { wrapper, errors } = setup(async () => {
      throw new Error('session unavailable')
    })

    await flushPromises()

    expect(errors).toEqual([])
    expect(wrapper.get('.landing__header-cta').attributes('href')).toBe(loginHref)
    expect(wrapper.findAll('.landing__faq details')).toHaveLength(4)
  })

  it('does not treat a retained user as a confirmed session after a request failure', async () => {
    const { wrapper, errors, auth } = setup(async () => {
      throw new Error('session unavailable')
    }, storedUser)

    await flushPromises()

    expect(wrapper.get('.landing__header-cta').attributes('href')).toBe(loginHref)
    expect(auth.user.value).toEqual(storedUser)
    expect(errors).toEqual([])
  })

  it('keeps the anonymous CTA while a retained user awaits server confirmation', async () => {
    let resolveSession!: (response: { user: User | null }) => void
    const response = new Promise<{ user: User | null }>((resolve) => {
      resolveSession = resolve
    })
    const { wrapper } = setup(() => response, storedUser)

    expect(wrapper.get('.landing__header-cta').attributes('href')).toBe(loginHref)

    resolveSession({ user: storedUser })
    await flushPromises()

    expect(wrapper.get('.landing__header-cta').attributes('href')).toBe('/m/orgs/create')
  })

  it('links directly to group creation after a successful session response', async () => {
    const { wrapper, errors } = setup(async () => ({ user: storedUser }))

    await flushPromises()

    expect(wrapper.get('.landing__header-cta').attributes('href')).toBe('/m/orgs/create')
    expect(errors).toEqual([])
  })

  it('uses the login redirect when the server confirms no current user', async () => {
    const { wrapper, auth, errors } = setup(async () => ({ user: null }), storedUser)

    await flushPromises()

    expect(wrapper.get('.landing__header-cta').attributes('href')).toBe(loginHref)
    expect(auth.user.value).toBeNull()
    expect(errors).toEqual([])
  })
})

describe('landing pricing block (24.1.4)', () => {
  const session = async () => ({ user: null })

  it('renders the catalog prices with the catalog badge, a nav link and a footer link', async () => {
    const { wrapper, errors } = setup(session, null, async () => ({ packages: catalog }))
    await flushPromises()

    const section = wrapper.get('#pricing')
    expect(section.get('h2').text()).toBe('Платите за игры,а не за подписку')
    const cards = section.findAll('.landing__price')
    expect(cards.map((c) => c.text())).toEqual([
      '10событий50 Br5,00 Br за событие',
      'Популярный30событий120 Br4,00 Br за событие',
      'Скидка100событий350 Br3,50 Br за событие',
    ])
    expect(section.find('.landing__price--hot').text()).toContain('30')
    expect(section.text()).not.toMatch(/credit|%/i)
    expect(wrapper.findAll('a[href="#pricing"]')).toHaveLength(2)
    expect(section.get('a').attributes('href')).toBe(loginHref)
    expect(errors).toEqual([])
  })

  it('hides the block and its links when the catalog is empty or unavailable', async () => {
    for (const packages of [
      async () => ({ packages: [] }),
      async () => {
        throw new Error('catalog unavailable')
      },
    ]) {
      const { wrapper, errors } = setup(session, null, packages)
      await flushPromises()
      expect(wrapper.find('#pricing').exists()).toBe(false)
      expect(wrapper.findAll('a[href="#pricing"]')).toHaveLength(0)
      expect(errors).toEqual([])
    }
  })
})
