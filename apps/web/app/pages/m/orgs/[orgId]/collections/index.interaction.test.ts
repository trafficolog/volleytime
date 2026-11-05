// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Collections from './index.vue'

import OrganizerCollectionsList from '~/components/OrganizerCollectionsList.vue'
import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Collections) }),
})

const route = reactive({ params: { orgId: '30' }, fullPath: '/m/orgs/30/collections' })
const fetchApi = vi.fn<(url: string) => Promise<unknown>>()
let errorCode: string | undefined
let memberRole = 'player'
let collectionsEnabled = true
let wrapper: VueWrapper | undefined

const collection = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `Сбор ${id}`,
  description: 'Описание сбора',
  icon: 'ball',
  targetAmount: 25000,
  currency: 'BYN',
  status: 'active',
  deadlineAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  closedAt: null,
  createdBy: { id: 5, name: 'Организатор' },
  collected: 17500,
  pledged: 0,
  contributors: 3,
  my: { paid: 0, pending: null },
  ...over,
})

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('$fetch', fetchApi)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
  vi.stubGlobal('apiErrorCode', () => errorCode)
  vi.stubGlobal('useFetch', async () => ({
    data: ref({
      organization: { id: 30 },
      capabilities: { collections: collectionsEnabled },
      myMember: { role: memberRole, status: 'active' },
    }),
    error: ref(null),
    refresh: vi.fn(),
  }))
}

async function mountPage() {
  wrapper = mount(Host, {
    global: {
      components: { OrganizerCollectionsList },
      stubs: {
        VtIcon: true,
        VtMiniHeader: {
          props: ['title'],
          template: '<header><h1>{{ title }}</h1><slot name="right" /></header>',
        },
        VtCampaignIcon: true,
        VtChip: { template: '<span data-chip><slot /></span>' },
        SkeletonList: true,
        ErrorState: {
          props: ['message'],
          template:
            '<div data-error>{{ message }}<button data-retry @click="$emit(\'retry\')" /></div>',
        },
        PlayerAccessNotice: { props: ['access'], template: '<div data-access>{{ access }}</div>' },
        EmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  stubGlobals()
  errorCode = undefined
  memberRole = 'player'
  collectionsEnabled = true
  fetchApi.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('player collections list (21.1.6)', () => {
  it('lists active collections first and finished ones apart, as links to the collection', async () => {
    fetchApi.mockResolvedValue({
      collections: [
        collection(1),
        collection(2, { status: 'completed', closedAt: '2026-10-10T10:00:00.000Z' }),
        collection(3, { status: 'cancelled', closedAt: '2026-10-11T10:00:00.000Z' }),
      ],
      nextCursor: null,
    })
    const page = await mountPage()
    expect(fetchApi).toHaveBeenCalledWith('/api/organizations/30/collections?limit=50')
    const active = page.get('section[aria-labelledby="collections-active-title"]')
    expect(active.text()).toContain('Активные · 1')
    expect(active.get('a').attributes('href')).toBe('/m/orgs/30/collections/1')
    expect(active.text()).toContain('175,00 BYN')
    expect(active.text()).toContain('250,00 BYN')
    expect(active.text()).toContain('70%')
    const finished = page.get('section[aria-labelledby="collections-finished-title"]')
    expect(finished.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/m/orgs/30/collections/2',
      '/m/orgs/30/collections/3',
    ])
    expect(finished.text()).toContain('завершён')
    expect(finished.text()).toContain('отменён')
  })

  it("marks the player's own pledge and confirmed contribution on the cards", async () => {
    fetchApi.mockResolvedValue({
      collections: [
        collection(1, { my: { paid: 0, pending: { id: 9, amount: 1500, method: 'cash' } } }),
        collection(2, { my: { paid: 3500, pending: null } }),
      ],
      nextCursor: null,
    })
    const page = await mountPage()
    const chips = page.findAll('[data-chip]').map((c) => c.text())
    expect(chips).toEqual(['обещано 15,00 BYN', 'внесли 35,00 BYN'])
  })

  it('shows a collection without a target without a progress meter', async () => {
    fetchApi.mockResolvedValue({
      collections: [collection(1, { targetAmount: null, collected: 4200 })],
      nextCursor: null,
    })
    const page = await mountPage()
    expect(page.find('[role="meter"]').exists()).toBe(false)
    expect(page.text()).toContain('42,00 BYN')
  })

  it('shows the empty state when the group has no collections', async () => {
    fetchApi.mockResolvedValue({ collections: [], nextCursor: null })
    const page = await mountPage()
    expect(page.get('[data-empty]').text()).toBe('Сборов нет')
  })

  it('loads the next page with the cursor and appends it', async () => {
    fetchApi
      .mockResolvedValueOnce({ collections: [collection(1)], nextCursor: 'abc_-1' })
      .mockResolvedValueOnce({ collections: [collection(2)], nextCursor: null })
    const page = await mountPage()
    await page.get('button.vt-btn').trigger('click')
    await flushPromises()
    expect(fetchApi).toHaveBeenLastCalledWith(
      '/api/organizations/30/collections?limit=50&cursor=abc_-1',
    )
    expect(page.findAll('section[aria-labelledby="collections-active-title"] a')).toHaveLength(2)
    expect(page.find('button.vt-btn').exists()).toBe(false)
  })

  it('offers a retry after a failed load', async () => {
    fetchApi.mockRejectedValueOnce(new Error('boom'))
    const page = await mountPage()
    expect(page.get('[data-error]').text()).toContain('Не удалось загрузить сборы')
    fetchApi.mockResolvedValueOnce({ collections: [collection(1)], nextCursor: null })
    await page.get('[data-retry]').trigger('click')
    await flushPromises()
    expect(page.find('[data-error]').exists()).toBe(false)
    expect(page.text()).toContain('Сбор 1')
  })

  it('shows the access notice for a member whose request is pending', async () => {
    errorCode = 'forbidden.pending_approval'
    fetchApi.mockRejectedValueOnce(new Error('403'))
    const page = await mountPage()
    expect(page.get('[data-access]').text()).toBe('pending')
  })
})

describe('organizer collections list (21.1.5)', () => {
  const list = [
    collection(1, { collected: 17500, pledged: 7000, contributors: 12 }),
    collection(2, { title: 'Аренда зала', targetAmount: 40000, collected: 12000 }),
    collection(3, {
      title: 'Форма команды',
      status: 'completed',
      closedAt: '2026-10-10T10:00:00.000Z',
      targetAmount: 60000,
      collected: 60000,
    }),
    collection(4, { title: 'Турнир', status: 'draft', collected: 0 }),
    collection(5, { title: 'Отменённый', status: 'cancelled', collected: 5000 }),
  ]
  const links = (page: VueWrapper) =>
    page.findAll('a[data-collection-card]').map((a) => a.attributes('href'))

  it('shows the summary tiles and groups drafts, active and finished collections', async () => {
    memberRole = 'owner'
    fetchApi.mockResolvedValue({ collections: list, nextCursor: null })
    const page = await mountPage()
    expect(page.get('[data-summary="active"]').text()).toBe('2')
    // подтверждённые 175 + 120 + 600 без отменённого сбора
    expect(page.get('[data-summary="collected"]').text()).toContain('895,00 BYN')
    expect(page.get('section[aria-labelledby="org-collections-draft"]').text()).toContain('Турнир')
    expect(page.get('section[aria-labelledby="org-collections-draft"]').text()).toContain(
      'черновик',
    )
    const active = page.get('section[aria-labelledby="org-collections-active"]')
    expect(active.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/m/orgs/30/collections/1',
      '/m/orgs/30/collections/2',
    ])
    expect(active.text()).toContain('70%')
    expect(active.text()).toContain('12 участников')
    const finished = page.get('section[aria-labelledby="org-collections-finished"]')
    expect(finished.text()).toContain('готово')
    expect(finished.text()).toContain('отменён')
    expect(links(page)).toHaveLength(5)
  })

  it('offers the new collection form from the header and the bottom button for an organizer', async () => {
    memberRole = 'organizer'
    fetchApi.mockResolvedValue({ collections: list, nextCursor: null })
    const page = await mountPage()
    const hrefs = page.findAll('a[href="/m/orgs/30/collections/new"]')
    expect(hrefs.length).toBe(2)
    expect(page.find('a[aria-label="Новый сбор"]').exists()).toBe(true)
  })

  it('invites the organizer to launch the first collection when there are none', async () => {
    memberRole = 'owner'
    fetchApi.mockResolvedValue({ collections: [], nextCursor: null })
    const page = await mountPage()
    expect(page.get('[data-empty]').text()).toBe('Запустите первый сбор')
    expect(page.find('a[href="/m/orgs/30/collections/new"]').exists()).toBe(true)
  })

  it('hides creation when the flag is off but keeps the list open for management', async () => {
    memberRole = 'owner'
    collectionsEnabled = false
    fetchApi.mockResolvedValue({ collections: list, nextCursor: null })
    const page = await mountPage()
    expect(page.find('a[href="/m/orgs/30/collections/new"]').exists()).toBe(false)
    expect(page.find('a[aria-label="Новый сбор"]').exists()).toBe(false)
    expect(page.get('[role="status"]').text()).toContain('Создание и правка сборов пока недоступны')
    expect(links(page)).toHaveLength(5)
  })

  it('tells the organizer the totals cover the loaded collections when there is more to load', async () => {
    memberRole = 'owner'
    fetchApi
      .mockResolvedValueOnce({ collections: [collection(1)], nextCursor: 'abc_-1' })
      .mockResolvedValueOnce({ collections: [collection(2)], nextCursor: null })
    const page = await mountPage()
    expect(page.text()).toContain('Итоги по загруженным сборам')
    await page.get('button.vt-btn').trigger('click')
    await flushPromises()
    expect(page.text()).not.toContain('Итоги по загруженным сборам')
    expect(links(page)).toHaveLength(2)
  })

  it('does not show management to a player', async () => {
    fetchApi.mockResolvedValue({ collections: list, nextCursor: null })
    const page = await mountPage()
    expect(page.find('[data-summary="active"]').exists()).toBe(false)
    expect(page.find('a[href="/m/orgs/30/collections/new"]').exists()).toBe(false)
  })
})
