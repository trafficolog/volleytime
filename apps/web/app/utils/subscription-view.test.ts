import { describe, expect, it } from 'vitest'

import {
  recentSubscriptionUsage,
  subscriptionDaysLeft,
  subscriptionPeriodLabel,
  subscriptionPerSession,
} from './subscription-view'

const tz = 'Europe/Minsk'

describe('subscriptionDaysLeft', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  it('округляет вверх до целых суток', () => {
    expect(subscriptionDaysLeft('2026-11-06T12:00:00Z', now)).toBe(18)
    expect(subscriptionDaysLeft('2026-10-19T12:30:00Z', now)).toBe(1)
  })
  it('бессрочный и истёкший не дают срока', () => {
    expect(subscriptionDaysLeft(null, now)).toBeNull()
    expect(subscriptionDaysLeft('2026-10-19T11:00:00Z', now)).toBeNull()
  })
})

describe('subscriptionPeriodLabel', () => {
  it('«11 апр — 5 мая» по часовому поясу группы: от активации до срока (истёк)', () => {
    expect(
      subscriptionPeriodLabel(
        {
          status: 'expired',
          purchasedAt: '2026-04-01T10:00:00Z',
          activatedAt: '2026-04-11T10:00:00Z',
          expiresAt: '2026-05-05T10:00:00Z',
          updatedAt: '2026-05-06T00:00:00Z',
        },
        tz,
      ),
    ).toBe('11 апр. — 5 мая')
  })
  it('использованный — до последнего изменения, без активации — от покупки', () => {
    expect(
      subscriptionPeriodLabel(
        {
          status: 'exhausted',
          purchasedAt: '2026-04-01T10:00:00Z',
          activatedAt: null,
          expiresAt: null,
          updatedAt: '2026-04-20T10:00:00Z',
        },
        tz,
      ),
    ).toBe('1 апр. — 20 апр.')
  })
})

describe('subscriptionPerSession', () => {
  it('цена за занятие в минорных единицах, округление к ближайшему', () => {
    expect(subscriptionPerSession(11000, 8)).toBe(1375)
    expect(subscriptionPerSession(15000, 12)).toBe(1250)
    expect(subscriptionPerSession(1000, 3)).toBe(333)
  })
  it('без занятий или бесплатный — null', () => {
    expect(subscriptionPerSession(0, 8)).toBeNull()
    expect(subscriptionPerSession(1000, 0)).toBeNull()
  })
})

describe('recentSubscriptionUsage', () => {
  const sub = (id: number, usage: { bookingId: number; startsAt: string }[]) => ({
    id,
    usage: usage.map((u) => ({ ...u, status: 'attended', eventTitle: `Игра ${u.bookingId}` })),
  })
  it('собирает списания всех абонементов, новые сверху, ограничивает число', () => {
    const rows = recentSubscriptionUsage(
      [
        sub(1, [
          { bookingId: 1, startsAt: '2026-05-21T10:00:00Z' },
          { bookingId: 2, startsAt: '2026-05-25T10:00:00Z' },
        ]),
        sub(2, [{ bookingId: 3, startsAt: '2026-05-23T10:00:00Z' }]),
      ],
      2,
    )
    expect(rows.map((r) => r.bookingId)).toEqual([2, 3])
  })
})
