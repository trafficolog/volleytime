// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import OrganizerEventRow from './OrganizerEventRow.vue'
import Chip from './vt/Chip.vue'
import Meter from './vt/Meter.vue'

vi.stubGlobal('computed', computed)
afterEach(() => vi.unstubAllGlobals())

describe('organizer event status reflow', () => {
  it.each([
    ['draft', 'Черновик'],
    ['published', 'Опубликовано'],
    ['closed', 'Запись закрыта'],
    ['finished', 'Завершено'],
    ['cancelled', 'Отменено'],
  ])('keeps %s readable alongside the event details and link', (status, text) => {
    vi.stubGlobal('computed', computed)
    const wrapper = mount(OrganizerEventRow, {
      props: {
        event: {
          id: 1,
          title: 'Длинное название волейбольного события',
          status,
          startsAt: '2026-10-04T16:00:00.000Z',
          endsAt: '2026-10-04T18:00:00.000Z',
          capacity: 18,
          price: 800,
          currency: 'BYN',
          taken: 1,
          waitlist: 0,
          myBooking: null,
          venue: { name: 'Малый спортзал кооперативного университета' },
          locationText: null,
        },
        tz: 'Europe/Minsk',
        to: '/m/orgs/1/events/1/manage',
      },
      global: {
        components: { VtChip: Chip, VtMeter: Meter },
        stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      },
    })
    const chip = wrapper.get('.organizer-event-status')
    expect(chip.text()).toBe(text)
    // The mounted row must allow the full label to wrap inside its available width.
    // Real viewport containment is verified separately in Chromium.
    expect(chip.classes()).toContain('whitespace-normal')
    expect(chip.classes()).not.toContain('max-w-24')
    expect(wrapper.text()).toContain('Длинное название волейбольного события')
    expect(wrapper.text()).toContain('Малый спортзал кооперативного университета')
    expect(wrapper.text()).toContain('1/18')
    expect(wrapper.attributes('href')).toBe('/m/orgs/1/events/1/manage')
    wrapper.unmount()
  })
})
