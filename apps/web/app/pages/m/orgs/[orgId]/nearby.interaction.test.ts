// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, Suspense, watch } from 'vue'

import Nearby from './nearby.vue'

import EmptyState from '~/components/EmptyState.vue'
import ErrorState from '~/components/ErrorState.vue'
import SkeletonList from '~/components/SkeletonList.vue'
import VtSegment from '~/components/vt/Segment.vue'
import type { NearbyGame } from '~/utils/nearby-games'

const levels = [
  { code: 'v1', title: 'В1', description: '', sortOrder: 1 },
  { code: 'v2', title: 'В2', description: '', sortOrder: 2 },
  { code: 'v4_plus', title: 'В4+', description: '', sortOrder: 5 },
]
const game = (id: number, title: string, extra: Partial<NearbyGame> = {}): NearbyGame => ({
  id,
  title,
  startsAt: '2035-03-10T17:00:00.000Z',
  endsAt: '2035-03-10T19:00:00.000Z',
  level: null,
  place: { name: 'Школа №24', address: null },
  capacity: 12,
  price: { amount: 1200, currency: 'BYN' },
  taken: 9,
  full: false,
  publicSlug: 'abcdef012345',
  group: {
    id: 3,
    slug: 'volley-minsk',
    name: 'Волей Минск',
    city: 'Минск',
    district: 'Центр',
    logoUpdatedAt: null,
    timezone: 'Europe/Minsk',
  },
  ...extra,
})

let wrapper: VueWrapper | undefined
const fetchMock = vi.fn()

function stubPage(opts: { city?: string | null; level?: string | null } = {}) {
  const { city = 'Минск', level = 'v2' } = opts
  fetchMock.mockReset()
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30' } }))
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('apiErrorMessage', (_error: unknown, fallback = 'Ошибка') => fallback)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useFetch', async (url: string | (() => string)) => {
    const path = typeof url === 'function' ? url() : url
    if (path === '/api/levels') return { data: ref({ levels }), error: ref(null) }
    return {
      data: ref({
        organization: { id: 30, name: 'Моя группа', city },
        myMember: { role: 'player', status: 'active', userId: 9, level },
      }),
      error: ref(null),
    }
  })
}

async function render() {
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Nearby) }) })
  wrapper = mount(host, {
    global: {
      components: { EmptyState, ErrorState, SkeletonList, VtSegment },
      stubs: {
        VtMiniHeader: { template: '<header />' },
        VtIcon: { template: '<span />' },
        VtChip: { template: '<span><slot /></span>' },
        GroupLogo: { template: '<span />' },
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

describe('Mini App nearby games (30.3.3, M-32)', () => {
  it('loads games of the group city filtered by my level by default', async () => {
    stubPage()
    fetchMock.mockResolvedValue({ games: [game(1, 'Вечерняя игра')], hasMore: false })
    const page = await render()
    expect(fetchMock).toHaveBeenCalledWith('/api/me/nearby-games', {
      query: { city: 'Минск', level: 'v2', limit: 20 },
    })
    expect(page.get('[data-testid="nearby-level-hint"]').text()).toContain('Ваш уровень: В2')
    const checked = page.findAll('[role="radio"][aria-checked="true"]')
    expect(checked.map((b) => b.text())).toEqual(['мой уровень В2'])
  })

  it('starts with "Все" and no level parameter when no level is assigned', async () => {
    stubPage({ level: null })
    fetchMock.mockResolvedValue({ games: [], hasMore: false })
    const page = await render()
    expect(fetchMock).toHaveBeenCalledWith('/api/me/nearby-games', {
      query: { city: 'Минск', limit: 20 },
    })
    expect(page.findAll('[role="radio"][aria-checked="true"]').map((b) => b.text())).toEqual([
      'Все',
    ])
    expect(page.get('[data-testid="nearby-level-hint"]').text()).not.toContain('Ваш уровень')
  })

  it('renders a card linking to the group page, with level, place and seats', async () => {
    stubPage()
    fetchMock.mockResolvedValue({
      games: [
        game(1, 'Вечерняя игра', { level: 'v2' }),
        game(2, 'Полная игра', { taken: 12, full: true }),
      ],
      hasMore: false,
    })
    const page = await render()
    const cards = page.findAll('[data-testid="nearby-game"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.attributes('href')).toBe('/g/volley-minsk')
    expect(cards[0]!.text()).toContain('Вечерняя игра')
    expect(cards[0]!.text()).toContain('Волей Минск · Центр')
    expect(cards[0]!.text()).toContain('Школа №24')
    expect(cards[0]!.text()).toContain('В2')
    expect(cards[0]!.text()).toContain('3 места')
    expect(cards[0]!.text()).toMatch(/12,00\s?BYN/)
    expect(cards[1]!.text()).toContain('любой уровень')
    expect(cards[1]!.text()).toContain('Мест нет')
    expect(page.get('[data-testid="nearby-note"]').text()).toContain('по правилам группы')
    // в карточке нет цен и кнопок записи: запись идёт на странице группы
    expect(page.find('button[data-testid="nearby-book"]').exists()).toBe(false)
  })

  it('reloads the list from the first page when the level changes', async () => {
    stubPage()
    fetchMock.mockResolvedValue({ games: [game(1, 'Игра')], hasMore: false })
    const page = await render()
    const all = page.findAll('[role="radio"]').find((b) => b.text() === 'Все')!
    await all.trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/me/nearby-games', {
      query: { city: 'Минск', limit: 20 },
    })
  })

  it('shows more with the next offset and appends the games', async () => {
    stubPage()
    fetchMock
      .mockResolvedValueOnce({ games: [game(1, 'Первая игра')], hasMore: true })
      .mockResolvedValueOnce({ games: [game(2, 'Вторая игра')], hasMore: false })
    const page = await render()
    await page.get('[data-testid="nearby-more"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/me/nearby-games', {
      query: { city: 'Минск', level: 'v2', limit: 20, offset: 1 },
    })
    expect(page.findAll('[data-testid="nearby-game"]')).toHaveLength(2)
    expect(page.find('[data-testid="nearby-more"]').exists()).toBe(false)
  })

  it('shows an empty state when there are no games', async () => {
    stubPage()
    fetchMock.mockResolvedValue({ games: [], hasMore: false })
    const page = await render()
    expect(page.get('[data-testid="nearby-empty"]').text()).toContain('Открытых игр рядом пока нет')
  })

  it('shows an error with retry when loading fails', async () => {
    stubPage()
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const page = await render()
    expect(page.text()).toContain('Не удалось загрузить игры')
    fetchMock.mockResolvedValueOnce({ games: [game(1, 'Игра')], hasMore: false })
    await page.get('button').trigger('click')
    await flushPromises()
    expect(page.findAll('[data-testid="nearby-game"]')).toHaveLength(1)
  })

  it('explains when the group has no city and does not call the API', async () => {
    stubPage({ city: null })
    const page = await render()
    expect(page.get('[data-testid="nearby-no-city"]').text()).toContain('не указан город')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
