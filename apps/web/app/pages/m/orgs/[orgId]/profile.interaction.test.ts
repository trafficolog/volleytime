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

function stubPage(level: string | null, position: string | null = null) {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('useAuth', () => ({ user: ref({ name: 'Синтетический Игрок', image: null }) }))
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
