// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onUnmounted, reactive, ref, Suspense, watch } from 'vue'

import Bookings from './bookings.vue'

import MyChip from '~/components/vt/MyChip.vue'
import { apiErrorMessage } from '~/utils/api-error'

const BookingsHost = defineComponent({
  render: () => h(Suspense, null, { default: () => h(Bookings) }),
})

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

const event = (id: number) => ({
  id,
  organizationId: 30,
  title: `Игра ${id}`,
  status: 'published',
  startsAt: '2027-10-01T16:00:00Z',
  endsAt: '2027-10-01T18:00:00Z',
  cancellationDeadlineHours: null,
  currency: 'BYN',
  venue: null,
})
const fixed = {
  mode: 'fixed',
  targetAmount: null,
  settledAt: null,
  participantCount: 0,
  minAmount: 1500,
  maxAmount: 1500,
  basis: 'fixed',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}
const booking = (id: number, extra: Record<string, unknown>) => ({
  id,
  status: 'waitlisted',
  organizationId: 30,
  pricing: fixed,
  event: event(id + 100),
  ...extra,
})

describe('player bookings: queue position and offer deadline (20.4.11)', () => {
  it('shows «В очереди · N-й» from the server position and the offer deadline in group time', async () => {
    fetchBookings.mockResolvedValue({
      bookings: [
        booking(1, { waitPos: 3 }),
        booking(2, {
          waitPos: 1,
          offer: { id: 9, seats: 1, expiresAt: '2027-10-03T10:20:00Z' },
        }),
        booking(3, { status: 'confirmed', waitPos: null }),
        booking(4, {}),
      ],
    })
    const wrapper = mount(BookingsHost, {
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
    })
    await flushPromises()
    const row = (id: number) => wrapper.get(`a[href="/m/orgs/30/events/${id + 100}"]`).text()
    expect(row(1)).toContain('В очереди · 3-й')
    expect(row(1)).not.toContain('Подтвердить до')
    expect(row(2)).toContain('В очереди · 1-й')
    expect(row(2)).toContain('Подтвердить до 13:20')
    expect(row(3)).toContain('Иду')
    expect(row(4)).toContain('В очереди')
    expect(row(4)).not.toContain('-й')
    wrapper.unmount()
  })
})
