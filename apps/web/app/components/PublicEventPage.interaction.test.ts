// @vitest-environment happy-dom
import { quoteEventPrice } from '@volley-time/shared'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'

import type { PublicEventPayload } from '~/utils/public-event'

import PublicEventPage from './PublicEventPage.vue'

const NOW = new Date('2026-05-28T10:00:00Z')
const payload = (over: Partial<PublicEventPayload['event']> = {}): PublicEventPayload => ({
  slug: '7a1b2c3d4e5f',
  event: {
    title: 'Открытая игра',
    description: null,
    status: 'published',
    startsAt: '2026-05-30T16:30:00.000Z',
    endsAt: '2026-05-30T19:00:00.000Z',
    place: { name: 'СК «Заслонова»', address: null },
    capacity: 14,
    taken: 9,
    players: 9,
    full: false,
    currency: 'BYN',
    joinMode: 'open',
    bookingOpensAt: null,
    ...over,
  },
  group: { name: 'VolleyTime Минск', city: 'Минск', timezone: 'Europe/Minsk', memberCount: 14 },
  price: {
    ...quoteEventPrice({ mode: 'fixed', price: 1500, seats: 1, subscriptionsEnabled: true }),
    currency: 'BYN',
  },
  roster: { initials: ['АИ', 'НП'], more: 7 },
  indexable: false,
  telegramUrl: 'https://t.me/volleytime_bot?start=event_5',
})

function render(data: PublicEventPayload) {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  return mount(PublicEventPage, {
    props: { data, now: NOW, linkLabel: 'volleytime.by/e/7a1b2c3d4e5f' },
    global: {
      stubs: { VtIcon: true, VtMeter: true },
      components: {
        NuxtLink: defineComponent({
          props: { to: { type: String, required: true } },
          setup:
            (props, { slots }) =>
            () =>
              h('a', { href: props.to }, slots.default?.()),
        }),
      },
    },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('PublicEventPage (20.6.1)', () => {
  it('shows facts, price, seats and a Telegram CTA; initials only', () => {
    const w = render(payload())
    expect(w.get('h1').text()).toBe('Открытая игра')
    expect(w.get('[data-testid=cta]').attributes('href')).toBe(
      'https://t.me/volleytime_bot?start=event_5',
    )
    expect(w.get('[data-testid=cta]').text()).toContain('Записаться через Telegram')
    expect(w.get('[data-testid=tile-price]').text()).toContain('15,00 BYN')
    expect(w.get('[data-testid=seats]').text()).toContain('9')
    expect(w.get('[data-testid=roster]').text()).toContain('и ещё 7')
    expect(w.find('[data-testid=split-explainer]').exists()).toBe(false)
    expect(w.html()).not.toMatch(/level|@|telegramUsername/i)
  })

  it('cancelled: no price tile, no price note about payment, no calendar button', () => {
    const data = payload({ status: 'cancelled' })
    data.price = null
    const w = render(data)
    expect(w.find('[data-testid=tile-price]').exists()).toBe(false)
    expect(w.get('[data-testid=status-chip]').text()).toBe('Событие отменено')
    expect(w.text()).not.toContain('В календарь')
  })

  it('full event offers the waitlist and says «мест нет»', () => {
    const w = render(payload({ taken: 14, players: 14, full: true }))
    expect(w.get('[data-testid=cta]').text()).toContain('В лист ожидания')
    expect(w.get('[data-testid=seats]').text()).toContain('мест нет')
  })

  it('without a configured bot there is no dead booking button', () => {
    const data = payload()
    data.telegramUrl = null
    expect(render(data).find('[data-testid=cta]').exists()).toBe(false)
  })
})
