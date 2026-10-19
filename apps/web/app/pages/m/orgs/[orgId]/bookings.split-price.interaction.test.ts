// @vitest-environment happy-dom
import { quoteEventPrice } from '@volley-time/shared'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onUnmounted, reactive, ref, Suspense, watch } from 'vue'

import Bookings from './bookings.vue'

import MyChip from '~/components/vt/MyChip.vue'
import { apiErrorMessage } from '~/utils/api-error'
import { formatMoneyRu } from '~/utils/labels'

/** Task 20.4.6: «Мои записи» берёт цену split из ответа цены (priceQuote), а не из pricing. */
const route = reactive({ params: { orgId: '30' }, fullPath: '/m/orgs/30/bookings' })
const fetchBookings = vi.fn<(url: string) => Promise<unknown>>()
vi.stubGlobal('definePageMeta', () => undefined)
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useOrgTimezone', () => ({ tz: ref('Europe/Minsk') }))
vi.stubGlobal('useTelegram', () => ({ confirm: vi.fn(), haptic: vi.fn() }))
vi.stubGlobal('computed', computed)
vi.stubGlobal('ref', ref)
vi.stubGlobal('watch', watch)
vi.stubGlobal('onUnmounted', onUnmounted)
vi.stubGlobal('$fetch', fetchBookings)
vi.stubGlobal('apiErrorMessage', apiErrorMessage)
vi.stubGlobal('apiErrorCode', () => undefined)
afterEach(() => {
  document.body.innerHTML = ''
  fetchBookings.mockReset()
})

const money = (minor: number) => formatMoneyRu(minor, 'BYN')
const legacy = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 3,
  minAmount: 1111,
  maxAmount: 1111,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}
const quote = (taken: number, mySeats: number) => ({
  ...quoteEventPrice({
    mode: 'split',
    targetAmount: 10000,
    capacity: 14,
    takenSeats: taken,
    mySeats,
    seats: 1,
    settled: null,
  }),
  currency: 'BYN',
})
const item = (id: number, status: string, priceQuote: unknown, over: object = {}) => ({
  id,
  status,
  organizationId: 30,
  pricing: legacy,
  priceQuote,
  event: {
    id: id + 100,
    organizationId: 30,
    title: `Игра ${id}`,
    status: 'published',
    startsAt: '2027-10-01T16:00:00Z',
    endsAt: '2027-10-01T18:00:00Z',
    cancellationDeadlineHours: null,
    currency: 'BYN',
    venue: null,
    ...over,
  },
})

async function mountBookings(items: unknown[]) {
  fetchBookings.mockResolvedValue({ bookings: items })
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(Bookings) }) }),
    {
      global: {
        stubs: {
          NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          VtMiniHeader: true,
          VtChip: { template: '<span><slot /></span>' },
          VtMyChip: MyChip,
          SkeletonList: true,
          ErrorState: true,
          EmptyState: true,
          PlayerAccessNotice: true,
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('player bookings: цена split из priceQuote (20.4.6)', () => {
  it('booked and waitlisted show the quote, not readEventPricing', async () => {
    const mine = quote(8, 1)
    const queued = quote(14, 0)
    const w = await mountBookings([
      item(1, 'confirmed', mine),
      item(2, 'waitlisted', queued),
      item(3, 'confirmed', quote(8, 1), { status: 'cancelled' }),
    ])
    const text = w.text()
    expect(text).toContain(`≈ ${money(mine.perSeat.max)}`)
    expect(text).toContain(`≈ ${money(queued.perSeat.max)}, если получите место`)
    expect(text).not.toContain(money(1111))
    expect(text).not.toContain('если запишетесь')
    // отменённое событие цену не показывает
    const cancelled = w.findAll('li').find((li) => li.text().includes('Игра 3'))
    expect(cancelled?.text()).not.toContain('≈')
    w.unmount()
  })

  it('no quote (unavailable) means no number', async () => {
    const w = await mountBookings([item(1, 'confirmed', null)])
    expect(w.text()).not.toContain('≈')
    expect(w.text()).not.toContain(money(1111))
    w.unmount()
  })
})
