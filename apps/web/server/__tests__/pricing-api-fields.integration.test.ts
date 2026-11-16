import {
  bookingService,
  eventPricingService,
  eventService,
  memberService,
  organizationService,
  planService,
  subscriptionService,
} from '@volley-time/core'
import { bookings, closeDb, db, eq, events, organizations, payments, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 21.5.10: поля `priceForecast` и `myShare` рядом с проекцией `pricing` во всех ответах, где она
 * есть (`events`, `events/{id}`, `bookings/my`, `dashboard` myBookings/hero/upcoming). Паритет: каждое
 * новое поле равно тому, что сейчас даёт `pricing`, для игрока и управляющего; IDOR: `myShare` —
 * только своя запись вызывающего.
 */
type Pricing = {
  participantCount: number
  minAmount: number
  maxAmount: number
  basis: string
  myAllocatedAmount: number | null
  myPaymentStatus: string | null
}
type View = {
  id?: number
  eventId?: number
  event?: { id: number }
  pricing: Pricing
  priceForecast: Omit<Pricing, 'myAllocatedAmount' | 'myPaymentStatus'>
  myShare: { allocatedAmount: number | null; paymentStatus: string | null } | null
}

describe('event pricing API fields (21.5.10)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let players: number[]
  let orgId: number
  let otherOrgId: number
  let outsiderId: number

  const at = (h: number) => new Date(Date.now() + h * 3600_000)
  const split = (o: Record<string, unknown> = {}) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Split',
      startsAt: at(24),
      endsAt: at(26),
      capacity: 3,
      priceMode: 'split',
      targetAmount: 10000,
      ...o,
    })
  const fixed = (price: number) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Fixed',
      startsAt: at(30),
      endsAt: at(32),
      capacity: 4,
      price,
    })
  const book = (user: number, eventId: number, input: Record<string, unknown> = {}) =>
    bookingService.book({ userId: user }, orgId, eventId, { method: 'cash', ...input })
  const get = async <T>(user: number, path: string) => {
    const res = await request('GET', `/api/organizations/${orgId}${path}`, { user })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body as T
  }

  /** Все представления события `eventId` для `user` во всех маршрутах с проекцией `pricing`. */
  const views = async (user: number, eventId: number) => {
    const out: { where: string; view: View }[] = []
    const list = await get<{ events: (View & { id: number })[] }>(user, '/events')
    for (const v of list.events.filter((e) => e.id === eventId))
      out.push({ where: 'events', view: v })
    const one = await get<{ event: View }>(user, `/events/${eventId}`)
    out.push({ where: 'events/{id}', view: one.event })
    const mine = await get<{ bookings: View[] }>(user, '/bookings/my?filter=all')
    for (const v of mine.bookings.filter((b) => b.eventId === eventId))
      out.push({ where: 'bookings/my', view: v })
    const dash = await get<{ myBookings: View[]; hero: View | null; upcoming: View[] }>(
      user,
      '/dashboard',
    )
    for (const v of dash.myBookings.filter((b) => b.event!.id === eventId))
      out.push({ where: 'dashboard.myBookings', view: v })
    if (dash.hero?.id === eventId) out.push({ where: 'dashboard.hero', view: dash.hero })
    for (const v of dash.upcoming.filter((e) => e.id === eventId))
      out.push({ where: 'dashboard.upcoming', view: v })
    return out
  }

  /** Паритет новых полей с `pricing` во всех ответах + ожидаемые числа; возвращает места проверки. */
  const expectParity = async (
    user: number,
    eventId: number,
    expected: {
      forecast: View['priceForecast']
      share: View['myShare']
    },
  ) => {
    const all = await views(user, eventId)
    for (const { where, view } of all) {
      const p = view.pricing
      expect(view.priceForecast, where).toEqual({
        participantCount: p.participantCount,
        minAmount: p.minAmount,
        maxAmount: p.maxAmount,
        basis: p.basis,
      })
      expect(view.myShare?.allocatedAmount ?? null, where).toBe(p.myAllocatedAmount)
      expect(view.myShare?.paymentStatus ?? null, where).toBe(p.myPaymentStatus)
      expect(view.priceForecast, where).toEqual(expected.forecast)
      expect(view.myShare, where).toEqual(expected.share)
    }
    return all.map((v) => v.where)
  }

  const setPayments = (
    bookingId: number,
    status: 'pending' | 'succeeded' | 'cancelled' | 'refunded',
  ) => db.update(payments).set({ status }).where(eq(payments.bookingId, bookingId))

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    const people = await db
      .insert(users)
      .values(
        Array.from({ length: 6 }, (_, i) => ({ email: `fields-${crypto.randomUUID()}-${i}@t.by` })),
      )
      .returning()
    ownerId = people[0]!.id
    players = people.slice(1, 5).map((p) => p.id)
    outsiderId = people[5]!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Fields' })).id
    otherOrgId = (await organizationService.create({ userId: outsiderId }, { name: 'Other' })).id
    await db.update(organizations).set({ maxSeatsPerBooking: 3 }).where(eq(organizations.id, orgId))
    for (const userId of players)
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId })
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(organizations).where(eq(organizations.id, otherOrgId))
  })
  afterAll(async () => {
    await closeDb()
  })

  it('split forecast on capacity basis (no bookings): same for player and manager, no share', async () => {
    const ev = await split()
    const forecast = { participantCount: 3, minAmount: 3333, maxAmount: 3334, basis: 'capacity' }
    expect(await expectParity(players[0]!, ev.id, { forecast, share: null })).toEqual(
      expect.arrayContaining(['events', 'events/{id}', 'dashboard.upcoming']),
    )
    expect(await expectParity(ownerId, ev.id, { forecast, share: null })).toEqual(
      expect.arrayContaining(['events', 'events/{id}', 'dashboard.upcoming']),
    )
  })

  it('split forecast on current basis with multi-seat booking: no live payments before settlement', async () => {
    const ev = await split({ capacity: 6, targetAmount: 10001 })
    await book(players[0]!, ev.id, { seats: 2 })
    await book(players[1]!, ev.id)
    // 3 места из 6: 10001 / 3 = 3333,67 — округление копеек вверх для max
    const forecast = { participantCount: 3, minAmount: 3333, maxAmount: 3334, basis: 'current' }
    const routes = await expectParity(players[0]!, ev.id, {
      forecast,
      share: { allocatedAmount: null, paymentStatus: null },
    })
    expect(routes).toEqual(
      expect.arrayContaining([
        'events',
        'events/{id}',
        'bookings/my',
        'dashboard.myBookings',
        'dashboard.hero',
        'dashboard.upcoming',
      ]),
    )
    // управляющий без своей записи: прогноз тот же, доли нет
    await expectParity(ownerId, ev.id, { forecast, share: null })
  })

  it('split overbooked after capacity reduction is clamped to capacity, as pricing', async () => {
    const ev = await split({ capacity: 4 })
    for (const p of players) await book(p, ev.id)
    await db.update(events).set({ capacity: 2 }).where(eq(events.id, ev.id))
    const forecast = { participantCount: 2, minAmount: 5000, maxAmount: 5000, basis: 'current' }
    await expectParity(players[0]!, ev.id, {
      forecast,
      share: { allocatedAmount: null, paymentStatus: null },
    })
    await expectParity(ownerId, ev.id, { forecast, share: null })
  })

  it('split settled: snapshot range, allocated share with remainder cent, cancelled and no_show bookings keep their share', async () => {
    const ev = await split()
    const a = await book(players[0]!, ev.id)
    const b = await book(players[1]!, ev.id)
    const c = await book(players[2]!, ev.id)
    await eventPricingService.settle({ userId: ownerId }, orgId, ev.id)
    const forecast = { participantCount: 3, minAmount: 3333, maxAmount: 3334, basis: 'settled' }
    const shareOf = async (id: number) =>
      (await db.query.bookings.findFirst({ where: eq(bookings.id, id) }))!.allocatedAmount
    expect([await shareOf(a.id), await shareOf(b.id), await shareOf(c.id)]).toEqual([
      3334, 3333, 3333,
    ])
    await expectParity(players[0]!, ev.id, {
      forecast,
      share: { allocatedAmount: 3334, paymentStatus: 'pending' },
    })
    // только cancelled платежи: pricing отдаёт null — новое поле тоже null
    await setPayments(a.id, 'cancelled')
    await expectParity(players[0]!, ev.id, {
      forecast,
      share: { allocatedAmount: 3334, paymentStatus: null },
    })
    await setPayments(b.id, 'succeeded')
    await expectParity(players[1]!, ev.id, {
      forecast,
      share: { allocatedAmount: 3333, paymentStatus: 'succeeded' },
    })
    // неактивные записи: доля остаётся видна только своему игроку
    await db.update(bookings).set({ status: 'no_show' }).where(eq(bookings.id, c.id))
    await expectParity(players[2]!, ev.id, {
      forecast,
      share: { allocatedAmount: 3333, paymentStatus: 'pending' },
    })
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, b.id))
    await setPayments(b.id, 'refunded')
    await expectParity(players[1]!, ev.id, {
      forecast,
      share: { allocatedAmount: 3333, paymentStatus: null },
    })
    await expectParity(ownerId, ev.id, { forecast, share: null })
  })

  it('fixed and free events: forecast is the event price for player and manager', async () => {
    const paid = await fixed(1500)
    const mine = await book(players[0]!, paid.id, { seats: 2 })
    const forecast = { participantCount: 2, minAmount: 1500, maxAmount: 1500, basis: 'fixed' }
    await expectParity(players[0]!, paid.id, {
      forecast,
      share: { allocatedAmount: null, paymentStatus: 'pending' },
    })
    await setPayments(mine.id, 'succeeded')
    await expectParity(players[0]!, paid.id, {
      forecast,
      share: { allocatedAmount: null, paymentStatus: 'succeeded' },
    })
    await expectParity(ownerId, paid.id, { forecast, share: null })

    const free = await fixed(0)
    await book(players[1]!, free.id, { method: 'free' })
    const freeForecast = { participantCount: 1, minAmount: 0, maxAmount: 0, basis: 'fixed' }
    await expectParity(players[1]!, free.id, {
      forecast: freeForecast,
      share: { allocatedAmount: null, paymentStatus: null },
    })
    await expectParity(ownerId, free.id, { forecast: freeForecast, share: null })
  })

  it('subscription booking on a fixed event: no payment status, same as pricing', async () => {
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Plan', totalSessions: 4, price: 4000 },
    )
    const sub = await subscriptionService.createFromPlan({ userId: players[0]! }, orgId, plan.id, {
      autoActivate: true,
    })
    const ev = await fixed(1500)
    await book(players[0]!, ev.id, { method: 'subscription', subscriptionId: sub.id })
    const forecast = { participantCount: 1, minAmount: 1500, maxAmount: 1500, basis: 'fixed' }
    await expectParity(players[0]!, ev.id, {
      forecast,
      share: { allocatedAmount: null, paymentStatus: null },
    })
    await expectParity(ownerId, ev.id, { forecast, share: null })
  })

  it('IDOR: myShare is only the caller own booking; another group cannot read the event', async () => {
    const ev = await split()
    const a = await book(players[0]!, ev.id)
    await book(players[1]!, ev.id)
    await eventPricingService.settle({ userId: ownerId }, orgId, ev.id)
    await setPayments(a.id, 'succeeded')
    // игрок 2: своя доля и свой статус (pending), не доля/статус игрока 1
    for (const { where, view } of await views(players[1]!, ev.id))
      expect(view.myShare, where).toEqual({ allocatedAmount: 5000, paymentStatus: 'pending' })
    // игрок 3 без записи и управляющий: доли нет ни в одном ответе
    for (const user of [players[2]!, ownerId])
      for (const { where, view } of await views(user, ev.id)) expect(view.myShare, where).toBeNull()
    // ответы игрока не содержат ничьих сумм, кроме своей
    const raw = JSON.stringify(await get(players[2]!, `/events/${ev.id}`))
    expect(raw).not.toContain('"allocatedAmount":5000')
    // участник другой группы: событие недоступно
    const foreign = await request('GET', `/api/organizations/${orgId}/events/${ev.id}`, {
      user: outsiderId,
    })
    expect([403, 404]).toContain(foreign.status)
    expect(JSON.stringify(foreign.body)).not.toContain('myShare')
    // событие чужой группы по маршруту своей: 404, без полей
    const theirs = await eventService.create({ userId: outsiderId }, otherOrgId, {
      title: 'Theirs',
      startsAt: at(24),
      endsAt: at(26),
      capacity: 3,
      price: 1000,
    })
    const cross = await request('GET', `/api/organizations/${orgId}/events/${theirs.id}`, {
      user: players[0]!,
    })
    expect(cross.status).toBe(404)
    expect(JSON.stringify(cross.body)).not.toContain('priceForecast')
  })
})
