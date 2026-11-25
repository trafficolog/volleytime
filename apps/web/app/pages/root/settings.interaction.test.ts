// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  Suspense,
  watch,
} from 'vue'

import Settings from './settings.vue'

import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'

const API = '/api/platform/settings'
const route = reactive<{ query: Record<string, string> }>({ query: {} })
const apiFetch = vi.fn()
const toastShow = vi.fn()
const refresh = vi.fn()
let wrapper: VueWrapper | undefined
let initial: unknown
const refreshMe = vi.fn()
const navigateToMock = vi.fn()

const OWNER = { userId: 1, role: 'owner', policies: ['self', 'settings', 'team'] }
const ADMIN = { userId: 2, role: 'admin', policies: ['self', 'settings'] }
const STAFF = {
  members: [
    {
      userId: 1,
      name: 'Иван Петров',
      email: 'ivan@volleytime.by',
      telegramUsername: null,
      role: 'owner',
      invitedBy: null,
      createdAt: '2026-11-20T09:00:00.000Z',
    },
  ],
}
let me: typeof OWNER = OWNER

const view = (value: unknown, def: unknown, version = 0) => ({
  value,
  default: def,
  version,
  updatedAt: null,
  updatedBy: null,
})

const SETTINGS = () => ({
  settings: {
    'general.platformName': view('Volley Time', 'Volley Time'),
    'general.supportContact': view(null, null),
    'eventBalance.newOrganizationGrant': view(5, 5),
    'events.maxPublishedPerDay': view(null, null),
    'bot.callbackLimit': view(9, 8, 2),
    'bot.callbackWindowSeconds': view(10, 10),
  },
  readonly: {
    payments: {
      currency: 'BYN',
      model: 'manual_requests',
      onlinePayments: false,
      bankDetails: null,
    },
    general: { region: 'Europe/Minsk' },
    security: { authRateLimit: true, rootAuditLog: true, trustedProxy: false },
    integrations: {
      telegramBot: true,
      telegramLoginWidget: false,
      smtp: true,
      sentry: false,
      scheduler: true,
    },
    featureFlags: [
      { name: 'EVENT_BALANCE_ENFORCED', enabled: true },
      { name: 'COLLECTIONS_ENABLED', enabled: false },
    ],
  },
  applyDelaySeconds: 30,
})

const HISTORY = {
  entries: [
    {
      id: 5,
      createdAt: '2026-11-20T09:00:00.000Z',
      actor: { id: 1, name: 'Root' },
      key: 'bot.callbackLimit',
      oldValue: 8,
      newValue: 9,
    },
  ],
}

beforeEach(() => {
  route.query = {}
  initial = SETTINGS()
  me = OWNER
  refreshMe.mockReset().mockResolvedValue(undefined)
  navigateToMock.mockReset()
  toastShow.mockReset()
  refresh.mockReset().mockResolvedValue(undefined)
  apiFetch.mockReset().mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url === `${API}/history`) return HISTORY
    if (url === '/api/platform/staff') return STAFF
    if (opts?.method === 'PATCH') return SETTINGS()
    throw new Error(`unexpected ${url}`)
  })
  vi.stubGlobal('usePlatformStaffMe', () => ({
    data: ref(me),
    pending: ref(false),
    refresh: refreshMe,
  }))
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({
    push: async (to: { query: Record<string, string> }) => {
      route.query = to.query
    },
  }))
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('useFetch', async () => ({
    data: ref(initial),
    pending: ref(false),
    error: ref(null),
    refresh,
  }))
  vi.stubGlobal('navigateTo', navigateToMock)
  vi.stubGlobal('createError', (e: unknown) => e)
  for (const [name, value] of Object.entries({
    computed,
    watch,
    ref,
    reactive,
    nextTick,
    onBeforeUnmount,
    onMounted,
  })) {
    vi.stubGlobal(name, value)
  }
  vi.stubGlobal('$fetch', apiFetch)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function render() {
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Settings) }) }),
    {
      attachTo: document.body,
      global: {
        components: { ErrorState, SkeletonList },
        stubs: { VtIcon: true },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const tab = (w: VueWrapper, key: string) => w.get(`[data-testid="settings-tab-${key}"]`)

describe('root platform settings (R-05, 22.3.1)', () => {
  it('shows seven sections for an Owner, «Общие» first, with read-only currency and region', async () => {
    const w = await render()
    expect(w.findAll('.vt-root-settings__tab').map((b) => b.text())).toEqual([
      'Общие',
      'Команда & роли',
      'Платежи',
      'Уведомления',
      'Лимиты',
      'Безопасность',
      'Интеграции',
    ])
    expect(tab(w, 'general').attributes('aria-current')).toBe('page')
    expect((w.get('input[name="platformName"]').element as HTMLInputElement).value).toBe(
      'Volley Time',
    )
    expect(w.text()).toContain('BYN')
    expect(w.text()).toContain('Беларусь · Europe/Minsk')
    // валюта и регион — не поля ввода
    expect(w.findAll('input')).toHaveLength(2)
  })

  it('keeps «Сохранить» disabled until a field changes, then sends only that key with its version', async () => {
    const w = await render()
    const save = () => w.get('button[type="submit"]')
    expect(save().attributes('disabled')).toBeDefined()
    await w.get('input[name="supportContact"]').setValue('  @help_bot ')
    expect(save().attributes('disabled')).toBeUndefined()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(API, {
      method: 'PATCH',
      body: { changes: [{ key: 'general.supportContact', value: '@help_bot', version: 0 }] },
    })
    expect(toastShow).toHaveBeenCalledWith('Настройки сохранены')
  })

  it('«Лимиты»: four fields, hint about a minute, empty daily limit means no limit', async () => {
    const w = await render()
    await tab(w, 'limits').trigger('click')
    expect(w.get('input[name="newOrganizationGrant"]').element).toHaveProperty('value', '5')
    expect(w.get('input[name="maxPublishedPerDay"]').attributes('placeholder')).toBe('Без лимита')
    expect(w.get('input[name="callbackLimit"]').element).toHaveProperty('value', '9')
    expect(w.get('input[name="callbackWindowSeconds"]').element).toHaveProperty('value', '10')
    expect(w.get('[data-testid="settings-apply-delay"]').text()).toBe(
      'Применяется в течение минуты',
    )
    expect(w.text()).toContain('Безлимит событий для отдельной группы настраивается в карточке')

    await w.get('input[name="maxPublishedPerDay"]').setValue('3')
    await w.get('input[name="callbackLimit"]').setValue('12')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith(API, {
      method: 'PATCH',
      body: {
        changes: [
          { key: 'events.maxPublishedPerDay', value: 3, version: 0 },
          { key: 'bot.callbackLimit', value: 12, version: 2 },
        ],
      },
    })
  })

  it('rejects out-of-range values next to the field without calling the API', async () => {
    const w = await render()
    await tab(w, 'limits').trigger('click')
    await w.get('input[name="callbackLimit"]').setValue('0')
    await w.get('input[name="newOrganizationGrant"]').setValue('1001')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Целое число от 1 до 100')
    expect(w.text()).toContain('Целое число от 1 до 1000')
    expect(apiFetch).not.toHaveBeenCalledWith(API, expect.anything())
  })

  it('409 stale: shows the message and reloads the form from the current state', async () => {
    const current = SETTINGS()
    current.settings['bot.callbackLimit'] = view(20, 8, 3)
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (url === `${API}/history`) return HISTORY
      if (opts?.method === 'PATCH')
        throw { statusCode: 409, data: { data: { code: 'platform_settings.stale', current } } }
      throw new Error(`unexpected ${url}`)
    })
    const w = await render()
    await tab(w, 'limits').trigger('click')
    await w.get('input[name="callbackLimit"]').setValue('12')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe(
      'Настройки изменил другой администратор — данные обновлены',
    )
    expect(w.get('input[name="callbackLimit"]').element).toHaveProperty('value', '20')
  })

  it('shows the server 422 under the field named in the error', async () => {
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
      if (url === `${API}/history`) return HISTORY
      if (opts?.method === 'PATCH')
        throw {
          statusCode: 422,
          data: {
            data: { code: 'validation_failed', issues: [{ path: 'changes.0.bot.callbackLimit' }] },
          },
        }
      throw new Error(`unexpected ${url}`)
    })
    const w = await render()
    await tab(w, 'limits').trigger('click')
    await w.get('input[name="callbackLimit"]').setValue('12')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Целое число от 1 до 100')
  })

  it('read-only sections list statuses without inputs; notifications say «Скоро»', async () => {
    const w = await render()
    await tab(w, 'payments').trigger('click')
    expect(w.text()).toContain('Заявки организаций, ручное подтверждение')
    expect(w.text()).toContain('Не подключена')
    expect(w.text()).toContain('Не заданы')
    expect(w.text()).not.toMatch(/bePaid|инвойс|credits/i)
    expect(w.findAll('input')).toHaveLength(0)

    await tab(w, 'notifications').trigger('click')
    expect(w.text()).toContain('Скоро')
    expect(w.findAll('input, button[type="submit"]')).toHaveLength(0)

    await tab(w, 'security').trigger('click')
    expect(w.text()).toContain('включено')
    expect(w.text()).toContain('не настроено')

    await tab(w, 'integrations').trigger('click')
    expect(w.text()).toContain('Меняются в конфигурации сервера')
    const flags = w.get('[data-testid="settings-flags"]').text()
    expect(flags).toContain('включён')
    expect(flags).toContain('выключен')
    expect(w.findAll('input')).toHaveLength(0)
  })

  it('shows the last changes with who, field and old → new value', async () => {
    const w = await render()
    const row = w.get('[data-testid="settings-history"] li').text()
    expect(row).toContain('Root')
    expect(row).toContain('Нажатия кнопок бота на пользователя: 8 → 9')
  })

  it('R-15: Admin has neither «Команда & роли» nor «Безопасность» in the tabs', async () => {
    me = ADMIN as typeof OWNER
    const w = await render()
    expect(w.findAll('.vt-root-settings__tab').map((b) => b.text())).toEqual([
      'Общие',
      'Платежи',
      'Уведомления',
      'Лимиты',
      'Интеграции',
    ])
  })

  it('R-15: a direct ?section=team for an Admin opens «Общие», not the team', async () => {
    me = ADMIN as typeof OWNER
    route.query = { section: 'team' }
    const w = await render()
    expect(tab(w, 'general').attributes('aria-current')).toBe('page')
    expect(w.text()).not.toContain('Команда платформы')
    expect(apiFetch).not.toHaveBeenCalledWith('/api/platform/staff')
  })

  it('R-15: «Команда & роли» opens the team list for an Owner', async () => {
    const w = await render()
    await tab(w, 'team').trigger('click')
    await flushPromises()
    expect(apiFetch).toHaveBeenCalledWith('/api/platform/staff')
    expect(w.text()).toContain('Команда платформы')
    expect(w.text()).toContain('ivan@volleytime.by')
    // история изменений общих настроек на этой вкладке не показывается
    expect(w.find('[data-testid="settings-history"]').exists()).toBe(false)
  })

  it('R-15: after the Owner changes their own role the page re-reads the menu', async () => {
    const w = await render()
    await tab(w, 'team').trigger('click')
    await flushPromises()
    w.findComponent({ name: 'StaffTeam' }).vm.$emit('self-changed', 'role')
    await flushPromises()
    expect(refreshMe).toHaveBeenCalled()
  })

  it('R-15: after the Owner removes themselves the page leaves Root Admin', async () => {
    const w = await render()
    await tab(w, 'team').trigger('click')
    await flushPromises()
    w.findComponent({ name: 'StaffTeam' }).vm.$emit('self-changed', 'removed')
    await flushPromises()
    expect(navigateToMock).toHaveBeenCalledWith('/app')
  })
})
