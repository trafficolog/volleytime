// @vitest-environment happy-dom
import type { PlayerStats } from '@volley-time/shared'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Members from './members.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import Chip from '~/components/vt/Chip.vue'
import Segment from '~/components/vt/Segment.vue'
import type { MemberRow } from '~/composables/useOrganizations'
import { apiErrorMessage } from '~/utils/api-error'
import { debtView } from '~/utils/desktop-players-stats'

const levels = [{ code: 'v2', title: 'В2', description: '', sortOrder: 2 }]

const noStats: PlayerStats = {
  attendance: { visits: 0, noShows: 0, cancellations: 0, ratePercent: null, lastVisitAt: null },
  subscription: null,
  debt: { amount: 0, seats: 0, currency: 'BYN' },
}

function row(
  id: number,
  name: string,
  status: MemberRow['status'],
  stats: Partial<PlayerStats> = {},
  role: MemberRow['role'] = 'player',
): MemberRow {
  return {
    id,
    organizationId: 30,
    role,
    status,
    level: 'v2',
    joinedAt: null,
    createdAt: '2026-09-29T07:00:00.000Z',
    user: { id: id + 100, name, telegramUsername: null, image: null },
    stats: { ...noStats, ...stats },
  }
}

const roster: MemberRow[] = [
  row(1, 'Анна Активная', 'active', {
    attendance: {
      visits: 24,
      noShows: 0,
      cancellations: 0,
      ratePercent: 100,
      lastVisitAt: '2026-05-03T10:00:00Z',
    },
    subscription: { remaining: 5, total: 8, expiresAt: null, count: 1 },
  }),
  row(2, 'Борис Должник', 'active', { debt: { amount: 1500, seats: 1, currency: 'BYN' } }),
  row(3, 'Вера Заявка', 'pending'),
  row(4, 'Глеб Гость', 'guest'),
  row(5, 'Дима Блок', 'blocked'),
  row(6, 'Егор Ушёл', 'left', {
    subscription: { remaining: 1, total: 8, expiresAt: null, count: 1 },
  }),
]

const fetchMembers = vi.fn()
let wrapper: VueWrapper | undefined

beforeEach(() => {
  fetchMembers.mockReset()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('useTelegram', () => ({ confirm: () => Promise.resolve(true) }))
  vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
  vi.stubGlobal('useMembers', () => {
    const members = ref<MemberRow[]>([])
    return {
      members,
      statsPeriod: ref({ from: '2026-02-20', to: '2026-05-20' }),
      loading: ref(false),
      error: ref(null),
      fetch: fetchMembers.mockImplementation(() => {
        members.value = roster
        return Promise.resolve()
      }),
    }
  })
  vi.stubGlobal('useFetch', async (url: string | (() => string)) => {
    const path = typeof url === 'function' ? url() : url
    if (path === '/api/levels') return { data: ref({ levels }) }
    return {
      data: ref({ myMember: { role: 'organizer', status: 'active', userId: 9 } }),
    }
  })
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('$fetch', vi.fn())
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function renderMembers() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Members) }) })
  wrapper = mount(host, {
    global: {
      components: {
        EmptyState,
        ErrorState,
        SkeletonList,
        VtSegment: Segment,
        VtChip: Chip,
      },
      stubs: {
        VtMiniHeader: { template: '<header><slot name="right" /></header>' },
        VtIcon: { template: '<span />' },
        VtAvatar: { template: '<span />' },
        VtSheet: { template: '<div />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

const tabs = (page: VueWrapper) => page.findAll('[role="tab"]')
const names = (page: VueWrapper) =>
  page
    .findAll('main li')
    .filter((li) => !li.element.closest('[aria-label="Сводка по игрокам"]'))
    .map((li) => li.text())

describe('Mini App organizer players (M-24, 21.1.3)', () => {
  it('manager loads the whole roster with stats in one request', async () => {
    await renderMembers()
    expect(fetchMembers).toHaveBeenCalledTimes(1)
    expect(fetchMembers).toHaveBeenCalledWith(
      ['active', 'pending', 'guest', 'blocked', 'left', 'rejected'],
      { stats: true },
    )
  })

  it('shows Active / Requests / All tabs with counts; left players are in none of them', async () => {
    const page = await renderMembers()
    expect(tabs(page).map((t) => t.text().replace(/\s+/g, ' '))).toEqual([
      'Активные 2',
      'Заявки 1',
      'Все 5',
    ])
    await tabs(page)[2]!.trigger('click')
    const all = names(page).join('|')
    expect(all).toContain('Вера Заявка')
    expect(all).toContain('Глеб Гость')
    expect(all).toContain('Дима Блок')
    expect(all).not.toContain('Егор Ушёл')
  })

  it('shows the summary tiles from the API stats over active players only', async () => {
    const page = await renderMembers()
    expect(page.get('[data-summary="active"]').text()).toBe('2')
    expect(page.get('[data-summary="subscription"]').text()).toBe('1')
    expect(page.get('[data-summary="debt"]').text()).toBe('1')
  })

  it('shows level, visits, subscription and debt in rows as the cabinet formats them', async () => {
    const page = await renderMembers()
    const [anna, boris] = page
      .findAll('main li')
      .filter((li) => li.text().includes('Анна') || li.text().includes('Борис'))
    expect(anna!.text()).toContain('уровень В2')
    expect(anna!.text()).toContain('посл. 03.05.2026')
    expect(anna!.get('[data-col="visits"]').text()).toContain('24')
    expect(anna!.get('[data-col="sub"]').text()).toBe('5 / 8')
    expect(boris!.get('[data-col="debt"]').text()).toBe(`−${debtView(roster[1]!.stats!)!.label}`)
    expect(boris!.find('[data-col="sub"]').exists()).toBe(false)
  })

  it('searches by name and says so when nobody matches', async () => {
    const page = await renderMembers()
    await page.get('#m-players-search').setValue('борис')
    expect(names(page)).toHaveLength(1)
    expect(names(page)[0]).toContain('Борис')
    await page.get('#m-players-search').setValue('нет такого')
    expect(page.text()).toContain('Никого не нашли')
  })

  it('links to the month report from the header', async () => {
    const page = await renderMembers()
    expect(page.get('a[aria-label="Отчёт за месяц"]').attributes('href')).toBe('/m/orgs/30/reports')
  })
})
