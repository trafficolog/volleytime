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

const split = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 3,
  minAmount: 3333,
  maxAmount: 3334,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
}
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
const booking = (id: number, status: string, pricing: unknown) => ({
  id,
  status,
  organizationId: 30,
  pricing,
  event: event(id + 100),
})

async function mountBookings(items: unknown[]) {
  fetchBookings.mockResolvedValue({ bookings: items })
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
  return wrapper
}

describe('player bookings page money and status labels (moved from home, 20.4.4)', () => {
  it('shows split forecast, settled amount, waitlist text and the payment chip', async () => {
    const w = await mountBookings([
      booking(1, 'confirmed', {
        ...split,
        basis: 'settled',
        settledAt: '2026-10-02T12:00:00Z',
        myAllocatedAmount: 3334,
        myPaymentStatus: 'refunded',
      }),
      booking(2, 'pending_payment', split),
      booking(3, 'waitlisted', split),
      booking(4, 'waitlisted', { ...split, basis: 'settled', settledAt: '2026-10-02T12:00:00Z' }),
      booking(5, 'confirmed', {
        ...split,
        basis: 'settled',
        settledAt: '2026-10-02T12:00:00Z',
        myAllocatedAmount: 3334,
        myPaymentStatus: 'pending',
      }),
      booking(6, 'pending_payment', {
        mode: 'fixed',
        targetAmount: null,
        settledAt: null,
        participantCount: 0,
        minAmount: 1500,
        maxAmount: 1500,
        basis: 'fixed',
        myAllocatedAmount: null,
        myPaymentStatus: null,
      }),
    ])
    const row = (id: number) => w.get(`a[href="/m/orgs/30/events/${id + 100}"]`).text()
    expect(row(1)).toContain('33,34 BYN')
    expect(row(1)).toContain('Возвращено')
    expect(row(2)).toContain('Прогноз')
    expect(row(3)).toContain('Начисления нет')
    expect(row(3)).toContain('Доля появится')
    expect(row(4)).toContain('переход из листа ожидания в состав недоступен')
    expect(row(4)).not.toContain('Доля появится')
    expect(row(5)).toContain('Ждёт оплаты')
    expect(row(6)).toContain('Ждёт оплаты')
    expect(w.text()).not.toContain('Бесплатно')
    w.unmount()
  })

  it('лист ожидания — отдельный раздел с кнопкой «Выйти», основные записи — с «Отменить»', async () => {
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
    const w = await mountBookings([booking(1, 'confirmed', fixed), booking(2, 'waitlisted', fixed)])
    const waiting = w.get('[aria-labelledby="bookings-waitlist-title"]')
    expect(waiting.text()).toContain('В листе ожидания')
    expect(waiting.text()).toContain('Игра 102')
    expect(waiting.text()).toContain('Вы в очереди')
    expect(waiting.get('button').text()).toBe('Выйти из листа ожидания')
    expect(waiting.text()).not.toContain('Игра 101')
    const main = w.findAll('[data-booking-row]').filter((row) => row.text().includes('Игра 101'))
    expect(main).toHaveLength(1)
    expect(main[0]!.get('button').text()).toBe('Отменить запись')
    w.unmount()
  })
})
