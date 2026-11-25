// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  Suspense,
  watch,
  type Component,
} from 'vue'

import OrganizationDetail from './organizations/[id].vue'
import OrganizationsIndex from './organizations/index.vue'
import OrganizationsNew from './organizations/new.vue'
import UserDetail from './users/[id].vue'

import RootOrgUnlimited from '~/components/RootOrgUnlimited.vue'
import { stubPlatformStaff, type StaffState } from '~/test-support/platform-staff'

/**
 * Страницы организаций и пользователя Root Admin: кнопки изменений по роли (29.3.1, R-15).
 * Просмотр открыт ролям из политик organizations и users, изменения — из политик Manage.
 */

const apiFetch = vi.fn()
const route = reactive<{ query: Record<string, string>; params: Record<string, string> }>({
  query: {},
  params: { id: '4' },
})
let wrapper: VueWrapper | undefined
let payload: unknown

const OWNER = { id: 9, name: 'Иван П.', email: 'ivan@vt.by', telegramUsername: 'ivan_p' }
const ORG_ROW = {
  id: 4,
  slug: 'vt-minsk',
  name: 'VolleyTime Минск',
  city: 'Минск',
  status: 'active',
  owner: OWNER,
  balance: 32,
  lowBalance: false,
  unlimited: null,
  members: 14,
  eventsMonth: 12,
  lastActivityAt: '2026-11-18T11:55:00.000Z',
  createdAt: '2026-09-18T12:00:00.000Z',
}
const ORGS_PAGE = {
  items: [ORG_ROW],
  counts: { all: 1, active: 1, risk: 0, blocked: 0 },
  total: 1,
  page: 1,
  pageSize: 20,
}
const ORG_DETAIL = {
  ...ORG_ROW,
  description: null,
  timezone: 'Europe/Minsk',
  currency: 'BYN',
  deletedAt: null,
  modules: { subscriptions: true, publicPage: false, seoIndex: false },
  unlimited: null,
  stats: { balance: 7, lowBalance: true, members: 14, eventsMonth: 12, lastActivityAt: null },
  recentAudit: [],
  balanceHistory: [],
}
const USER_DETAIL = {
  id: 90,
  name: 'Иван Петренко',
  email: 'ivan@vt.by',
  telegramUsername: 'ivan_p',
  telegramLinked: true,
  groups: 1,
  topRole: 'owner',
  bookings: 34,
  lastActivityAt: '2026-11-18T11:55:00.000Z',
  createdAt: '2026-09-18T12:00:00.000Z',
  blocked: false,
  isRootAdmin: false,
  memberships: [],
  recentAudit: [],
}

beforeEach(() => {
  route.query = {}
  route.params = { id: '4' }
  apiFetch.mockReset().mockResolvedValue({})
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useHead', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ push: vi.fn(), replace: vi.fn() }))
  vi.stubGlobal('useToast', () => ({ show: vi.fn() }))
  vi.stubGlobal('useFetch', async () => ({
    data: ref(payload),
    pending: ref(false),
    error: ref(null),
    refresh: vi.fn().mockResolvedValue(undefined),
  }))
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('createError', (e: unknown) => e)
  vi.stubGlobal('$fetch', apiFetch)
  for (const [name, value] of Object.entries({
    computed,
    watch,
    ref,
    reactive,
    nextTick,
    onBeforeUnmount,
  })) {
    vi.stubGlobal(name, value)
  }
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function render(page: Component) {
  wrapper?.unmount()
  wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(page) }) }),
    {
      attachTo: document.body,
      global: {
        components: { RootOrgUnlimited },
        stubs: {
          VtIcon: true,
          NuxtLink: { props: ['to'], template: '<a><slot /></a>' },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

const texts = (w: VueWrapper, selector: string) =>
  w.findAll(selector).map((el) => el.text().replace(/\s+/g, ' ').trim())

describe('«Организации»: создание вручную по роли', () => {
  beforeEach(() => {
    payload = ORGS_PAGE
  })

  it.each(['owner', 'admin'] as const)('%s видит «Создать вручную»', async (role) => {
    stubPlatformStaff(role)
    const w = await render(OrganizationsIndex)
    expect(texts(w, 'a')).toContain('Создать вручную')
  })

  it.each(['finance', 'moderator', 'support', 'analyst', 'pending', 'error'] as StaffState[])(
    '%s видит список без кнопки создания',
    async (state) => {
      stubPlatformStaff(state)
      const w = await render(OrganizationsIndex)
      expect(w.text()).toContain('VolleyTime Минск')
      expect(texts(w, 'a')).not.toContain('Создать вручную')
    },
  )
})

describe('«Новая организация»: отправка по роли', () => {
  it.each(['owner', 'admin'] as const)('%s видит «Создать»', async (role) => {
    stubPlatformStaff(role)
    const w = await render(OrganizationsNew)
    expect(w.find('button[type="submit"]').exists()).toBe(true)
  })

  it.each(['finance', 'analyst', 'pending', 'error'] as StaffState[])(
    '%s не видит «Создать» и не отправляет форму',
    async (state) => {
      stubPlatformStaff(state)
      const w = await render(OrganizationsNew)
      expect(w.find('button[type="submit"]').exists()).toBe(false)
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(apiFetch).not.toHaveBeenCalled()
    },
  )
})

describe('Карточка организации: «Выдать баланс» и безлимит по роли', () => {
  beforeEach(() => {
    payload = ORG_DETAIL
  })
  const grant = (w: VueWrapper) => texts(w, 'a').filter((t) => t.includes('Выдать баланс'))
  const unlimited = (w: VueWrapper) => texts(w, 'button').filter((t) => t.includes('Включить до'))

  it.each(['owner', 'admin', 'finance'] as const)(
    '%s выдаёт баланс и меняет безлимит',
    async (role) => {
      stubPlatformStaff(role)
      const w = await render(OrganizationDetail)
      expect(grant(w)).toHaveLength(1)
      expect(unlimited(w)).toHaveLength(1)
    },
  )

  it.each(['moderator', 'support', 'analyst', 'pending', 'error'] as StaffState[])(
    '%s видит карточку без этих кнопок',
    async (state) => {
      stubPlatformStaff(state)
      const w = await render(OrganizationDetail)
      expect(w.text()).toContain('Безлимит событий')
      expect(grant(w)).toHaveLength(0)
      expect(unlimited(w)).toHaveLength(0)
      expect(texts(w, 'a')).toContain('Полный аудит')
    },
  )
})

describe('Карточка пользователя: блокировка по роли', () => {
  beforeEach(() => {
    route.params = { id: '90' }
  })
  const block = (w: VueWrapper) =>
    texts(w, 'button').filter((t) => t === 'Заблокировать' || t === 'Разблокировать')

  it.each(['owner', 'admin'] as const)('%s блокирует и разблокирует', async (role) => {
    stubPlatformStaff(role)
    payload = USER_DETAIL
    expect(block(await render(UserDetail))).toEqual(['Заблокировать'])
    payload = { ...USER_DETAIL, blocked: true }
    expect(block(await render(UserDetail))).toEqual(['Разблокировать'])
  })

  it.each(['moderator', 'support', 'pending', 'error'] as StaffState[])(
    '%s видит пользователя без блокировки',
    async (state) => {
      stubPlatformStaff(state)
      for (const blocked of [false, true]) {
        payload = { ...USER_DETAIL, blocked }
        const w = await render(UserDetail)
        expect(w.text()).toContain('Иван Петренко')
        expect(block(w)).toHaveLength(0)
      }
    },
  )
})
