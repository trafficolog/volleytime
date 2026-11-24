import {
  bookings,
  closeDb,
  db,
  eventSeries,
  events,
  organizations,
  payments,
  users,
  venues,
} from '@volley-time/db'
import type { ReportBreakdown } from '@volley-time/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ledgerService } from '../ledger/service'
import { organizationService } from '../organizations/service'

import { ReportBreakdownQuery } from './schemas'
import { reportsService } from './service'

/**
 * Task 30.3.4: отчёт «В разрезе» (W-19). Деньги сходятся с итогом периода кассы (те же записи,
 * та же валюта и дата операции), заполняемость — по правилам обзора; границы периода — в зоне группы.
 */
describe('reportsService.getBreakdown (integration)', { timeout: 60_000 }, () => {
  let owner: number
  let orgId: number
  let otherOrg: number
  let seq = 0

  const ctx = (userId: number) => ({ userId })
  const at = (iso: string) => new Date(iso)
  const MAY = { from: '2026-05-01', to: '2026-05-31' }
  const newUser = async (name: string | null, telegramUsername?: string) =>
    (
      await db
        .insert(users)
        .values({ email: `bd-${++seq}@t.by`, name, telegramUsername })
        .returning()
    )[0]!.id
  const insertEvent = async (
    startsAt: string,
    extra: Partial<typeof events.$inferInsert> = {},
    org = orgId,
  ) =>
    (
      await db
        .insert(events)
        .values({
          organizationId: org,
          createdByUserId: owner,
          title: 'E',
          startsAt: at(startsAt),
          endsAt: new Date(at(startsAt).getTime() + 7_200_000),
          capacity: 10,
          status: 'published',
          ...extra,
        })
        .returning()
    )[0]!
  const newVenue = async (name: string, org = orgId) =>
    (await db.insert(venues).values({ organizationId: org, name }).returning())[0]!.id
  const newSeries = async (title: string) =>
    (
      await db
        .insert(eventSeries)
        .values({
          organizationId: orgId,
          createdByUserId: owner,
          rule: { freq: 'weekly' },
          template: { title },
          timezone: 'Europe/Minsk',
        })
        .returning()
    )[0]!.id
  const book = (eventId: number, userId: number, status: 'confirmed' | 'attended', seats = 1) =>
    db
      .insert(bookings)
      .values({ eventId, userId, organizationId: orgId, status, method: 'free', seats })
  const entry = (
    type: 'income' | 'expense',
    amount: number,
    occurredAt: string,
    extra: {
      category?: 'rent' | 'coach' | 'other_income' | 'payment_income'
      eventId?: number
      paymentId?: number
      currency?: string
    } = {},
    org = orgId,
  ) =>
    ledgerService.createEntry(ctx(owner), {
      organizationId: org,
      type,
      category: extra.category ?? (type === 'income' ? 'other_income' : 'rent'),
      amount,
      occurredAt: at(occurredAt),
      ...(extra.eventId && { eventId: extra.eventId }),
      ...(extra.paymentId && { paymentId: extra.paymentId }),
      ...(extra.currency && { currency: extra.currency }),
    })
  const breakdown = (dimension: 'coach' | 'venue' | 'series', dates = MAY, org = orgId) =>
    reportsService.getBreakdown(ctx(owner), org, { dimension, ...dates })
  const sum = (r: ReportBreakdown, field: 'income' | 'rent' | 'events') =>
    r.rows.reduce((a, row) => a + row[field], 0)

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser('owner')
    orgId = (await organizationService.create(ctx(owner), { name: 'Разрез А' })).id
    const otherOwner = await newUser('owner-b')
    otherOrg = (await organizationService.create(ctx(otherOwner), { name: 'Разрез Б' })).id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('by venue', () => {
    it('gives games, occupancy, income and rent per venue; rows add up to the period totals', async () => {
      const hall = await newVenue('Школа №5')
      const gym = await newVenue('Спорткомплекс')
      const e1 = await insertEvent('2026-05-05T15:00:00Z', { venueId: hall, capacity: 10 })
      const e2 = await insertEvent('2026-05-12T15:00:00Z', { venueId: hall, capacity: 10 })
      const e3 = await insertEvent('2026-05-19T15:00:00Z', { venueId: gym, capacity: 20 })
      const p1 = await newUser('p1')
      const p2 = await newUser('p2')
      await book(e1.id, p1, 'attended', 3)
      await book(e2.id, p2, 'confirmed', 2)
      await book(e3.id, p1, 'attended', 5)
      await entry('income', 3_000, '2026-05-05T16:00:00Z', { eventId: e1.id })
      await entry('income', 1_500, '2026-05-12T16:00:00Z', { eventId: e2.id })
      await entry('income', 700, '2026-05-19T16:00:00Z', { eventId: e3.id })
      await entry('expense', 1_000, '2026-05-05T17:00:00Z', { eventId: e1.id })
      await entry('expense', 400, '2026-05-19T17:00:00Z', { eventId: e3.id })
      await entry('income', 250, '2026-05-20T10:00:00Z') // без события
      await entry('expense', 90, '2026-05-21T10:00:00Z') // аренда без события

      const r = await breakdown('venue')
      expect(r.dimension).toBe('venue')
      expect(r.currency).toBe('BYN')
      expect(r.rows).toEqual([
        {
          key: hall,
          label: 'Школа №5',
          events: 2,
          seats: 5,
          capacity: 20,
          percent: 25,
          income: 4_500,
          rent: 1_000,
        },
        {
          key: gym,
          label: 'Спорткомплекс',
          events: 1,
          seats: 5,
          capacity: 20,
          percent: 25,
          income: 700,
          rent: 400,
        },
        {
          key: null,
          label: null,
          events: 0,
          seats: 0,
          capacity: 0,
          percent: null,
          income: 250,
          rent: 90,
        },
      ])
      const cash = await ledgerService.getPeriodTotals(ctx(owner), orgId, {
        from: at('2026-04-30T21:00:00Z'),
        to: at('2026-05-31T21:00:00Z'),
      })
      expect(sum(r, 'income')).toBe(cash.income)
      expect(r.totals).toMatchObject({
        events: 3,
        seats: 10,
        capacity: 40,
        percent: 25,
        income: cash.income,
        rent: 1_490,
      })
    })

    it('groups events without a venue in the not-set row', async () => {
      const e = await insertEvent('2026-05-05T15:00:00Z', { venueId: null })
      await entry('income', 800, '2026-05-05T16:00:00Z', { eventId: e.id })
      const r = await breakdown('venue')
      expect(r.rows).toEqual([
        expect.objectContaining({ key: null, label: null, events: 1, income: 800 }),
      ])
    })

    it('skips drafts and cancelled events but keeps their money attributed', async () => {
      const hall = await newVenue('Зал')
      const cancelled = await insertEvent('2026-05-05T15:00:00Z', {
        venueId: hall,
        status: 'cancelled',
      })
      await insertEvent('2026-05-06T15:00:00Z', { venueId: hall, status: 'draft' })
      await entry('income', 500, '2026-05-05T16:00:00Z', { eventId: cancelled.id })
      const r = await breakdown('venue')
      expect(r.rows).toEqual([
        expect.objectContaining({ key: hall, events: 0, capacity: 0, percent: null, income: 500 }),
      ])
      expect(r.totals.events).toBe(0)
    })
  })

  describe('money rules', () => {
    it('attributes payment income to the event of the booking, period by operation date', async () => {
      const hall = await newVenue('Зал')
      const inMay = await insertEvent('2026-05-30T15:00:00Z', { venueId: hall })
      const player = await newUser('pl')
      const [booking] = await book(inMay.id, player, 'attended').returning()
      const [payment] = await db
        .insert(payments)
        .values({
          organizationId: orgId,
          userId: player,
          bookingId: booking!.id,
          amount: 1_200,
          method: 'cash',
          status: 'succeeded',
        })
        .returning()
      await entry('income', 1_200, '2026-05-30T16:00:00Z', {
        category: 'payment_income',
        paymentId: payment!.id,
      })
      // событие июня, оплата внесена в мае: деньги в мае, игры — нет
      const june = await insertEvent('2026-06-02T15:00:00Z', { venueId: hall })
      await entry('income', 300, '2026-05-31T10:00:00Z', { eventId: june.id })
      const r = await breakdown('venue')
      expect(r.rows).toEqual([
        expect.objectContaining({ key: hall, events: 1, income: 1_500, rent: 0 }),
      ])
    })

    it('counts only the group currency and only rent expenses in the rent column', async () => {
      const hall = await newVenue('Зал')
      const e = await insertEvent('2026-05-05T15:00:00Z', { venueId: hall })
      await entry('expense', 600, '2026-05-05T17:00:00Z', { eventId: e.id })
      await entry('expense', 777, '2026-05-05T17:00:00Z', { eventId: e.id, category: 'coach' })
      await entry('income', 9_999, '2026-05-05T17:00:00Z', { eventId: e.id, currency: 'USD' })
      await entry('expense', 5_555, '2026-05-05T17:00:00Z', { eventId: e.id, currency: 'USD' })
      const r = await breakdown('venue')
      expect(r.rows).toEqual([expect.objectContaining({ key: hall, income: 0, rent: 600 })])
      expect(r.totals).toMatchObject({ income: 0, rent: 600 })
    })

    it('does not leak another group events or ledger into the report', async () => {
      const foreignVenue = await newVenue('Чужой', otherOrg)
      const foreign = await insertEvent('2026-05-05T15:00:00Z', { venueId: foreignVenue }, otherOrg)
      await entry('income', 4_000, '2026-05-05T16:00:00Z', { eventId: foreign.id }, otherOrg)
      const r = await breakdown('venue')
      expect(r.rows).toEqual([])
      expect(r.totals).toMatchObject({ events: 0, income: 0, rent: 0 })
    })

    it('puts period boundaries in the group time zone', async () => {
      await entry('income', 100, '2026-04-30T20:59:59Z') // 30 апр 23:59:59 по Минску
      await entry('income', 200, '2026-04-30T21:00:00Z') // 1 мая 00:00:00
      await entry('income', 800, '2026-05-31T21:00:00Z') // 1 июня 00:00:00
      const r = await breakdown('venue')
      expect(r.totals.income).toBe(200)
    })
  })

  describe('by series', () => {
    it('groups by series title and puts one-off events in the not-set row', async () => {
      const base = await newSeries('Основа')
      const mixed = await newSeries('Микст')
      const a = await insertEvent('2026-05-05T15:00:00Z', {
        seriesId: base,
        seriesDate: '2026-05-05',
      })
      const b = await insertEvent('2026-05-12T15:00:00Z', {
        seriesId: base,
        seriesDate: '2026-05-12',
      })
      const c = await insertEvent('2026-05-10T15:00:00Z', {
        seriesId: mixed,
        seriesDate: '2026-05-10',
      })
      const one = await insertEvent('2026-05-15T15:00:00Z')
      await entry('income', 1_000, '2026-05-05T16:00:00Z', { eventId: a.id })
      await entry('income', 2_000, '2026-05-12T16:00:00Z', { eventId: b.id })
      await entry('income', 500, '2026-05-10T16:00:00Z', { eventId: c.id })
      await entry('income', 100, '2026-05-15T16:00:00Z', { eventId: one.id })
      const r = await breakdown('series')
      expect(r.rows.map((x) => [x.label, x.events, x.income])).toEqual([
        ['Основа', 2, 3_000],
        ['Микст', 1, 500],
        [null, 1, 100],
      ])
      expect(sum(r, 'income')).toBe(3_600)
    })
  })

  describe('by coach', () => {
    it('splits money of a multi-coach event exactly, counts it once in the totals', async () => {
      const anna = await newUser('Анна')
      const boris = await newUser(null, 'boris_v')
      const e = await insertEvent('2026-05-05T15:00:00Z', {
        coachUserIds: [boris, anna],
        capacity: 10,
      })
      const solo = await insertEvent('2026-05-06T15:00:00Z', { coachUserIds: [anna] })
      const none = await insertEvent('2026-05-07T15:00:00Z')
      await book(e.id, anna, 'attended', 4)
      await entry('income', 1_001, '2026-05-05T16:00:00Z', { eventId: e.id })
      await entry('expense', 101, '2026-05-05T17:00:00Z', { eventId: e.id })
      await entry('income', 50, '2026-05-06T16:00:00Z', { eventId: solo.id })
      await entry('income', 7, '2026-05-07T16:00:00Z', { eventId: none.id })

      const r = await breakdown('coach')
      const byKey = new Map(r.rows.map((x) => [x.key, x]))
      // остаток копейки — тренеру с меньшим id (Анна создана раньше), сумма строк равна кассе
      expect(byKey.get(anna)).toMatchObject({
        label: 'Анна',
        events: 2,
        seats: 4,
        capacity: 20,
        income: 501 + 50,
        rent: 51,
      })
      expect(byKey.get(boris)).toMatchObject({
        label: '@boris_v',
        events: 1,
        capacity: 10,
        income: 500,
        rent: 50,
      })
      expect(byKey.get(null)).toMatchObject({ events: 1, income: 7 })
      expect(r.rows.at(-1)!.key).toBeNull()
      expect(sum(r, 'income')).toBe(1_058)
      expect(sum(r, 'rent')).toBe(101)
      expect(r.totals).toMatchObject({ events: 3, income: 1_058, rent: 101 })
    })
  })

  describe('query schema', () => {
    it('requires a known dimension and a valid period', () => {
      const ok = { dimension: 'coach', from: '2026-05-01', to: '2026-05-31' }
      expect(ReportBreakdownQuery.safeParse(ok).success).toBe(true)
      expect(ReportBreakdownQuery.safeParse({ ...ok, dimension: 'type' }).success).toBe(false)
      expect(
        ReportBreakdownQuery.safeParse({ ...ok, from: '2026-05-31', to: '2026-05-01' }).success,
      ).toBe(false)
    })
  })
})
