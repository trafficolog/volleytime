// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Collections from './index.vue'

import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Collections) }),
})

const route = reactive({ params: { orgId: '30' }, fullPath: '/m/orgs/30/collections' })
const fetchApi = vi.fn<(url: string) => Promise<unknown>>()
let errorCode: string | undefined
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
}

async function mountPage() {
  wrapper = mount(Host, {
    global: {
      stubs: {
        VtMiniHeader: { props: ['title'], template: '<h1>{{ title }}</h1>' },
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
