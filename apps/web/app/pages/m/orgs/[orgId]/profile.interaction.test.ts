// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense } from 'vue'

import Profile from './profile.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'

const levels = [
  { code: 'v1', title: 'В1', description: 'Полупрофи', sortOrder: 1 },
  { code: 'v2', title: 'В2', description: 'Сильный любитель', sortOrder: 2 },
]

let wrapper: VueWrapper | undefined

const ownStats = { attendance: { visits: 24, noShows: 3, ratePercent: 89 }, period: {} }
const logout = vi.fn()
const askConfirm = vi.fn()
const fetchMock = vi.fn()
const authUser = ref<Record<string, unknown>>({ name: 'Синтетический Игрок', image: null })

function stubPage(level: string | null, position: string | null = null, stats: unknown = ownStats) {
  logout.mockReset()
  askConfirm.mockReset()
  fetchMock.mockReset()
  authUser.value = { name: 'Синтетический Игрок', image: null }
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('useAuth', () => ({ user: authUser, logout }))
  vi.stubGlobal('useTelegram', () => ({ confirm: askConfirm, haptic: vi.fn() }))
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useOrganizations', () => ({
    orgs: ref([]),
    loading: ref(false),
    fetchAll: vi.fn().mockResolvedValue(undefined),
    selectOrg: vi.fn(),
  }))
  vi.stubGlobal('apiErrorMessage', (_error: unknown, fallback = 'Ошибка') => fallback)
  vi.stubGlobal('apiErrorCode', () => null)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('useFetch', async (url: string | (() => string)) => {
    const path = typeof url === 'function' ? url() : url
    if (path === '/api/levels') return { data: ref({ levels }), error: ref(null) }
    if (path === '/api/organizations/30/members/me/stats') {
      return stats === null
        ? { data: ref(null), error: ref(new Error('boom')) }
        : { data: ref(stats), error: ref(null) }
    }
    return {
      data: ref({
        organization: { id: 30, name: 'Синтетическая QA-группа', defaultMemberStatus: 'active' },
        myMember: { role: 'player', status: 'active', userId: 9, level, position },
      }),
      error: ref(null),
      pending: ref(false),
      refresh: vi.fn(),
    }
  })
}

async function renderProfile() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Profile) }) })
  wrapper = mount(host, {
    global: {
      components: { EmptyState, ErrorState, SkeletonList },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtAvatar: { template: '<span />' },
        VtChip: { template: '<span><slot /></span>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('Mini App player profile level', () => {
  it('shows the own level title and its scale description', async () => {
    stubPage('v2')
    const page = await renderProfile()
    expect(page.get('#profile-level-title').text()).toBe('Уровень и амплуа')
    expect(page.text()).toContain('В2')
    expect(page.text()).toContain('Сильный любитель')
    expect(page.text()).not.toMatch(/\b[ABC]\b/)
  })

  it('says the level is not assigned when the member has none', async () => {
    stubPage(null)
    const page = await renderProfile()
    expect(page.text()).toContain('Уровень пока не назначен')
    expect(page.text()).not.toContain('В2')
  })

  it('shows the own position read-only, with no control to edit it (21.2.22)', async () => {
    stubPage('v2', 'outside_hitter')
    const page = await renderProfile()
    expect(page.get('[data-testid="profile-position"]').text()).toBe('Амплуа: Доигровщик')
    expect(page.find('select').exists()).toBe(false)
    expect(page.find('input').exists()).toBe(false)
  })

  it('says the position is not set when the organizer has not chosen one', async () => {
    stubPage('v2', null)
    const page = await renderProfile()
    expect(page.get('[data-testid="profile-position"]').text()).toContain('пока не задано')
  })

  it('links to bookings, the notification feed, joining and creating a group (20.4.9)', async () => {
    stubPage('v1')
    const page = await renderProfile()
    const hrefs = page.findAll('a').map((a) => a.attributes('href'))
    expect(page.text()).toContain('Мои записи')
    expect(page.text()).toContain('Уведомления')
    expect(page.text()).toContain('Создать группу')
    expect(page.text()).toContain('Вступить по приглашению')
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/m/orgs/30/bookings',
        '/m/orgs/30/notifications',
        '/m/orgs/create',
        '/m/orgs',
      ]),
    )
  })
})

describe('Mini App player profile tails (21.4.8, M-13)', () => {
  it('shows own visits, attendance rate and no-shows from the own-stats API', async () => {
    stubPage('v1')
    const page = await renderProfile()
    const tiles = page.findAll('[data-testid="profile-stat"]').map((t) => t.text())
    expect(tiles).toEqual(['24тренировок', '89%посещ.', '3no-show'])
    expect(page.get('[data-testid="profile-stats-note"]').text()).toBe('за последние 90 дней')
  })

  it('shows a dash for the rate of a player without finished events', async () => {
    stubPage('v1', null, { attendance: { visits: 0, noShows: 0, ratePercent: null }, period: {} })
    const page = await renderProfile()
    expect(page.findAll('[data-testid="profile-stat"]')[1]!.text()).toBe('—посещ.')
  })

  it('hides the stats card when the API fails, the rest of the profile stays', async () => {
    stubPage('v1', null, null)
    const page = await renderProfile()
    expect(page.find('[data-testid="profile-stat"]').exists()).toBe(false)
    expect(page.text()).toContain('Мои записи')
  })

  it('shows the language row as «Русский» without a link, a button or a chooser (AQ-12)', async () => {
    stubPage('v1')
    const page = await renderProfile()
    const row = page.get('[data-testid="profile-language"]')
    expect(row.text()).toContain('Язык')
    expect(row.text()).toContain('Русский')
    expect(row.element.closest('a, button')).toBeNull()
    expect(row.find('a, button, select, input').exists()).toBe(false)
  })

  it('signs out only after the confirmation', async () => {
    stubPage('v1')
    askConfirm.mockResolvedValueOnce(false)
    const page = await renderProfile()
    await page.get('[data-testid="profile-logout"]').trigger('click')
    await flushPromises()
    expect(askConfirm).toHaveBeenCalledWith(expect.stringContaining('Выйти из аккаунта?'))
    expect(logout).not.toHaveBeenCalled()

    askConfirm.mockResolvedValueOnce(true)
    await page.get('[data-testid="profile-logout"]').trigger('click')
    await flushPromises()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('edits the own name through the session API and shows the saved name', async () => {
    stubPage('v1')
    fetchMock.mockResolvedValue({})
    const page = await renderProfile()
    expect(page.find('[data-testid="profile-name-input"]').exists()).toBe(false)
    await page.get('[data-testid="profile-name-edit"]').trigger('click')
    const input = page.get('[data-testid="profile-name-input"]')
    expect((input.element as HTMLInputElement).value).toBe('Синтетический Игрок')
    await input.setValue('  Новое Имя  ')
    await page.get('[data-testid="profile-name-form"]').trigger('submit')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/update-user', {
      method: 'POST',
      body: { name: 'Новое Имя' },
    })
    expect(authUser.value.name).toBe('Новое Имя')
    expect(page.find('[data-testid="profile-name-input"]').exists()).toBe(false)
    expect(page.text()).toContain('Новое Имя')
  })

  it('does not send an empty name and keeps the form open with a hint', async () => {
    stubPage('v1')
    const page = await renderProfile()
    await page.get('[data-testid="profile-name-edit"]').trigger('click')
    await page.get('[data-testid="profile-name-input"]').setValue('   ')
    await page.get('[data-testid="profile-name-form"]').trigger('submit')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(page.get('[role="alert"]').text()).toContain('Введите имя')
  })

  it('shows an error and keeps the old name when saving fails', async () => {
    stubPage('v1')
    fetchMock.mockRejectedValue(new Error('boom'))
    const page = await renderProfile()
    await page.get('[data-testid="profile-name-edit"]').trigger('click')
    await page.get('[data-testid="profile-name-input"]').setValue('Другое')
    await page.get('[data-testid="profile-name-form"]').trigger('submit')
    await flushPromises()
    expect(authUser.value.name).toBe('Синтетический Игрок')
    expect(page.get('[role="alert"]').text()).toContain('Не удалось сохранить имя')
  })

  it('cancels the name edit without a request', async () => {
    stubPage('v1')
    const page = await renderProfile()
    await page.get('[data-testid="profile-name-edit"]').trigger('click')
    await page.get('[data-testid="profile-name-cancel"]').trigger('click')
    expect(page.find('[data-testid="profile-name-input"]').exists()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
