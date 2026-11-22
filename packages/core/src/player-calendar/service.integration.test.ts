import { closeDb, db, eq, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { playerCalendarService } from './service'

/**
 * Task 23.2.2 (M-10): общий календарь игрока на реальном PostgreSQL. Даты фиксированы (2035 год,
 * будущее для записи на событие), от часов и пояса раннера тест не зависит.
 */
describe('player calendar (23.2.2, PostgreSQL)', { timeout: 60_000 }, () => {
  let me: number
  let other: number
  let ownerA: number
  let ownerB: number
  let orgA: number
  let orgB: number
  const ctx = (userId: number) => ({ userId })
  const MARCH = { from: '2035-03-01', to: '2035-03-31' }

  async function user(tag: string): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({ email: `pc-${tag}-${crypto.randomUUID()}@t.by`, name: `Игрок ${tag}` })
      .returning()
    return u!.id
  }
  async function game(
    owner: number,
    org: number,
    title: string,
    startsAt: string,
    extra: Record<string, unknown> = {},
  ) {
    const start = new Date(startsAt)
    return eventService.create({ userId: owner }, org, {
      title,
      startsAt: start,
      endsAt: new Date(start.getTime() + 2 * 3600_000),
      capacity: 4,
      price: 0,
      ...extra,
    })
  }
  const book = (userId: number, org: number, eventId: number, seats = 1) =>
    bookingService.book(ctx(userId), org, eventId, { method: 'free', seats })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    me = await user('me')
    other = await user('other')
    ownerA = await user('ownerA')
    ownerB = await user('ownerB')
    orgA = (await organizationService.create(ctx(ownerA), { name: 'Группа А' })).id
    orgB = (await organizationService.create(ctx(ownerB), { name: 'Группа Б' })).id
    await memberService.add(ctx(ownerA), { organizationId: orgA, userId: me })
    await memberService.add(ctx(ownerB), { organizationId: orgB, userId: me })
    await memberService.add(ctx(ownerA), { organizationId: orgA, userId: other })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('returns events of all my groups in one call with own booking, seats, sorted by start', async () => {
    const a1 = await game(ownerA, orgA, 'А-вечер', '2035-03-10T17:00:00Z')
    const b1 = await game(ownerB, orgB, 'Б-утро', '2035-03-10T07:00:00Z')
    const a2 = await game(ownerA, orgA, 'А-поздно', '2035-03-20T17:00:00Z')
    await book(me, orgA, a1.id)
    await book(other, orgA, a1.id)
    const res = await playerCalendarService.list(ctx(me), MARCH)
    expect(res.events.map((e) => e.id)).toEqual([b1.id, a1.id, a2.id])
    expect(res.groups.map((g) => g.id)).toEqual([orgA, orgB].sort((x, y) => x - y))
    expect(res.groups.every((g) => g.timezone === 'Europe/Minsk')).toBe(true)
    expect(res.events.find((e) => e.id === a1.id)).toMatchObject({
      organizationId: orgA,
      title: 'А-вечер',
      capacity: 4,
      taken: 2,
      myBooking: { status: 'confirmed' },
    })
    expect(res.events.find((e) => e.id === b1.id)!.myBooking).toBeNull()
  })

  it('shows my waitlist position and only my own booking', async () => {
    const full = await game(ownerA, orgA, 'Полная', '2035-03-10T17:00:00Z', { capacity: 1 })
    await book(other, orgA, full.id)
    await book(me, orgA, full.id)
    const res = await playerCalendarService.list(ctx(me), MARCH)
    expect(res.events[0]!.myBooking).toMatchObject({ status: 'waitlisted', waitPos: 1 })
    expect(res.events[0]!.taken).toBe(1)
  })

  it('does not leak groups I am not an active member of (IDOR)', async () => {
    const stranger = await user('stranger')
    const strangerOrg = (await organizationService.create(ctx(stranger), { name: 'Чужая' })).id
    await game(stranger, strangerOrg, 'Чужая игра', '2035-03-11T17:00:00Z')
    const res = await playerCalendarService.list(ctx(me), MARCH)
    expect(res.events).toHaveLength(0)
    expect(res.groups.map((g) => g.id)).not.toContain(strangerOrg)
    // чужой пользователь не видит события моих групп
    await game(ownerA, orgA, 'Моя группа', '2035-03-12T17:00:00Z')
    const strangerView = await playerCalendarService.list(ctx(stranger), MARCH)
    expect(strangerView.events.map((e) => e.title)).toEqual(['Чужая игра'])
  })

  it('skips groups where my membership is not active', async () => {
    await game(ownerA, orgA, 'Игра А', '2035-03-12T17:00:00Z')
    await game(ownerB, orgB, 'Игра Б', '2035-03-13T17:00:00Z')
    for (const status of ['pending', 'left', 'rejected', 'blocked'] as const) {
      await db.update(organizationMembers).set({ status }).where(eq(organizationMembers.userId, me))
      const res = await playerCalendarService.list(ctx(me), MARCH)
      expect(res.events, status).toHaveLength(0)
      expect(res.groups, status).toHaveLength(0)
    }
  })

  it('skips suspended, archived and deleted groups', async () => {
    const a = await game(ownerA, orgA, 'Игра А', '2035-03-12T17:00:00Z')
    await game(ownerB, orgB, 'Игра Б', '2035-03-13T17:00:00Z')
    await db.update(organizations).set({ status: 'suspended' }).where(eq(organizations.id, orgB))
    expect((await playerCalendarService.list(ctx(me), MARCH)).events.map((e) => e.id)).toEqual([
      a.id,
    ])
    await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgB))
    expect((await playerCalendarService.list(ctx(me), MARCH)).events).toHaveLength(1)
    await db
      .update(organizations)
      .set({
        status: 'active',
        deletedAt: new Date(Date.now() - 1000),
        restoreUntil: new Date(Date.now() + 86_400_000),
      })
      .where(eq(organizations.id, orgB))
    const res = await playerCalendarService.list(ctx(me), MARCH)
    expect(res.events.map((e) => e.id)).toEqual([a.id])
    expect(res.groups.map((g) => g.id)).toEqual([orgA])
  })

  it('hides drafts and cancelled events', async () => {
    const live = await game(ownerA, orgA, 'Живая', '2035-03-12T17:00:00Z')
    await game(ownerA, orgA, 'Черновик', '2035-03-13T17:00:00Z', { status: 'draft' })
    const gone = await game(ownerA, orgA, 'Отменена', '2035-03-14T17:00:00Z')
    await eventService.cancel(ctx(ownerA), gone.id)
    const res = await playerCalendarService.list(ctx(me), MARCH)
    expect(res.events.map((e) => e.id)).toEqual([live.id])
  })

  it('cuts the range in each group time zone, boundaries inclusive', async () => {
    await db.update(organizations).set({ defaultTimezone: 'UTC' }).where(eq(organizations.id, orgB))
    // 21:30Z 31 марта: в Минске (UTC+3) уже 1 апреля, в UTC ещё 31 марта
    const minsk = await game(ownerA, orgA, 'Минск', '2035-03-31T21:30:00Z')
    const utc = await game(ownerB, orgB, 'UTC', '2035-03-31T21:30:00Z')
    // 21:00Z 28 февраля = 00:00 1 марта в Минске: первая минута месяца
    const first = await game(ownerA, orgA, 'Первая минута', '2035-02-28T21:00:00Z')
    const march = await playerCalendarService.list(ctx(me), MARCH)
    expect(march.events.map((e) => e.id).sort()).toEqual([first.id, utc.id].sort())
    const april = await playerCalendarService.list(ctx(me), {
      from: '2035-04-01',
      to: '2035-04-30',
    })
    expect(april.events.map((e) => e.id)).toEqual([minsk.id])
    expect(april.groups.find((g) => g.id === orgB)!.timezone).toBe('UTC')
  })

  it('does not return money, payment or roster fields', async () => {
    const paid = await game(ownerA, orgA, 'Платная', '2035-03-12T17:00:00Z', { price: 1500 })
    await bookingService.book(ctx(me), orgA, paid.id, { method: 'cash', seats: 1 })
    const res = await playerCalendarService.list(ctx(me), MARCH)
    const row = res.events[0]!
    for (const k of ['price', 'priceForecast', 'paymentTotals', 'myShare', 'description'])
      expect(Object.keys(row)).not.toContain(k)
    expect(row.myBooking).not.toBeNull()
    expect(Object.keys(row.myBooking!).sort()).toEqual(['id', 'status', 'waitPos', 'waitlistSeats'])
  })

  it('validates the range', async () => {
    for (const q of [
      { from: '2035-03-31', to: '2035-03-01' },
      { from: '2035-03-01', to: '2035-06-30' },
      { from: '03/01/2035', to: '2035-03-31' },
      { from: '2035-03-01' },
      {},
    ])
      await expect(playerCalendarService.list(ctx(me), q)).rejects.toThrow()
  })

  it('returns an empty calendar for a user without groups', async () => {
    const lone = await user('lone')
    expect(await playerCalendarService.list(ctx(lone), MARCH)).toEqual({ groups: [], events: [] })
  })
})
