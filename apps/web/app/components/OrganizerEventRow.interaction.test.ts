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

function mountRow(status: string, taken = 1) {
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
        venue: { name: 'Малый спортзал кооперативного университета' },
        locationText: null,
      },
      tz: 'Europe/Minsk',
      to: '/m/orgs/1/events/1/manage',
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
