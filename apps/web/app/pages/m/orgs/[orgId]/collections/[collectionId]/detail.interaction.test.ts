// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Detail from './index.vue'

import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Detail) }),
})

const route = reactive({
  params: { orgId: '30', collectionId: '4' },
  fullPath: '/m/orgs/30/collections/4',
})
const fetchApi = vi.fn<(url: string) => Promise<unknown>>()
let collectionsEnabled = true
let errorCode: string | undefined
let wrapper: VueWrapper | undefined

const collection = (over: Record<string, unknown> = {}) => ({
  id: 4,
  title: 'Новый комплект мячей',
  description: 'Три мяча на замену',
  icon: 'ball',
  targetAmount: 25000,
  currency: 'BYN',
  status: 'active',
  deadlineAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  closedAt: null,
  createdBy: { id: 5, name: 'Организатор' },
  collected: 17500,
  pledged: 1500,
  contributors: 12,
  my: { paid: 0, pending: null },
  ...over,
})
const contribution = (id: number, name: string, status: string, amount: number) => ({
  id,
  user: { id, name, telegramUsername: null, image: null },
  amount,
  currency: 'BYN',
  method: 'cash',
  status,
  createdAt: '2026-10-02T10:00:00.000Z',
  confirmedAt: null,
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
    data: ref({ organization: { id: 30 }, capabilities: { collections: collectionsEnabled } }),
    error: ref(null),
    refresh: vi.fn(),
  }))
}

async function mountPage(result: unknown) {
  if (result instanceof Error) fetchApi.mockRejectedValue(result)
  else fetchApi.mockResolvedValue(result)
  wrapper = mount(Host, {
    global: {
      stubs: {
        VtMiniHeader: { props: ['title', 'sub'], template: '<h1>{{ title }}|{{ sub }}</h1>' },
        VtCampaignIcon: true,
        VtIcon: true,
        VtAvatar: true,
        VtChip: { template: '<span data-chip><slot /></span>' },
        SkeletonList: true,
        ErrorState: { props: ['message'], template: '<div data-error>{{ message }}</div>' },
        PlayerAccessNotice: true,
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
  collectionsEnabled = true
  errorCode = undefined
  fetchApi.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('player collection screen (21.1.6)', () => {
  it('shows the goal, the collected sum, participants and who has contributed', async () => {
    const page = await mountPage({
      collection: collection(),
      contributions: [
        contribution(1, 'Артём', 'succeeded', 1500),
        contribution(2, 'Маша', 'pending', 1000),
      ],
    })
    expect(fetchApi).toHaveBeenCalledWith('/api/organizations/30/collections/4')
    expect(page.text()).toContain('175,00 BYN')
    expect(page.text()).toContain('из 250,00 BYN')
    expect(page.text()).toContain('12 участников')
    expect(page.get('[role="meter"]').attributes('aria-valuenow')).toBe('70')
    const rows = page.get('section[aria-labelledby="collection-backers-title"]').findAll('li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Артём')
    expect(rows[1]!.text()).toContain('обещал')
    expect(rows[1]!.text()).toContain('10,00 BYN')
  })

  it('links the call to action to the pledge screen while pledges are open', async () => {
    const page = await mountPage({ collection: collection(), contributions: [] })
    const cta = page.get('a[href="/m/orgs/30/collections/4/pledge"]')
    expect(cta.text()).toBe('Внести взнос')
  })

  it('says a waiting pledge will be replaced on the call to action', async () => {
    const page = await mountPage({
      collection: collection({ my: { paid: 0, pending: { id: 9, amount: 1500, method: 'cash' } } }),
      contributions: [],
    })
    expect(page.text()).toContain('Вы обещали 15,00 BYN')
    expect(page.text()).toContain('ждём подтверждения от организатора')
    expect(page.get('a[href$="/pledge"]').text()).toBe('Заменить обещанный взнос')
  })

  it('shows a confirmed contribution and offers another one', async () => {
    const page = await mountPage({
      collection: collection({ my: { paid: 3500, pending: null } }),
      contributions: [],
    })
    expect(page.text()).toContain('Вы внесли 35,00 BYN')
    expect(page.get('a[href$="/pledge"]').text()).toBe('Внести ещё')
  })

  it('replaces the call to action with a notice when the collections flag is off', async () => {
    collectionsEnabled = false
    const page = await mountPage({ collection: collection(), contributions: [] })
    expect(page.find('a[href$="/pledge"]').exists()).toBe(false)
    expect(page.get('[role="status"]').text()).toContain('Приём взносов сейчас приостановлен')
    expect(page.text()).toContain('175,00 BYN')
  })

  it('has no call to action for a closed collection', async () => {
    const page = await mountPage({
      collection: collection({ status: 'completed', closedAt: '2026-10-10T10:00:00.000Z' }),
      contributions: [],
    })
    expect(page.find('a[href$="/pledge"]').exists()).toBe(false)
    expect(page.text()).toContain('сбор завершён')
  })

  it('shows the deadline for display only and keeps the call to action after it passed', async () => {
    const page = await mountPage({
      collection: collection({ deadlineAt: '2020-01-01T10:00:00.000Z' }),
      contributions: [],
    })
    expect(page.get('h1').text()).toContain('до 1 января')
    expect(page.text()).toContain('срок прошёл')
    expect(page.find('a[href$="/pledge"]').exists()).toBe(true)
  })

  it('shows not found for a collection the player cannot see', async () => {
    errorCode = 'collection.not_found'
    const page = await mountPage(new Error('404'))
    expect(page.get('[data-empty]').text()).toBe('Сбор не найден')
  })

  it('shows an error for any other failure', async () => {
    const page = await mountPage(new Error('boom'))
    expect(page.get('[data-error]').text()).toContain('Не удалось загрузить сбор')
  })
})
