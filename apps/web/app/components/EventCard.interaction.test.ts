// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import EventCard, { type EventListItem } from './EventCard.vue'
import Chip from './vt/Chip.vue'
import Icon from './vt/Icon.vue'
import MyChip from './vt/MyChip.vue'
import SeatsMini from './vt/SeatsMini.vue'
import StateChip from './vt/StateChip.vue'

vi.stubGlobal('computed', computed)
afterEach(() => vi.unstubAllGlobals())

function event(over: Partial<EventListItem> = {}): EventListItem {
  return {
    id: 1,
    title: 'Тренировка',
    status: 'published',
    startsAt: '2099-10-04T16:00:00.000Z',
    endsAt: '2099-10-04T18:00:00.000Z',
    capacity: 16,
    price: 0,
    currency: 'BYN',
    taken: 5,
    waitlist: 0,
    myBooking: null,
    venue: { name: 'Зал' },
    locationText: null,
    ...over,
  }
}

function render(ev: EventListItem, presentation: 'card' | 'schedule') {
  vi.stubGlobal('computed', computed)
  return mount(EventCard, {
    props: { event: ev, tz: 'Europe/Minsk', to: '/e/1', presentation },
    global: {
      components: {
        VtChip: Chip,
        VtIcon: Icon,
        VtMyChip: MyChip,
        VtStateChip: StateChip,
        VtSeatsMini: SeatsMini,
      },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

describe.each(['card', 'schedule'] as const)('EventCard %s status axes', (presentation) => {
  it('open event, not booked: seats only, no word chips', () => {
    const w = render(event(), presentation)
    expect(w.find('.vt-chip--mine, .vt-chip--queue, .vt-chip--state').exists()).toBe(false)
    expect(w.text()).toContain('5/16')
  })

  it('full open event says «мест нет» on a rose meter, not in a chip', () => {
    const w = render(event({ taken: 16, waitlist: 2 }), presentation)
    expect(w.text()).toContain('мест нет')
    expect(w.find('[role="meter"] i').attributes('style')).toContain('var(--vt-rose)')
    expect(w.find('.vt-chip--rose').exists()).toBe(false)
  })

  it('shows «Иду» for a confirmed booking and keeps payment as a separate amber chip', () => {
    const w = render(event({ myBooking: { id: 1, status: 'pending_payment' } }), presentation)
    expect(w.get('.vt-chip--mine').text()).toBe('Иду')
    expect(w.get('.vt-chip--amber').text()).toBe('Ждёт оплаты')
  })

  it('closed event with my booking: grey state word plus blue «Иду»', () => {
    const w = render(
      event({ status: 'closed', taken: 16, myBooking: { id: 1, status: 'confirmed' } }),
      presentation,
    )
    expect(w.get('.vt-chip--state').text()).toBe('Запись закрыта')
    expect(w.get('.vt-chip--mine').text()).toBe('Иду')
    expect(w.text()).toContain('16/16')
    expect(w.text()).not.toContain('мест нет')
  })

  it('queue chip for a waitlisted booking, with no payment chip', () => {
    const w = render(event({ taken: 16, myBooking: { id: 1, status: 'waitlisted' } }), presentation)
    expect(w.get('.vt-chip--queue').text()).toBe('В очереди')
    expect(w.find('.vt-chip--amber').exists()).toBe(false)
  })

  it('cancelled and past events get the neutral state word', () => {
    expect(
      render(event({ status: 'cancelled' }), presentation)
        .get('.vt-chip--state')
        .text(),
    ).toBe('Отменена')
    expect(
      render(
        event({
          status: 'published',
          startsAt: '2020-10-04T16:00:00.000Z',
          endsAt: '2020-10-04T18:00:00.000Z',
        }),
        presentation,
      )
        .get('.vt-chip--state')
        .text(),
    ).toBe('Прошла')
  })
})
