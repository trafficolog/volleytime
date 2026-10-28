// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import PlayerBookingRow from './PlayerBookingRow.vue'
import Chip from './vt/Chip.vue'
import MyChip from './vt/MyChip.vue'

vi.stubGlobal('computed', computed)
afterEach(() => vi.unstubAllGlobals())

function mountRow(status: string, seatPayments?: Record<string, number>) {
  vi.stubGlobal('computed', computed)
  return mount(PlayerBookingRow, {
    props: {
      booking: {
        id: 7,
        status,
        method: 'cash',
        seats: 1,
        waitlistSeats: 0,
        paymentId: null,
        pricing: { mode: 'fixed', price: 1500 },
        seatPayments,
        event: {
          id: 3,
          title: 'Игра',
          status: 'published',
          startsAt: '2099-10-04T16:00:00.000Z',
          currency: 'BYN',
          venue: null,
        },
      } as never,
      orgId: 1,
      tz: 'Europe/Minsk',
      cancellable: false,
      cancelling: false,
    },
    global: {
      components: { VtChip: Chip, VtMyChip: MyChip },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

describe('player booking row: paid seat released (21.1.8, D-14)', () => {
  it('shows "paid, seat released" on a cancelled booking next to the cancelled chip', () => {
    const wrapper = mountRow('cancelled', { paidSeats: 0, pendingSeats: 0, releasedPaidSeats: 1 })
    expect(wrapper.get('[data-released-paid]').text()).toBe('Оплачено, место освобождено')
    expect(wrapper.text()).toContain('Запись отменена')
    wrapper.unmount()
  })

  it('names the count when several paid seats were released', () => {
    const wrapper = mountRow('confirmed', { paidSeats: 1, pendingSeats: 0, releasedPaidSeats: 2 })
    expect(wrapper.get('[data-released-paid]').text()).toBe('Оплачено, места освобождены: 2 места')
    wrapper.unmount()
  })

  it('shows nothing for an unpaid cancellation or an API without the status', () => {
    for (const seatPayments of [
      { paidSeats: 0, pendingSeats: 0, releasedPaidSeats: 0 },
      undefined,
    ]) {
      const wrapper = mountRow('cancelled', seatPayments)
      expect(wrapper.find('[data-released-paid]').exists()).toBe(false)
      wrapper.unmount()
    }
  })
})
