// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { EventListItem } from './EventCard.vue'
import PlayerHomeBento from './PlayerHomeBento.vue'
import Icon from './vt/Icon.vue'
import Chip from './vt/Chip.vue'
import MyChip from './vt/MyChip.vue'

vi.stubGlobal('computed', computed)
afterEach(() => vi.stubGlobal('computed', computed))

const hero: EventListItem = {
  id: 7,
  title: 'Основа',
  status: 'published',
  startsAt: '2099-10-04T17:00:00.000Z',
  endsAt: '2099-10-04T19:00:00.000Z',
  capacity: 14,
  price: 0,
  currency: 'BYN',
  taken: 12,
  waitlist: 0,
  myBooking: { id: 1, status: 'confirmed' },
  venue: { name: 'Школа №24' },
  locationText: null,
}

function mountBento(props: Record<string, unknown> = {}) {
  return mount(PlayerHomeBento, {
    props: {
      base: '/m/orgs/3',
      tz: 'Europe/Minsk',
      hero,
      sessions: { kind: 'balance', left: 5, total: 8 },
      bookingsCount: 3,
      awaitingPayment: 0,
      ...props,
    },
    global: {
      components: { VtIcon: Icon, VtMyChip: MyChip, VtChip: Chip },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })
}

describe('PlayerHomeBento (20.4.4)', () => {
  it('renders the hero with the going chip, venue and a seat meter with count', () => {
    const w = mountBento()
    const link = w.get('a[href="/m/orgs/3/events/7"]')
    expect(link.classes()).toContain('vt-card--hero')
    expect(link.text()).toContain('Основа')
    expect(link.text()).toContain('Школа №24')
    expect(link.text()).toContain('Иду')
    expect(link.text()).toContain('12/14')
    // шкала декоративна: занятость читается из цифры, дубля role=meter внутри ссылки нет
    expect(link.get('[data-seats-meter]').attributes('aria-hidden')).toBe('true')
    expect(link.find('[role="meter"]').exists()).toBe(false)
  })

  it('says «мест нет» on a full hero and the event state when registration is closed', () => {
    expect(mountBento({ hero: { ...hero, taken: 14 } }).text()).toContain('мест нет')
    expect(mountBento({ hero: { ...hero, status: 'closed' } }).text()).toContain('Запись закрыта')
  })

  it('links the sessions tile to subscriptions and the bookings tile to bookings', () => {
    const w = mountBento()
    const subs = w.get('a[href="/m/orgs/3/subscriptions"]')
    expect(subs.classes()).toContain('vt-card--warm')
    expect(subs.text()).toContain('5')
    expect(subs.text()).toContain('из 8')
    expect(subs.text()).toContain('сессий осталось')
    const bookings = w.get('a[href="/m/orgs/3/bookings"]')
    expect(bookings.text()).toContain('3')
    expect(bookings.text()).toContain('мои записи')
  })

  it('shows the no-subscription state, or drops the tile and widens bookings', () => {
    const none = mountBento({ sessions: { kind: 'none' } })
    expect(none.get('a[href="/m/orgs/3/subscriptions"]').text()).toContain('Нет абонемента')
    const hidden = mountBento({ sessions: null })
    expect(hidden.find('a[href="/m/orgs/3/subscriptions"]').exists()).toBe(false)
    expect(hidden.get('a[href="/m/orgs/3/bookings"]').classes()).toContain('row-span-2')
  })

  it('shows an exact count and an awaiting-payment marker only when something awaits payment', () => {
    const none = mountBento({ bookingsCount: 7 })
    expect(none.get('a[href="/m/orgs/3/bookings"]').text()).toContain('7')
    expect(none.find('[data-awaiting-payment]').exists()).toBe(false)
    const some = mountBento({ bookingsCount: 7, awaitingPayment: 2 })
    const marker = some.get('a[href="/m/orgs/3/bookings"] [data-awaiting-payment]')
    expect(marker.text()).toBe('2 ждут оплаты')
  })

  it('has no going chip for a hero the player has not joined', () => {
    expect(mountBento({ hero: { ...hero, myBooking: null } }).text()).not.toContain('Иду')
  })
})
