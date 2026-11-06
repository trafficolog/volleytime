// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import OrganizerEventRow from './OrganizerEventRow.vue'
import Icon from './vt/Icon.vue'
import SeatsMini from './vt/SeatsMini.vue'
import StateChip from './vt/StateChip.vue'

vi.stubGlobal('computed', computed)
afterEach(() => vi.unstubAllGlobals())

function mountRow(
  status: string,
  taken = 1,
  extra: { pending?: number | null; event?: Record<string, unknown> } = {},
) {
  vi.stubGlobal('computed', computed)
  return mount(OrganizerEventRow, {
    props: {
      event: {
        id: 1,
        title: 'Длинное название волейбольного события',
        status,
        startsAt: '2099-10-04T16:00:00.000Z',
        endsAt: '2099-10-04T18:00:00.000Z',
        capacity: 18,
        price: 800,
        currency: 'BYN',
        taken,
        waitlist: 0,
        myBooking: null,
        ...extra.event,
        venue: { name: 'Малый спортзал кооперативного университета' },
        locationText: null,
      },
      tz: 'Europe/Minsk',
      to: '/m/orgs/1/events/1/manage',
      pending: extra.pending,
    },
    global: {
      components: { VtStateChip: StateChip, VtSeatsMini: SeatsMini, VtIcon: Icon },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

describe('organizer event row status model', () => {
  it.each([
    ['draft', 'Черновик'],
    ['closed', 'Запись закрыта'],
    ['finished', 'Прошла'],
    ['cancelled', 'Отменена'],
  ])('shows %s as one neutral word next to the event details', (status, text) => {
    const wrapper = mountRow(status)
    const chip = wrapper.get('.organizer-event-status')
    expect(chip.text()).toBe(text)
    expect(chip.classes()).toContain('vt-chip--state')
    expect(wrapper.text()).toContain('Длинное название волейбольного события')
    expect(wrapper.text()).toContain('Малый спортзал кооперативного университета')
    expect(wrapper.text()).toContain('1/18')
    expect(wrapper.attributes('href')).toBe('/m/orgs/1/events/1/manage')
    wrapper.unmount()
  })

  it('has no state chip for an open published event and keeps seats as number + meter', () => {
    const wrapper = mountRow('published', 12)
    expect(wrapper.find('.organizer-event-status').exists()).toBe(false)
    expect(wrapper.text()).toContain('12/18')
    expect(wrapper.get('[role="meter"]').attributes('aria-label')).toBe('Занято 12 из 18')
    wrapper.unmount()
  })

  it('says «мест нет» only while the event is open', () => {
    expect(mountRow('published', 18).text()).toContain('мест нет')
    expect(mountRow('closed', 18).text()).toContain('18/18')
  })
})

describe('organizer event row payment chips (21.1.1)', () => {
  it('shows an amber chip with number agreement while payments wait', () => {
    const one = mountRow('published', 5, { pending: 1 })
    expect(one.get('[data-pay-chip="amber"]').text()).toBe('1 ждёт оплаты')
    const two = mountRow('published', 5, { pending: 2 })
    expect(two.get('[data-pay-chip="amber"]').text()).toBe('2 ждут оплаты')
  })

  it('shows a green chip only with collected money and nothing without pending data', () => {
    const paid = { paymentTotals: { paid: 1000, pending: 0 } }
    expect(
      mountRow('published', 5, { pending: 0, event: paid }).get('[data-pay-chip="grass"]').text(),
    ).toBe('все оплатили')
    expect(mountRow('published', 5, { pending: 0 }).find('[data-pay-chip]').exists()).toBe(false)
    expect(mountRow('published', 5, { event: paid }).find('[data-pay-chip]').exists()).toBe(false)
  })

  it('adds the neutral queue chip and keeps the closed state a separate grey word', () => {
    const wrapper = mountRow('closed', 5, { pending: 0, event: { waitlist: 2 } })
    expect(wrapper.get('[data-pay-chip="state"]').text()).toBe('очередь · 2 чел.')
    expect(wrapper.text()).toContain('Запись закрыта')
  })

  it('shows the split price per seat as a forecast', () => {
    const wrapper = mountRow('published', 5, {
      event: {
        pricing: {
          mode: 'split',
          targetAmount: 24000,
          settledAt: null,
          participantCount: 8,
          minAmount: 3000,
          maxAmount: 3000,
          basis: 'current',
          myAllocatedAmount: null,
          myPaymentStatus: null,
        },
      },
    })
    expect(wrapper.get('[data-split-forecast]').text()).toBe('≈ 30,00 BYN')
  })
})
