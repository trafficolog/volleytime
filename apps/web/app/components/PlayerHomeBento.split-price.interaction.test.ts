// @vitest-environment happy-dom
import { quoteEventPrice } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import type { EventListItem } from './EventCard.vue'
import PlayerHomeBento from './PlayerHomeBento.vue'
import Chip from './vt/Chip.vue'
import Icon from './vt/Icon.vue'
import MyChip from './vt/MyChip.vue'

import { formatMoneyRu } from '~/utils/labels'

vi.stubGlobal('computed', computed)
afterEach(() => vi.stubGlobal('computed', computed))

const money = (minor: number) => formatMoneyRu(minor, 'BYN')
const legacy = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 12,
  minAmount: 1111,
  maxAmount: 1111,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
} as const
const quote = (taken = 12, mySeats = 1) => ({
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
const hero = (over: Partial<EventListItem> = {}): EventListItem => ({
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
  pricing: legacy,
  priceQuote: quote(),
  ...over,
})
const mountBento = (h: EventListItem) =>
  mount(PlayerHomeBento, {
    props: {
      base: '/m/orgs/3',
      tz: 'Europe/Minsk',
      hero: h,
      sessions: null,
      bookingsCount: 1,
      awaitingPayment: 0,
    },
    global: {
      components: { VtIcon: Icon, VtMyChip: MyChip, VtChip: Chip },
      stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
    },
  })

describe('PlayerHomeBento hero: цена split из ответа GET …/price (20.4.6, 20.4.4)', () => {
  it('прогноз и диапазон равны ответу цены, а не pricing (readEventPricing)', () => {
    const h = hero()
    const q = h.priceQuote!
    const text = mountBento(h).text()
    expect(text).toContain(`≈ ${money(q.perSeat.max)}`)
    expect(text).toContain(`От ${money(q.perSeat.min)} до ${money(q.perSeat.max)}`)
    expect(text).not.toContain(money(1111))
  })

  it('зафиксировано: моя доля без «≈»', () => {
    const priceQuote = {
      ...quoteEventPrice({
        mode: 'split',
        targetAmount: 10000,
        capacity: 14,
        takenSeats: 3,
        mySeats: 1,
        seats: 1,
        settled: { participantCount: 3, myAllocatedAmount: 3334 },
      }),
      currency: 'BYN',
    }
    const text = mountBento(
      hero({
        status: 'closed',
        priceQuote,
        pricing: { ...legacy, basis: 'settled', settledAt: '2099-10-04T10:00:00Z' },
      }),
    ).text()
    expect(text).toContain(money(3334))
    expect(text).not.toContain('≈')
  })

  it('без расчёта — без числа, цена из pricing не подставляется', () => {
    const text = mountBento(hero({ priceQuote: null })).text()
    expect(text).not.toContain('≈')
    expect(text).not.toContain(money(1111))
  })
})
