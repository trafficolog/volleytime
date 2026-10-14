// @vitest-environment happy-dom
import type { User } from '@volley-time/db'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

import TelegramLoginButton from '../../components/TelegramLoginButton.vue'
import VtIcon from '../../components/vt/Icon.vue'
import { useAuth } from '../../composables/useAuth'

import Login from './login.vue'

const user = { id: 1, email: 'o@example.test' } as unknown as User
const owner = {
  id: 7,
  name: 'VolleyTime Минск',
  status: 'active',
  membershipRole: 'owner',
  membershipStatus: 'active',
}
const second = { ...owner, id: 8, name: 'СпайкКлуб', membershipRole: 'organizer' }
const mounted: VueWrapper[] = []
// the widget script is injected for real in the page; do not try to load it from the network
;(
  window as unknown as { happyDOM: { settings: Record<string, boolean> } }
).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true

interface Scenario {
  options?: () => Promise<unknown>
  /** Результат POST-запросов по пути; не заданный путь падает как 500. */
  post?: Record<string, () => Promise<unknown>>
  session?: () => Promise<{ user: User | null }>
  orgs?: () => Promise<{ organizations: unknown[] }>
  query?: Record<string, unknown>
}

function setup(scenario: Scenario = {}) {
  const states = new Map<string, Ref>()
  const calls: { url: string; options?: { method?: string; body?: unknown } }[] = []
  const navigations: string[] = []
  const headings: string[] = []
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('nextTick', nextTick)
  vi.stubGlobal('onMounted', onMounted)
  vi.stubGlobal('onUnmounted', onUnmounted)
  vi.stubGlobal('useHead', (head: { title: string }) => headings.push(head.title))
  vi.stubGlobal('useRoute', () => ({ query: scenario.query ?? {} }))
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { telegramBotUsername: 'volleytimeby_bot' } }))
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()))
    return states.get(key)
  })
  vi.stubGlobal('navigateTo', async (to: string) => {
    navigations.push(to)
  })
  vi.stubGlobal('$fetch', async (url: string, options?: { method?: string; body?: unknown }) => {
    calls.push({ url, options })
    if (url === '/api/auth/login-options') {
      return scenario.options ? scenario.options() : { telegramWidget: null }
    }
    if (url === '/api/auth/get-session') {
      return scenario.session ? scenario.session() : { user }
    }
    if (url === '/api/organizations') {
      return scenario.orgs ? scenario.orgs() : { organizations: [owner] }
    }
    if (options?.method === 'POST') {
      const handler = scenario.post?.[url]
      if (handler) return handler()
      if (url === '/api/auth/sign-out') return {}
      if (url === '/api/auth/email-otp/send-verification-otp') return { success: true }
      if (url === '/api/auth/sign-in/email-otp') return { token: 'redacted' }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('useAuth', useAuth)
  vi.stubGlobal('useOrganizations', () => {
    const orgs = states.get('orgs.list') ?? ref<unknown[]>([])
    states.set('orgs.list', orgs)
    return {
      orgs,
      fetchAll: async () => {
        orgs.value = (
          await $fetch<{ organizations: unknown[] }>('/api/organizations')
        ).organizations
      },
    }
  })
  const errors: unknown[] = []
  const wrapper = mount(Login, {
    attachTo: document.body,
    global: {
      config: { errorHandler: (error) => errors.push(error) },
      components: { VtIcon, TelegramLoginButton },
    },
  })
  mounted.push(wrapper)
  return { wrapper, calls, navigations, errors, headings }
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  delete (window as unknown as Record<string, unknown>).vtTelegramLoginAuth
})

const widgetOn = async () => ({ telegramWidget: { botUsername: 'volleytimeby_bot' } })
const widgetScript = () =>
  document.querySelector<HTMLScriptElement>('script[data-telegram-login]') ?? null

async function toCodeStep(wrapper: VueWrapper) {
  await wrapper.get('#email').setValue('o@example.test')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('login: email code sign-in (always available)', () => {
  it('starts on the email step with an h1, a labelled email field and no widget', async () => {
    const { wrapper, errors } = setup()
    await flushPromises()
    expect(errors).toEqual([])
    expect(wrapper.get('h1').text()).toBe('Кабинет организатора')
    expect(wrapper.get('label[for="email"]').text()).toBe('Email')
    expect(wrapper.get('#email').attributes('autocomplete')).toBe('email')
    expect(widgetScript()).toBeNull()
    expect(wrapper.find('[data-testid="telegram-login-widget"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Войти через Telegram')
  })

  it('moves focus to the new step heading', async () => {
    const { wrapper } = setup()
    await flushPromises()
    await toCodeStep(wrapper)
    expect(wrapper.get('h1').text()).toBe('Введите код')
    expect(document.activeElement).toBe(wrapper.get('h1').element)
  })

  it('sends the code, shows the 6-digit step with the resend countdown', async () => {
    const { wrapper, calls } = setup()
    await flushPromises()
    await toCodeStep(wrapper)
    const send = calls.find((c) => c.url.endsWith('/send-verification-otp'))!
    expect(send.options?.body).toEqual({ email: 'o@example.test', type: 'sign-in' })
    expect(wrapper.text()).toContain('o@example.test')
    expect(wrapper.get('label[for="otp"]').text()).toContain('Код')
    expect(wrapper.get('#otp').attributes('autocomplete')).toBe('one-time-code')
    expect(wrapper.text()).toContain('Повтор через 1:00')
  })

  it('counts the resend timer down and then offers a resend button', async () => {
    vi.useFakeTimers()
    const { wrapper, calls } = setup()
    await flushPromises()
    await toCodeStep(wrapper)
    await vi.advanceTimersByTimeAsync(42_000)
    expect(wrapper.text()).toContain('Повтор через 0:18')
    await vi.advanceTimersByTimeAsync(18_000)
    const resend = wrapper.findAll('button').find((b) => b.text() === 'Отправить повторно')!
    await resend.trigger('click')
    await flushPromises()
    expect(calls.filter((c) => c.url.endsWith('/send-verification-otp'))).toHaveLength(2)
  })

  it('announces a send failure and keeps the email field marked invalid', async () => {
    const { wrapper } = setup({
      post: {
        '/api/auth/email-otp/send-verification-otp': async () => {
          throw new Error('boom')
        },
      },
    })
    await flushPromises()
    await wrapper.get('#email').setValue('o@example.test')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Не удалось отправить код')
    expect(wrapper.get('#email').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#email').attributes('aria-describedby')).toBe(alert.attributes('id'))
    expect(wrapper.get('h1').text()).toBe('Кабинет организатора')
  })

  it('shows a wrong-code error, stays on the code step and clears it on typing', async () => {
    const { wrapper, navigations } = setup({
      post: {
        '/api/auth/sign-in/email-otp': async () => {
          throw new Error('401')
        },
      },
    })
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Введите код')
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Неверный или просроченный код')
    expect(wrapper.get('#otp').attributes('aria-invalid')).toBe('true')
    expect(navigations).toEqual([])
    await wrapper.get('#otp').setValue('42719')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('does not submit an incomplete code', async () => {
    const { wrapper, calls } = setup()
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('4271')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(calls.some((c) => c.url === '/api/auth/sign-in/email-otp')).toBe(false)
  })

  it('opens the only organization after a correct code', async () => {
    const { wrapper, navigations } = setup()
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(navigations).toEqual(['/m/orgs/7'])
  })

  it('lists several organizations and navigates to the picked one', async () => {
    const { wrapper, navigations } = setup({
      orgs: async () => ({ organizations: [owner, second] }),
    })
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Выберите организацию')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('СпайкКлуб'))!
      .trigger('click')
    await flushPromises()
    expect(navigations).toEqual(['/m/orgs/8'])
  })

  it('shows no-access for a player and lets them sign out', async () => {
    const { wrapper, calls } = setup({
      orgs: async () => ({ organizations: [{ ...owner, membershipRole: 'player' }] }),
    })
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Нет доступа организатора')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Сменить аккаунт')!
      .trigger('click')
    await flushPromises()
    expect(calls.some((c) => c.url === '/api/auth/sign-out')).toBe(true)
    expect(wrapper.get('h1').text()).toBe('Кабинет организатора')
  })

  it('shows the blocked state for a suspended organization', async () => {
    const { wrapper } = setup({
      orgs: async () => ({ organizations: [{ ...owner, status: 'suspended' }] }),
    })
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Доступ приостановлен')
    expect(wrapper.text()).toContain('VolleyTime Минск')
  })

  it('offers a retry without a new code when organizations fail to load', async () => {
    let attempt = 0
    const { wrapper, navigations } = setup({
      orgs: async () => {
        attempt += 1
        if (attempt === 1) throw new Error('offline')
        return { organizations: [owner] }
      },
    })
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('Не удалось загрузить организации')
    expect(wrapper.get('[role="alert"]').text()).toContain('Повторный код не нужен')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Повторить загрузку')!
      .trigger('click')
    await flushPromises()
    expect(navigations).toEqual(['/m/orgs/7'])
  })

  it('announces the verifying state politely', async () => {
    let release: (value: { user: User }) => void = () => undefined
    const { wrapper } = setup({
      session: () => new Promise((resolve) => (release = resolve)),
    })
    await flushPromises()
    await toCodeStep(wrapper)
    await wrapper.get('#otp').setValue('427193')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Проверяем')
    expect(wrapper.get('main').attributes('aria-busy')).toBe('true')
    release({ user })
    await flushPromises()
  })
})

describe('login: Telegram Login Widget (D-05, flag from the server)', () => {
  it('renders the widget only when the server says the flag is on, via data-onauth', async () => {
    const { wrapper, calls } = setup({ options: widgetOn })
    await flushPromises()
    expect(calls.some((c) => c.url === '/api/auth/login-options')).toBe(true)
    expect(wrapper.find('[data-testid="telegram-login-widget"]').exists()).toBe(true)
    const script = widgetScript()!
    expect(script.src).toMatch(/^https:\/\/telegram\.org\/js\/telegram-widget\.js/)
    expect(script.getAttribute('data-telegram-login')).toBe('volleytimeby_bot')
    expect(script.getAttribute('data-onauth')).toBe('vtTelegramLoginAuth(user)')
    expect(script.hasAttribute('data-auth-url')).toBe(false)
    expect(document.documentElement.outerHTML).not.toContain('data-auth-url')
  })

  it('keeps the widget slot and the "или" divider hidden until Telegram draws its button', async () => {
    const { wrapper } = setup({ options: widgetOn })
    await flushPromises()
    const slot = wrapper.get('[data-testid="telegram-login-widget"]')
    expect((slot.element as HTMLElement).style.display).toBe('none')
    expect(wrapper.find('.auth__divider').exists()).toBe(false)
    slot.element.appendChild(document.createElement('iframe'))
    await flushPromises()
    expect((slot.element as HTMLElement).style.display).not.toBe('none')
    expect(wrapper.find('.auth__divider').exists()).toBe(true)
  })

  it('shows email-code sign-in only (no dead widget) when the flag is off', async () => {
    const { wrapper } = setup({ options: async () => ({ telegramWidget: null }) })
    await flushPromises()
    expect(widgetScript()).toBeNull()
    expect(wrapper.find('[data-testid="telegram-login-widget"]').exists()).toBe(false)
    expect(wrapper.find('#email').exists()).toBe(true)
    expect(typeof (window as unknown as Record<string, unknown>).vtTelegramLoginAuth).toBe(
      'undefined',
    )
  })

  it('falls back to email-only when the options request fails', async () => {
    const { wrapper, errors } = setup({
      options: async () => {
        throw new Error('down')
      },
    })
    await flushPromises()
    expect(errors).toEqual([])
    expect(widgetScript()).toBeNull()
    expect(wrapper.find('#email').exists()).toBe(true)
  })

  it('does not show the widget on steps after the email step', async () => {
    const { wrapper } = setup({ options: widgetOn })
    await flushPromises()
    await toCodeStep(wrapper)
    expect(wrapper.find('[data-testid="telegram-login-widget"]').exists()).toBe(false)
  })

  it('posts the widget data in the body and opens the organization on success', async () => {
    const { calls, navigations } = setup({
      options: widgetOn,
      post: { '/api/auth/sign-in/telegram-widget': async () => ({ userId: 1, isNewUser: false }) },
    })
    await flushPromises()
    const signed = { id: 7302, first_name: 'Игрок', auth_date: 1, hash: 'f'.repeat(64) }
    const callback = (window as unknown as Record<string, (u: unknown) => void>)
      .vtTelegramLoginAuth!
    callback(signed)
    await flushPromises()
    const post = calls.find((c) => c.url === '/api/auth/sign-in/telegram-widget')!
    expect(post.options).toMatchObject({ method: 'POST', body: signed })
    expect(post.url).not.toContain('?')
    expect(navigations).toEqual(['/m/orgs/7'])
  })

  it('announces a rejected widget sign-in and keeps the email form usable', async () => {
    const { wrapper, navigations } = setup({
      options: widgetOn,
      post: {
        '/api/auth/sign-in/telegram-widget': async () => {
          throw new Error('401')
        },
      },
    })
    await flushPromises()
    const callback = (window as unknown as Record<string, (u: unknown) => void>)
      .vtTelegramLoginAuth!
    callback({ id: 1, hash: 'x' })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Telegram')
    expect(wrapper.find('#email').exists()).toBe(true)
    expect(navigations).toEqual([])
  })

  it('removes the global callback when the page is left', async () => {
    const { wrapper } = setup({ options: widgetOn })
    await flushPromises()
    wrapper.unmount()
    mounted.pop()
    expect((window as unknown as Record<string, unknown>).vtTelegramLoginAuth).toBeUndefined()
  })
})

describe('TelegramLoginButton', () => {
  it('is an accessible group and emits the widget user', async () => {
    const wrapper = mount(TelegramLoginButton, { props: { botUsername: 'volleytimeby_bot' } })
    mounted.push(wrapper)
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Вход через Telegram')
    ;(window as unknown as Record<string, (u: unknown) => void>).vtTelegramLoginAuth!({ id: 5 })
    expect(wrapper.emitted('auth')).toEqual([[{ id: 5 }]])
  })

  it('refuses a malformed bot username', () => {
    const wrapper = mount(TelegramLoginButton, { props: { botUsername: 'bad"><x' } })
    mounted.push(wrapper)
    expect(widgetScript()).toBeNull()
  })
})
