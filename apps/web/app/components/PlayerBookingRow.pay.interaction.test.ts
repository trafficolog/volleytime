// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import PlayerBookingRow from './PlayerBookingRow.vue'
import Chip from './vt/Chip.vue'
import MyChip from './vt/MyChip.vue'

afterEach(() => vi.unstubAllGlobals())

function mountRow(over: Record<string, unknown> = {}, cancellable = true) {
  vi.stubGlobal('computed', computed)
  return mount(PlayerBookingRow, {
    props: {
      booking: {
        id: 7,
        status: 'pending_payment',
        method: 'transfer',
        seats: 2,
        waitlistSeats: 0,
        paymentId: null,
        pricing: { mode: 'fixed', price: 1500 },
        seatPayments: { paidSeats: 0, pendingSeats: 2, releasedPaidSeats: 0 },
        event: {
          id: 3,
          title: 'Воскресная игра',
          status: 'published',
          startsAt: '2099-10-04T16:00:00.000Z',
          currency: 'BYN',
          venue: null,
        },
        ...over,
      } as never,
      orgId: 30,
      tz: 'Europe/Minsk',
      cancellable,
      cancelling: false,
    },
    global: {
      components: { VtChip: Chip, VtMyChip: MyChip },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

describe('player booking row: «Оплатить» (21.4.8, M-13)', () => {
  it('leads a pending-payment booking to its payment screen, next to «Отменить»', () => {
    const wrapper = mountRow()
    const pay = wrapper.get('[data-pay-booking]')
    expect(pay.text()).toBe('Оплатить')
    expect(pay.attributes('href')).toBe('/m/orgs/30/pay/7')
    expect(wrapper.text()).toContain('Отменить запись')
    wrapper.unmount()
  })

  it('still offers payment when the deadline hides «Отменить»', () => {
    const wrapper = mountRow({}, false)
    expect(wrapper.find('[data-pay-booking]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Отменить запись')
    wrapper.unmount()
  })

  it('shows no «Оплатить» for confirmed, subscription, cancelled and waitlisted rows', () => {
    for (const over of [
      { status: 'confirmed' },
      { status: 'pending_payment', method: 'subscription' },
      { status: 'cancelled' },
      { status: 'waitlisted' },
    ]) {
      const wrapper = mountRow(over)
      expect(wrapper.find('[data-pay-booking]').exists()).toBe(false)
      wrapper.unmount()
    }
  })
})
