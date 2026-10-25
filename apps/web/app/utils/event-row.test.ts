import { describe, expect, it } from 'vitest'

import {
  chatLinkStateOf,
  duplicateEventBody,
  paymentsCellOf,
  rowMenuItems,
  shiftWeek,
} from './event-row'

import type { EventListItem } from '~/components/EventCard.vue'

const base: EventListItem = {
  id: 1,
  title: 'Основа',
  status: 'published',
  startsAt: '2026-05-28T17:00:00.000Z',
  endsAt: '2026-05-28T19:00:00.000Z',
  capacity: 14,
  price: 1500,
  currency: 'BYN',
  taken: 3,
  waitlist: 0,
  myBooking: null,
  venue: { name: 'Школа №24' },
  locationText: null,
}
const quote = (basis: 'forecast' | 'settled', max: number) =>
  ({
    mode: 'split',
    basis,
    seats: 1,
    perSeat: { min: max - 1, max },
    total: { min: max - 1, max },
    seatCount: { current: 3, max: 14 },
    targetAmount: 10001,
    subscriptionApplicable: false,
    currency: 'BYN',
  }) as const
const now = new Date('2026-05-20T09:00:00Z')

describe('paymentsCellOf (W-03 «Оплаты»)', () => {
  it('shows paid and pending separately, pending is never part of paid', () => {
    const cell = paymentsCellOf({
      ...base,
      paymentTotals: { paid: 3000, pending: 1500, currency: 'BYN' },
    })
    expect(cell.paid).toBe('30,00 BYN')
    expect(cell.pending).toBe('+15,00 BYN')
    expect(cell.share).toBeNull()
  })

  it('omits the pending part at zero and shows zero paid on a paid event', () => {
    const cell = paymentsCellOf({
      ...base,
      paymentTotals: { paid: 0, pending: 0, currency: 'BYN' },
    })
    expect(cell).toEqual({ paid: '0,00 BYN', pending: null, share: null })
  })

  it('has no amounts for a free event without payments, and for a payload without totals', () => {
    expect(
      paymentsCellOf({
        ...base,
        price: 0,
        paymentTotals: { paid: 0, pending: 0, currency: 'BYN' },
      }),
    ).toEqual({ paid: null, pending: null, share: null })
    expect(paymentsCellOf(base)).toEqual({ paid: null, pending: null, share: null })
  })

  it('split: «≈» before closing, exact share after, nothing for a cancelled event', () => {
    const split = { ...base, price: 0, priceMode: 'split' as const }
    expect(paymentsCellOf({ ...split, splitShareQuote: quote('forecast', 3334) }).share).toBe(
      '≈ 33,34 BYN за место',
    )
    expect(paymentsCellOf({ ...split, splitShareQuote: quote('settled', 3334) }).share).toBe(
      '33,34 BYN за место',
    )
    expect(
      paymentsCellOf({ ...split, status: 'cancelled', splitShareQuote: quote('forecast', 3334) })
        .share,
    ).toBeNull()
    expect(paymentsCellOf({ ...split, splitShareQuote: null }).share).toBeNull()
  })
})

describe('rowMenuItems', () => {
  it('lists the four actions with the danger one separated', () => {
    const items = rowMenuItems(base, { kind: 'active' }, now)
    expect(items.map((i) => i.key)).toEqual(['open', 'duplicate', 'announce', 'cancel'])
    expect(items.map((i) => i.label)).toEqual([
      'Открыть событие',
      'Дублировать',
      'В чат группы',
      'Отменить событие',
    ])
    expect(items[3]).toMatchObject({ tone: 'danger', separator: true })
    expect(items.every((i) => !i.disabled)).toBe(true)
  })

  it.each([
    [{ kind: 'none' as const }, 'не привязан'],
    [{ kind: 'invalid' as const, reason: 'no_rights' }, 'права'],
    [{ kind: 'invalid' as const, reason: 'migrated' }, 'перенесён'],
    [{ kind: 'error' as const }, 'проверить'],
    [{ kind: 'unknown' as const }, 'Проверяем'],
  ])('disables «В чат группы» with a hint when the chat is %j', (chat, hint) => {
    const item = rowMenuItems(base, chat, now).find((i) => i.key === 'announce')!
    expect(item.disabled).toBe(true)
    expect(item.hint).toContain(hint)
  })

  it('disables the announcement for draft, started and cancelled events; no cancel item for cancelled', () => {
    for (const event of [
      { ...base, status: 'draft' },
      { ...base, startsAt: '2026-05-19T17:00:00Z' },
      { ...base, status: 'cancelled' },
    ]) {
      const item = rowMenuItems(event, { kind: 'active' }, now).find((i) => i.key === 'announce')!
      expect(item.disabled).toBe(true)
      expect(item.hint).toContain('будущего')
    }
    expect(
      rowMenuItems({ ...base, status: 'cancelled' }, { kind: 'active' }, now).map((i) => i.key),
    ).not.toContain('cancel')
  })
})

describe('chatLinkStateOf', () => {
  it('maps GET …/telegram-chat to the menu state', () => {
    expect(chatLinkStateOf(null)).toEqual({ kind: 'error' })
    expect(chatLinkStateOf({ link: null })).toEqual({ kind: 'none' })
    expect(chatLinkStateOf({ link: { status: 'active' } })).toEqual({ kind: 'active' })
    expect(chatLinkStateOf({ link: { status: 'invalid', invalidReason: 'migrated' } })).toEqual({
      kind: 'invalid',
      reason: 'migrated',
    })
  })
})

describe('duplicate', () => {
  it('moves the date by +7 days keeping the local time', () => {
    expect(shiftWeek('2026-05-28T17:00:00.000Z', 'Europe/Minsk')).toBe('2026-06-04T17:00:00.000Z')
  })

  it('keeps the local time over a DST change of the zone', () => {
    // Europe/Berlin: 2026-03-25 20:00 CET (+1) → 2026-04-01 20:00 CEST (+2)
    expect(shiftWeek('2026-03-25T19:00:00.000Z', 'Europe/Berlin')).toBe('2026-04-01T18:00:00.000Z')
  })

  it('copies the fields into a draft body', () => {
    const body = duplicateEventBody(
      {
        ...base,
        type: 'training',
        description: 'Берите форму',
        venueId: 7,
        priceMode: 'fixed',
        targetAmount: null,
        level: 'C',
        joinMode: 'invite',
        closeBeforeMinutes: 60,
      },
      'Europe/Minsk',
    )
    expect(body).toEqual({
      type: 'training',
      title: 'Основа',
      description: 'Берите форму',
      venueId: 7,
      startsAt: '2026-06-04T17:00:00.000Z',
      endsAt: '2026-06-04T19:00:00.000Z',
      capacity: 14,
      priceMode: 'fixed',
      price: 1500,
      level: 'C',
      joinMode: 'invite',
      closeBeforeMinutes: 60,
      status: 'draft',
    })
  })

  it('carries the split target and no extra fields for a minimal row', () => {
    expect(
      duplicateEventBody({ ...base, price: 0, priceMode: 'split', targetAmount: 10001 }, 'UTC'),
    ).toMatchObject({ priceMode: 'split', price: 0, targetAmount: 10001, status: 'draft' })
    expect(Object.keys(duplicateEventBody(base, 'UTC')).sort()).toEqual([
      'capacity',
      'endsAt',
      'price',
      'startsAt',
      'status',
      'title',
    ])
  })
})
