// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref, Suspense, watch } from 'vue'

import Detail from './index.vue'

import OrganizerCollectionManage from '~/components/OrganizerCollectionManage.vue'
import { apiErrorMessage } from '~/utils/api-error'

const Host = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Detail) }),
})

const API = '/api/organizations/30/collections/4'
const route = reactive({
  params: { orgId: '30', collectionId: '4' },
  fullPath: '/m/orgs/30/collections/4',
})
const confirmAsk = vi.fn<(message: string) => Promise<boolean>>()
const haptic = vi.fn()
const toastShow = vi.fn()
let collectionsEnabled = true
let memberRole = 'owner'
let errorCode: string | undefined
let current: { collection: Record<string, unknown>; contributions: unknown[] }
const calls: { url: string; method: string; body?: unknown }[] = []
let failNext: Error | undefined
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
  pledged: 4500,
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
const standard = () => ({
  collection: collection(),
  contributions: [
    contribution(1, 'Артём', 'pending', 1500),
    contribution(2, 'Маша', 'pending', 3000),
    contribution(3, 'Игорь', 'succeeded', 1500),
  ],
})

const fetchApi = vi.fn(async (url: string, opts?: { method?: string; body?: unknown }) => {
  const method = opts?.method ?? 'GET'
  calls.push({ url, method, body: opts?.body })
  if (method !== 'GET' && failNext) {
    const error = failNext
    failNext = undefined
    throw error
  }
  return method === 'GET' ? current : {}
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
  vi.stubGlobal('useTelegram', () => ({ confirm: confirmAsk, haptic }))
  vi.stubGlobal('useToast', () => ({ show: toastShow }))
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
    attachTo: document.body,
    global: {
      components: { OrganizerCollectionManage },
      stubs: {
        VtMiniHeader: {
          props: ['title', 'sub'],
          template: '<header><h1>{{ title }}|{{ sub }}</h1><slot name="right" /></header>',
        },
        VtSheet: {
          props: ['modelValue'],
          template: '<div v-if="modelValue" data-sheet><slot /></div>',
        },
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

const posts = () => calls.filter((c) => c.method !== 'GET')
const gets = () => calls.filter((c) => c.method === 'GET')
const pledges = (page: VueWrapper) => page.findAll('[data-pledge]')
async function openMenu(page: VueWrapper) {
  await page.get('button[aria-label="Действия со сбором"]').trigger('click')
  await flushPromises()
}
const menuTexts = (page: VueWrapper) =>
  page.findAll('[data-sheet] a, [data-sheet] button').map((el) => el.text())

beforeEach(() => {
  stubGlobals()
  collectionsEnabled = true
  memberRole = 'owner'
  errorCode = undefined
  failNext = undefined
  current = standard()
  calls.length = 0
  confirmAsk.mockReset().mockResolvedValue(true)
  haptic.mockReset()
  toastShow.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('organizer collection management (21.1.5)', () => {
  it('shows the progress, the waiting pledges and who has paid', async () => {
    const page = await mountPage()
    expect(page.get('h1').text()).toContain('Новый комплект мячей')
    expect(page.get('h1').text()).toContain('70%')
    const totals = page.get('section[aria-label="Итоги сбора"]')
    expect(totals.text()).toContain('цель 250,00 BYN')
    expect(totals.text()).toContain('+45,00 BYN')
    expect(totals.text()).toContain('75,00 BYN')
    expect(totals.get('[role="meter"]').attributes('aria-valuenow')).toBe('70')
    expect(page.get('[data-pledges-count]').text()).toBe('2')
    expect(pledges(page)).toHaveLength(2)
    expect(pledges(page)[0]!.text()).toContain('Артём')
    expect(pledges(page)[0]!.text()).toContain('обещал наличными')
    expect(pledges(page)[0]!.text()).toContain('15,00 BYN')
    const paid = page.findAll('[data-paid]')
    expect(paid).toHaveLength(1)
    expect(paid[0]!.text()).toContain('Игорь')
    expect(paid[0]!.text()).toContain('+15,00 BYN')
  })

  it('confirms a pledge with the API, reloads the screen and shows a toast', async () => {
    const page = await mountPage()
    current = {
      collection: collection({ collected: 19000, pledged: 3000 }),
      contributions: [
        contribution(2, 'Маша', 'pending', 3000),
        contribution(1, 'Артём', 'succeeded', 1500),
        contribution(3, 'Игорь', 'succeeded', 1500),
      ],
    }
    await pledges(page)[0]!.get('button[aria-label^="Подтвердить"]').trigger('click')
    await flushPromises()
    expect(posts()).toEqual([{ url: `${API}/contributions/1/confirm`, method: 'POST' }])
    expect(confirmAsk).not.toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith('Подтверждено · Артём · +15,00 BYN')
    expect(gets().length).toBeGreaterThanOrEqual(2)
    expect(pledges(page)).toHaveLength(1)
    expect(page.findAll('[data-paid]')).toHaveLength(2)
    expect(page.get('section[aria-label="Итоги сбора"]').text()).toContain('190,00 BYN')
  })

  it('asks before rejecting a pledge and does nothing when declined', async () => {
    confirmAsk.mockResolvedValue(false)
    const page = await mountPage()
    await pledges(page)[1]!.get('button[aria-label^="Отклонить"]').trigger('click')
    await flushPromises()
    expect(confirmAsk).toHaveBeenCalledTimes(1)
    expect(confirmAsk.mock.calls[0]![0]).toContain('Маша')
    expect(confirmAsk.mock.calls[0]![0]).toContain('30,00 BYN')
    expect(posts()).toEqual([])
    expect(pledges(page)).toHaveLength(2)
  })

  it('rejects a pledge after the confirmation', async () => {
    const page = await mountPage()
    current = {
      collection: collection({ pledged: 1500 }),
      contributions: [
        contribution(1, 'Артём', 'pending', 1500),
        contribution(3, 'Игорь', 'succeeded', 1500),
      ],
    }
    await pledges(page)[1]!.get('button[aria-label^="Отклонить"]').trigger('click')
    await flushPromises()
    expect(posts()).toEqual([{ url: `${API}/contributions/2/reject`, method: 'POST' }])
    expect(toastShow).toHaveBeenCalledWith('Отклонено · Маша')
    expect(pledges(page)).toHaveLength(1)
  })

  it('shows a message and reloads on 409 payment.not_pending', async () => {
    const page = await mountPage()
    failNext = Object.assign(new Error('conflict'), { statusCode: 409 })
    errorCode = 'payment.not_pending'
    current = {
      collection: collection({ collected: 19000, pledged: 3000 }),
      contributions: [
        contribution(2, 'Маша', 'pending', 3000),
        contribution(1, 'Артём', 'succeeded', 1500),
      ],
    }
    const before = gets().length
    await pledges(page)[0]!.get('button[aria-label^="Подтвердить"]').trigger('click')
    await flushPromises()
    expect(page.get('[role="alert"]').text()).toBe('Обещание уже обработано — список обновлён')
    expect(gets().length).toBeGreaterThan(before)
    expect(pledges(page)).toHaveLength(1)
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('keeps pledges decidable and offers only finish and cancel while the flag is off', async () => {
    collectionsEnabled = false
    const page = await mountPage()
    expect(pledges(page)[0]!.find('button[aria-label^="Подтвердить"]').exists()).toBe(true)
    expect(pledges(page)[0]!.find('button[aria-label^="Отклонить"]').exists()).toBe(true)
    await openMenu(page)
    expect(menuTexts(page)).toEqual(['Завершить сбор', 'Отменить сбор'])
  })

  it('offers edit, finish and cancel for an active collection while the flag is on', async () => {
    const page = await mountPage()
    await openMenu(page)
    expect(menuTexts(page)).toEqual(['Изменить сбор', 'Завершить сбор', 'Отменить сбор'])
    expect(page.get('[data-sheet] a').attributes('href')).toBe('/m/orgs/30/collections/4/edit')
  })

  it('finishes the collection after a confirmation', async () => {
    const page = await mountPage()
    current = {
      collection: collection({ status: 'completed', closedAt: '2026-11-05T10:00:00.000Z' }),
      contributions: standard().contributions,
    }
    await openMenu(page)
    await page
      .findAll('[data-sheet] button')
      .find((b) => b.text() === 'Завершить сбор')!
      .trigger('click')
    await flushPromises()
    expect(confirmAsk.mock.calls[0]![0]).toContain('Завершить сбор?')
    expect(posts()).toEqual([{ url: `${API}/complete`, method: 'POST' }])
    expect(toastShow).toHaveBeenCalledWith('Сбор завершён')
    expect(page.get('h1').text()).toContain('завершён')
  })

  it('does not finish the collection when the confirmation is declined', async () => {
    confirmAsk.mockResolvedValue(false)
    const page = await mountPage()
    await openMenu(page)
    await page
      .findAll('[data-sheet] button')
      .find((b) => b.text() === 'Завершить сбор')!
      .trigger('click')
    await flushPromises()
    expect(posts()).toEqual([])
  })

  it('cancels the collection after a confirmation that says pledges are rejected', async () => {
    const page = await mountPage()
    current = {
      collection: collection({
        status: 'cancelled',
        closedAt: '2026-11-05T10:00:00.000Z',
        pledged: 0,
      }),
      contributions: [contribution(3, 'Игорь', 'succeeded', 1500)],
    }
    await openMenu(page)
    await page
      .findAll('[data-sheet] button')
      .find((b) => b.text() === 'Отменить сбор')!
      .trigger('click')
    await flushPromises()
    expect(confirmAsk.mock.calls[0]![0]).toContain('Ожидающие обещания будут отклонены')
    expect(posts()).toEqual([{ url: `${API}/cancel`, method: 'POST' }])
    expect(toastShow).toHaveBeenCalledWith('Сбор отменён')
    expect(page.get('h1').text()).toContain('отменён')
    expect(page.find('button[aria-label="Действия со сбором"]').exists()).toBe(false)
  })

  it('publishes a draft with PATCH status active when the flag is on', async () => {
    current = {
      collection: collection({ status: 'draft', collected: 0, pledged: 0 }),
      contributions: [],
    }
    const page = await mountPage()
    expect(page.text()).toContain('Черновик: игроки сбор не видят')
    await openMenu(page)
    expect(menuTexts(page)).toEqual(['Изменить сбор', 'Опубликовать', 'Отменить сбор'])
    current = { collection: collection({ collected: 0, pledged: 0 }), contributions: [] }
    await page
      .findAll('[data-sheet] button')
      .find((b) => b.text() === 'Опубликовать')!
      .trigger('click')
    await flushPromises()
    expect(posts()).toEqual([{ url: API, method: 'PATCH', body: { status: 'active' } }])
    expect(toastShow).toHaveBeenCalledWith('Сбор опубликован')
  })

  it('hides publish and edit for a draft while the flag is off', async () => {
    collectionsEnabled = false
    current = {
      collection: collection({ status: 'draft', collected: 0, pledged: 0 }),
      contributions: [],
    }
    const page = await mountPage()
    await openMenu(page)
    expect(menuTexts(page)).toEqual(['Отменить сбор'])
  })

  it('keeps waiting pledges of a finished collection decidable and has no menu', async () => {
    current = {
      collection: collection({ status: 'completed', closedAt: '2026-11-05T10:00:00.000Z' }),
      contributions: [contribution(1, 'Артём', 'pending', 1500)],
    }
    const page = await mountPage()
    expect(pledges(page)).toHaveLength(1)
    expect(pledges(page)[0]!.find('button[aria-label^="Подтвердить"]').exists()).toBe(true)
    expect(page.find('button[aria-label="Действия со сбором"]').exists()).toBe(false)
  })

  it('shows a closed collection message on 409 collection.not_active and reloads', async () => {
    const page = await mountPage()
    failNext = Object.assign(new Error('conflict'), { statusCode: 409 })
    errorCode = 'collection.not_active'
    current = {
      collection: collection({ status: 'completed', closedAt: '2026-11-05T10:00:00.000Z' }),
      contributions: standard().contributions,
    }
    await openMenu(page)
    await page
      .findAll('[data-sheet] button')
      .find((b) => b.text() === 'Завершить сбор')!
      .trigger('click')
    await flushPromises()
    expect(page.get('[role="alert"]').text()).toBe('Сбор уже закрыт — экран обновлён')
    expect(page.get('h1').text()).toContain('завершён')
  })

  it('does not show management to a player', async () => {
    memberRole = 'player'
    const page = await mountPage()
    expect(page.find('[data-pledge]').exists()).toBe(false)
    expect(page.find('button[aria-label="Действия со сбором"]').exists()).toBe(false)
    expect(page.find('a[href$="/pledge"]').exists()).toBe(true)
  })
})
