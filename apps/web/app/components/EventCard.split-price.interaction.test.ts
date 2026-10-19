// @vitest-environment happy-dom
import { quoteEventPrice } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import EventCard, { type EventListItem } from './EventCard.vue'
import Chip from './vt/Chip.vue'
import Icon from './vt/Icon.vue'
import MyChip from './vt/MyChip.vue'
import SeatsMini from './vt/SeatsMini.vue'
import StateChip from './vt/StateChip.vue'

import { formatMoneyRu } from '~/utils/labels'

vi.stubGlobal('computed', computed)
afterEach(() => vi.unstubAllGlobals())

const money = (minor: number) => formatMoneyRu(minor, 'BYN')
// readEventPricing в фикстуре расходится с ответом цены: на карточке должна быть цена из ответа
const legacy = {
  mode: 'split',
  targetAmount: 10000,
  settledAt: null,
  participantCount: 5,
  minAmount: 1111,
  maxAmount: 1111,
  basis: 'current',
  myAllocatedAmount: null,
  myPaymentStatus: null,
} as const

function event(over: Partial<EventListItem> = {}): EventListItem {
  const taken = over.taken ?? 5
  return {
    id: 1,
    title: 'Сбор суммой',
    status: 'published',
    startsAt: '2099-10-04T16:00:00.000Z',
    endsAt: '2099-10-04T18:00:00.000Z',
    capacity: 16,
    price: 0,
    currency: 'BYN',
    taken,
    waitlist: 0,
    myBooking: null,
    venue: { name: 'Зал' },
    locationText: null,
    pricing: legacy,
    priceQuote: {
      ...quoteEventPrice({
        mode: 'split',
        targetAmount: 10000,
        capacity: 16,
        takenSeats: taken,
        mySeats: 0,
        seats: 1,
        settled: null,
      }),
      currency: 'BYN',
    },
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

describe.each(['card', 'schedule'] as const)(
  'EventCard %s: цена split из ответа GET …/price (20.4.6)',
  (presentation) => {
    it('прогноз «≈ …» и «от … до …» равны ответу цены, а не pricing', () => {
      const ev = event()
      const q = ev.priceQuote!
      const w = render(ev, presentation)
      expect(w.text()).toContain(`≈ ${money(q.perSeat.max)}`)
      expect(w.text()).toContain(`От ${money(q.perSeat.min)} до ${money(q.perSeat.max)}`)
      expect(w.text()).not.toContain(money(1111))
    })

    it('зафиксировано: моя доля из ответа цены, без «≈»', () => {
      const priceQuote = {
        ...quoteEventPrice({
          mode: 'split',
          targetAmount: 10000,
          capacity: 16,
          takenSeats: 3,
          mySeats: 1,
          seats: 1,
          settled: { participantCount: 3, myAllocatedAmount: 3334 },
        }),
        currency: 'BYN',
      }
      const w = render(
        event({
          priceQuote,
          pricing: { ...legacy, basis: 'settled', settledAt: '2099-10-04T10:00:00Z' },
          myBooking: { id: 1, status: 'confirmed' },
        }),
        presentation,
      )
      expect(w.text()).toContain(money(3334))
      expect(w.text()).not.toContain('≈')
      expect(w.text()).not.toContain(money(1111))
    })

    it('отменённое событие и недоступная цена — без числа', () => {
      expect(render(event({ status: 'cancelled' }), presentation).text()).not.toContain('≈')
      const w = render(event({ priceQuote: null }), presentation)
      expect(w.text()).not.toContain('≈')
      expect(w.text()).not.toContain(money(1111))
    })

    it('0 записавшихся: «≈ вся сумма, если запишетесь» (я один), игрок в очереди — «если получите место»', () => {
      const empty = render(event({ taken: 0 }), presentation)
      expect(empty.text()).toContain(`≈ ${money(10000)}, если запишетесь`)
      const queued = render(
        event({ taken: 16, myBooking: { id: 1, status: 'waitlisted' } }),
        presentation,
      )
      expect(queued.text()).toContain('если получите место')
      expect(queued.text()).not.toContain('если запишетесь')
    })

    it('без поля priceQuote (список событий) остаётся прежняя проекция pricing', () => {
      const ev = event()
      delete ev.priceQuote
      expect(render(ev, presentation).text()).toContain(money(1111))
    })
  },
)
