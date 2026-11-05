// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import NewCollection from './new.vue'

import OrganizerCollectionForm from '~/components/OrganizerCollectionForm.vue'
import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(NewCollection) }),
})

const route = reactive({ params: { orgId: '30' }, path: '/m/orgs/30/collections/new' })
const fetchApi =
  vi.fn<(url: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>>()
const navigate = vi.fn()
const toastShow = vi.fn()
let collectionsEnabled = true
let memberRole = 'owner'
let errorCode: string | undefined
let wrapper: VueWrapper | undefined

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
        ErrorState: { props: ['message'], template: '<div data-error>{{ message }}</div>' },
        EmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

async function fill(page: VueWrapper, values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) await page.get(`#${id}`).setValue(value)
}
const submit = async (page: VueWrapper) => {
  await page.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  stubGlobals()
  collectionsEnabled = true
  memberRole = 'owner'
  errorCode = undefined
  fetchApi.mockReset().mockResolvedValue({ collection: { id: 9 } })
  navigate.mockReset()
  toastShow.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

describe('new organizer collection (21.1.5)', () => {
  it('creates a published collection with the goal in minor units and a group-zone deadline', async () => {
    const page = await mountPage()
    await fill(page, {
      'mc-title': '  Новый комплект мячей ',
      'mc-description': 'Три мяча',
      'mc-target': '250,50',
      'mc-deadline': '2099-06-05',
    })
    await page.get('button[aria-label="Турнир"]').trigger('click')
    await submit(page)
    expect(fetchApi).toHaveBeenCalledTimes(1)
    expect(fetchApi.mock.calls[0]![0]).toBe('/api/organizations/30/collections')
    expect(fetchApi.mock.calls[0]![1]).toEqual({
      method: 'POST',
      body: {
        title: 'Новый комплект мячей',
        description: 'Три мяча',
        icon: 'trophy',
        targetAmount: 25050,
        deadlineAt: '2099-06-05T20:59:00.000Z',
        status: 'active',
      },
    })
    expect(toastShow).toHaveBeenCalledWith('Создан сбор «Новый комплект мячей»')
    expect(navigate).toHaveBeenCalledWith('/m/orgs/30/collections')
  })

  it('can create a draft', async () => {
    const page = await mountPage()
    await fill(page, { 'mc-title': 'Турнир' })
    await page.get('input[value="draft"]').setValue(true)
    await submit(page)
    expect((fetchApi.mock.calls[0]![1]!.body as { status: string }).status).toBe('draft')
  })

  it('creates a collection without a goal and without a deadline', async () => {
    const page = await mountPage()
    await fill(page, { 'mc-title': 'На всякий случай' })
    await submit(page)
    expect(fetchApi.mock.calls[0]![1]!.body).toMatchObject({
      targetAmount: null,
      deadlineAt: null,
      description: null,
    })
  })

  it('shows field errors and sends nothing for an empty title, a bad goal and a past deadline', async () => {
    const page = await mountPage()
    await fill(page, { 'mc-target': 'abc', 'mc-deadline': '2020-01-01' })
    await submit(page)
    expect(fetchApi).not.toHaveBeenCalled()
    expect(page.get('#mc-title-error').text()).toContain('Название')
    expect(page.get('#mc-target-error').text()).toContain('Укажите сумму')
    expect(page.get('#mc-deadline-error').text()).toContain('в будущем')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows the server error and stays on the form', async () => {
    fetchApi.mockRejectedValueOnce(new Error('boom'))
    const page = await mountPage()
    await fill(page, { 'mc-title': 'Мячи' })
    await submit(page)
    expect(page.get('[role="alert"]').text()).toBe('Не удалось создать сбор')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('is unavailable while the flag is off', async () => {
    collectionsEnabled = false
    const page = await mountPage()
    expect(page.find('form').exists()).toBe(false)
    expect(page.get('[data-empty]').text()).toBe('Создание сборов пока недоступно')
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it('blocks the form when the server says collections are disabled', async () => {
    errorCode = 'collection.disabled'
    fetchApi.mockRejectedValueOnce(new Error('disabled'))
    const page = await mountPage()
    await fill(page, { 'mc-title': 'Мячи' })
    await submit(page)
    expect(page.find('form').exists()).toBe(false)
    expect(page.get('[data-empty]').text()).toBe('Создание сборов пока недоступно')
  })

  it('is not available to a player', async () => {
    memberRole = 'player'
    const page = await mountPage()
    expect(page.find('form').exists()).toBe(false)
    expect(page.get('[data-empty]').text()).toBe('Только для организаторов')
  })
})
