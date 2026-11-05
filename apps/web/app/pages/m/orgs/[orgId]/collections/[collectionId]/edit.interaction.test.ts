// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import EditCollection from './edit.vue'

import OrganizerCollectionForm from '~/components/OrganizerCollectionForm.vue'
import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(EditCollection) }),
})

const route = reactive({
  params: { orgId: '30', collectionId: '4' },
  path: '/m/orgs/30/collections/4/edit',
})
const fetchApi =
  vi.fn<(url: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>>()
const navigate = vi.fn()
const toastShow = vi.fn()
let collectionsEnabled = true
let memberRole = 'owner'
let errorCode: string | undefined
let current: Record<string, unknown>
let wrapper: VueWrapper | undefined

const collection = (over: Record<string, unknown> = {}) => ({
  id: 4,
  title: 'Мячи',
  description: 'Три мяча',
  icon: 'ball',
  targetAmount: 25000,
  currency: 'BYN',
  status: 'active',
  deadlineAt: '2099-12-10T20:59:00.000Z',
  closedAt: null,
  collected: 0,
  pledged: 0,
  contributors: 0,
  ...over,
})

function stubGlobals() {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onBeforeUnmount', () => undefined)
  vi.stubGlobal('$fetch', fetchApi)
  vi.stubGlobal('navigateTo', navigate)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
  vi.stubGlobal('apiErrorCode', () => errorCode)
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
  vi.stubGlobal('useTelegram', () => ({ haptic: vi.fn() }))
  vi.stubGlobal('useFetch', async () => ({
    data: ref({
      organization: { id: 30, defaultCurrency: 'BYN', defaultTimezone: 'Europe/Minsk' },
      capabilities: { collections: collectionsEnabled },
      myMember: { role: memberRole, status: 'active' },
    }),
    error: ref(null),
  }))
}

async function mountPage() {
  wrapper = mount(Host, {
    global: {
      components: { OrganizerCollectionForm },
      stubs: {
        VtMiniHeader: {
          props: ['title'],
          template: '<header><h1>{{ title }}</h1><slot name="right" /></header>',
        },
        VtCampaignIcon: true,
        VtIcon: true,
        SkeletonList: true,
        ErrorState: { props: ['message'], template: '<div data-error>{{ message }}</div>' },
        EmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}
const submit = async (page: VueWrapper) => {
  await page.get('form').trigger('submit')
  await flushPromises()
}
const patches = () => fetchApi.mock.calls.filter((c) => c[1]?.method === 'PATCH')

beforeEach(() => {
  stubGlobals()
  collectionsEnabled = true
  memberRole = 'owner'
  errorCode = undefined
  current = collection()
  fetchApi
    .mockReset()
    .mockImplementation(async (_url, opts) =>
      opts?.method === 'PATCH'
        ? { collection: current }
        : { collection: current, contributions: [] },
    )
  navigate.mockReset()
  toastShow.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('edit organizer collection (21.1.5)', () => {
  it('prefills the form from the collection', async () => {
    const page = await mountPage()
    expect(fetchApi).toHaveBeenCalledWith('/api/organizations/30/collections/4')
    expect((page.get('#mc-title').element as HTMLInputElement).value).toBe('Мячи')
    expect((page.get('#mc-description').element as HTMLTextAreaElement).value).toBe('Три мяча')
    expect((page.get('#mc-target').element as HTMLInputElement).value).toBe('250')
    expect((page.get('#mc-deadline').element as HTMLInputElement).value).toBe('2099-12-10')
    expect(page.find('input[name="mc-visibility"]').exists()).toBe(false)
  })

  it('sends only the changed fields and goes back to the collection', async () => {
    const page = await mountPage()
    await page.get('#mc-title').setValue('Новые мячи')
    await page.get('#mc-target').setValue('300')
    await submit(page)
    expect(patches()).toEqual([
      [
        '/api/organizations/30/collections/4',
        { method: 'PATCH', body: { title: 'Новые мячи', targetAmount: 30000 } },
      ],
    ])
    expect(toastShow).toHaveBeenCalledWith('Сбор обновлён')
    expect(navigate).toHaveBeenCalledWith('/m/orgs/30/collections/4')
  })

  it('goes back without a request when nothing changed', async () => {
    const page = await mountPage()
    await submit(page)
    expect(patches()).toEqual([])
    expect(navigate).toHaveBeenCalledWith('/m/orgs/30/collections/4')
  })

  it('clears the goal and the deadline', async () => {
    const page = await mountPage()
    await page.get('#mc-target').setValue('')
    await page.get('#mc-deadline').setValue('')
    await submit(page)
    expect(patches()[0]![1]!.body).toEqual({ targetAmount: null, deadlineAt: null })
  })

  it('reloads and explains when the collection was closed meanwhile', async () => {
    const page = await mountPage()
    errorCode = 'collection.not_active'
    fetchApi.mockImplementation(async (_url, opts) => {
      if (opts?.method === 'PATCH') throw new Error('conflict')
      return { collection: collection({ status: 'completed' }), contributions: [] }
    })
    await page.get('#mc-title').setValue('Новые мячи')
    await submit(page)
    expect(navigate).not.toHaveBeenCalled()
    expect(page.find('form').exists()).toBe(false)
    expect(page.get('[data-empty]').text()).toBe('Сбор закрыт')
  })

  it('does not open a closed collection for editing', async () => {
    current = collection({ status: 'cancelled' })
    const page = await mountPage()
    expect(page.find('form').exists()).toBe(false)
    expect(page.get('[data-empty]').text()).toBe('Сбор закрыт')
  })

  it('is unavailable while the flag is off and does not load the collection', async () => {
    collectionsEnabled = false
    const page = await mountPage()
    expect(page.find('form').exists()).toBe(false)
    expect(page.get('[data-empty]').text()).toBe('Правка сборов пока недоступна')
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('is not available to a player', async () => {
    memberRole = 'player'
    const page = await mountPage()
    expect(page.get('[data-empty]').text()).toBe('Только для организаторов')
    expect(fetchApi).not.toHaveBeenCalled()
  })
})
