// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref, Suspense } from 'vue'

import Pay from './[bookingId].vue'

import PlayerPaymentInstructions from '~/components/PlayerPaymentInstructions.vue'
import { apiErrorMessage } from '~/utils/api-error'

const fetchMock = vi.fn<(url: string, opts?: unknown) => Promise<unknown>>()

function stubPage(bookingId: string) {
  vi.stubGlobal('definePageMeta', () => undefined)
  vi.stubGlobal('useRoute', () => ({ params: { orgId: '30', bookingId } }))
  vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('apiErrorMessage', apiErrorMessage)
  vi.stubGlobal('apiErrorCode', () => undefined)
}

const booking = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  organizationId: 30,
  status: 'pending_payment',
  method: 'transfer',
  seats: 2,
  pricing: { mode: 'fixed', minAmount: 1500, maxAmount: 1500, myAllocatedAmount: null },
  seatPayments: { paidSeats: 0, pendingSeats: 2, releasedPaidSeats: 0 },
  event: {
    id: 3,
    organizationId: 30,
    title: 'Воскресная игра',
    status: 'published',
    startsAt: '2099-10-04T16:00:00.000Z',
    currency: 'BYN',
    venue: { name: 'Школа №24' },
  },
  ...over,
})

const methods = [
  { method: 'cash', enabled: true, bank: null, cardLast4: null, recipient: null },
  {
    method: 'transfer',
    enabled: false,
    bank: 'Belarusbank',
    cardLast4: '3214',
    recipient: 'И. П.',
  },
]

async function render(bookings: unknown[]) {
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith('/payment-methods') ? { methods } : { bookings },
  )
  const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Pay) }) })
  const wrapper = mount(host, {
    global: {
      components: { PlayerPaymentInstructions },
      stubs: {
        VtMiniHeader: { props: ['title'], template: '<header>{{ title }}</header>' },
        VtChip: { template: '<span><slot /></span>' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        SkeletonList: true,
        ErrorState: { props: ['message'], template: '<p data-error>{{ message }}</p>' },
        EmptyState: { props: ['title'], template: '<p data-empty>{{ title }}</p>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  document.body.innerHTML = ''
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('payment screen of a booking (21.4.8, M-13)', () => {
  it('shows the booking and the organizer requisites of the enabled methods only', async () => {
    stubPage('7')
    const wrapper = await render([booking(7), booking(8)])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/organizations/30/bookings/my',
      expect.objectContaining({ query: expect.objectContaining({ filter: 'all' }) }),
    )
    expect(wrapper.text()).toContain('Воскресная игра')
    expect(wrapper.text()).toContain('Ждёт оплаты')
    expect(wrapper.text()).toContain('2 места')
    expect(wrapper.find('[data-method="cash"]').exists()).toBe(true)
    // выключенный способ и его реквизиты не показываются
    expect(wrapper.find('[data-method="transfer"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Belarusbank')
    expect(wrapper.find('a[href="/m/orgs/30/bookings"]').exists()).toBe(true)
  })

  it('shows the amount to pay like the bookings row', async () => {
    stubPage('7')
    const wrapper = await render([booking(7)])
    expect(wrapper.get('[data-testid="pay-amount"]').text()).toContain('15,00')
  })

  it('still opens for a past booking that is waiting for payment (past tab)', async () => {
    stubPage('7')
    const wrapper = await render([
      booking(7, { event: { ...booking(7).event, startsAt: '2020-10-04T16:00:00.000Z' } }),
    ])
    expect(wrapper.find('[data-empty]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Воскресная игра')
    expect(wrapper.find('[data-method="cash"]').exists()).toBe(true)
  })

  it('does not know a booking that is not in the own list (foreign or unknown id)', async () => {
    stubPage('99')
    const wrapper = await render([booking(7)])
    expect(wrapper.find('[data-empty]').text()).toBe('Запись не найдена')
    expect(wrapper.find('[data-method]').exists()).toBe(false)
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(
      '/api/organizations/30/payment-methods',
    )
  })

  it('ignores a booking of another group even if the API returned it', async () => {
    stubPage('7')
    const wrapper = await render([booking(7, { organizationId: 31 })])
    expect(wrapper.find('[data-empty]').exists()).toBe(true)
    expect(wrapper.find('[data-method]').exists()).toBe(false)
  })

  it('says nothing is due for a booking that does not wait for payment', async () => {
    stubPage('7')
    const wrapper = await render([booking(7, { status: 'confirmed' })])
    expect(wrapper.find('[data-empty]').text()).toBe('Оплата не требуется')
    expect(wrapper.find('[data-method]').exists()).toBe(false)
  })

  it('shows a retryable error when the list does not load', async () => {
    stubPage('7')
    fetchMock.mockRejectedValue(new Error('boom'))
    const host = defineComponent({ render: () => h(Suspense, null, { default: () => h(Pay) }) })
    const wrapper = mount(host, {
      global: {
        stubs: {
          VtMiniHeader: true,
          NuxtLink: true,
          SkeletonList: true,
          ErrorState: { props: ['message'], template: '<p data-error>{{ message }}</p>' },
          EmptyState: true,
        },
      },
    })
    await flushPromises()
    expect(wrapper.find('[data-error]').text()).toBe('Не удалось загрузить запись')
  })
})
