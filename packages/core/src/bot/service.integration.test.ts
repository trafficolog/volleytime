import { closeDb, db, eq, organizations, sql, users, waitlistOffers } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'

import { botService } from './service'

const future = (h = 24) => new Date(Date.now() + h * 3600_000)
let seq = 1000
let ownerId: number
let orgId: number

async function newPlayer(opts: { member?: boolean } = {}) {
  const tg = BigInt(++seq)
  const [u] = await db
    .insert(users)
    .values({ email: `b-${Math.random()}@t.by`, telegramUserId: tg })
    .returning()
  if (opts.member !== false)
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return { id: u!.id, tg: String(tg) }
}

const makeEvent = (opts: { capacity?: number; hours?: number; title?: string } = {}) =>
  eventService.create({ userId: ownerId }, orgId, {
    title: opts.title ?? 'Основа',
    startsAt: future(opts.hours ?? 24),
    endsAt: future((opts.hours ?? 24) + 2),
    capacity: opts.capacity ?? 2,
    price: 0,
  })

describe('botService (20.3.3, integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [o] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = o!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Bot Org' })).id
  })
  afterAll(async () => {
    await closeDb()
  })

  describe('markReachable', () => {
    it('clears users.bot_blocked_at for the telegram user only', async () => {
      const a = await newPlayer()
      const b = await newPlayer()
      const at = new Date()
      await db.update(users).set({ botBlockedAt: at }).where(eq(users.id, a.id))
      await db.update(users).set({ botBlockedAt: at }).where(eq(users.id, b.id))
      expect(await botService.markReachable(a.tg)).toBe(true)
      const [ua] = await db.select().from(users).where(eq(users.id, a.id))
      const [ub] = await db.select().from(users).where(eq(users.id, b.id))
      expect(ua!.botBlockedAt).toBeNull()
      expect(ub!.botBlockedAt).not.toBeNull()
    })
    it('unknown or malformed telegram id is a no-op', async () => {
      expect(await botService.markReachable('999999999')).toBe(false)
      expect(await botService.markReachable('abc')).toBe(false)
    })
  })

  describe('listGames / listMyBookings', () => {
    it('lists upcoming published events of own groups only, with taken seats', async () => {
      const p = await newPlayer()
      const outsider = await newPlayer({ member: false })
      const ev = await makeEvent({ capacity: 3 })
      await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      const other = await organizationService.create({ userId: outsider.id }, { name: 'Other' })
      await eventService.create({ userId: outsider.id }, other.id, {
        title: 'Чужое',
        startsAt: future(),
        endsAt: future(26),
        capacity: 5,
        price: 0,
      })
      const games = await botService.listGames(p.tg)
      expect(games.map((g) => g.title)).toEqual(['Основа'])
      expect(games[0]).toMatchObject({ eventId: ev.id, capacity: 3, taken: 1 })
      expect(typeof games[0]!.timeZone).toBe('string')
    })
    it('lists own non-cancelled upcoming bookings', async () => {
      const p = await newPlayer()
      const q = await newPlayer()
      const ev = await makeEvent()
      const ev2 = await makeEvent({ title: 'Вторая', hours: 48 })
      await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      await bookingService.book({ userId: q.id }, orgId, ev.id, { method: 'free' })
      const b2 = await bookingService.book({ userId: p.id }, orgId, ev2.id, { method: 'free' })
      await bookingService.cancel({ userId: p.id }, b2.id)
      const mine = await botService.listMyBookings(p.tg)
      expect(mine.map((b) => b.title)).toEqual(['Основа'])
    })
    it('unknown user gets empty lists', async () => {
      expect(await botService.listGames('424242')).toEqual([])
      expect(await botService.listMyBookings('424242')).toEqual([])
    })
  })

  describe('cancelMyBooking', () => {
    it('cancels the caller booking, repeat is idempotent', async () => {
      const p = await newPlayer()
      const ev = await makeEvent()
      await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      expect(await botService.cancelMyBooking(p.tg, ev.id)).toBe('cancelled')
      expect(await botService.cancelMyBooking(p.tg, ev.id)).toBe('already_cancelled')
    })
    it('IDOR: another telegram user cannot cancel a booking they do not own', async () => {
      const p = await newPlayer()
      const q = await newPlayer()
      const ev = await makeEvent()
      const b = await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      expect(await botService.cancelMyBooking(q.tg, ev.id)).toBe('not_found')
      expect(await botService.cancelMyBooking('555555', ev.id)).toBe('not_found')
      expect((await bookingService.getById({ userId: p.id }, b.id)).status).not.toBe('cancelled')
    })
    it('blocked member of the group cannot act', async () => {
      const p = await newPlayer()
      const ev = await makeEvent()
      await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      await db.execute(
        sql`UPDATE organization_members SET status = 'blocked' WHERE user_id = ${p.id}`,
      )
      expect(await botService.cancelMyBooking(p.tg, ev.id)).toBe('not_found')
    })
    it('started event cannot be cancelled', async () => {
      const p = await newPlayer()
      const ev = await makeEvent({ hours: 1 })
      await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      await db.execute(
        sql`UPDATE events SET starts_at = now() - interval '1 hour' WHERE id = ${ev.id}`,
      )
      expect(await botService.cancelMyBooking(p.tg, ev.id)).toBe('not_allowed')
    })
  })

  describe('acceptMyOffer', () => {
    async function offerSetup() {
      const p = await newPlayer()
      const first = await newPlayer()
      const ev = await makeEvent({ capacity: 1 })
      await bookingService.book({ userId: first.id }, orgId, ev.id, { method: 'free' })
      const waiting = await bookingService.book({ userId: p.id }, orgId, ev.id, { method: 'free' })
      expect(waiting.status).toBe('waitlisted')
      return { p, first, ev, waiting }
    }
    it('accepts the caller active offer; repeat is idempotent; foreign user gets not_found', async () => {
      const { p, first, ev, waiting } = await offerSetup()
      const other = await newPlayer()
      await db.insert(waitlistOffers).values({
        organizationId: orgId,
        eventId: ev.id,
        bookingId: waiting.id,
        seats: 1,
        offeredAt: new Date(),
        expiresAt: future(1),
      })
      await db.execute(sql`UPDATE bookings SET status = 'cancelled' WHERE user_id = ${first.id}`)
      expect(await botService.acceptMyOffer(other.tg, ev.id)).toBe('not_found')
      expect(await botService.acceptMyOffer(p.tg, ev.id)).toBe('accepted')
      expect(await botService.acceptMyOffer(p.tg, ev.id)).toBe('accepted')
    })
    it('expired offer -> expired', async () => {
      const { p, ev, waiting } = await offerSetup()
      await db.insert(waitlistOffers).values({
        organizationId: orgId,
        eventId: ev.id,
        bookingId: waiting.id,
        seats: 1,
        offeredAt: new Date(Date.now() - 3600_000),
        expiresAt: new Date(Date.now() - 1000),
      })
      expect(await botService.acceptMyOffer(p.tg, ev.id)).toBe('expired')
    })
    it('booking closed or event not open -> closed (not expired)', async () => {
      const { p, ev, waiting } = await offerSetup()
      await db.insert(waitlistOffers).values({
        organizationId: orgId,
        eventId: ev.id,
        bookingId: waiting.id,
        seats: 1,
        offeredAt: new Date(),
        expiresAt: future(1),
      })
      await db.execute(sql`UPDATE events SET status = 'cancelled' WHERE id = ${ev.id}`)
      expect(await botService.acceptMyOffer(p.tg, ev.id)).toBe('closed')
    })
  })

  /** Игроки, которые не должны получать данные группы: чужой, заблокированный, вышедший, из другой группы. */
  async function deniedPlayers() {
    const outsider = await newPlayer({ member: false })
    const blocked = await newPlayer()
    await db.execute(
      sql`UPDATE organization_members SET status = 'blocked' WHERE user_id = ${blocked.id}`,
    )
    const left = await newPlayer()
    await memberService.leaveOrg({ userId: left.id }, orgId)
    const other = await newPlayer({ member: false })
    const otherOrg = await organizationService.create({ userId: other.id }, { name: 'Other' })
    return { outsider, blocked, left, other, otherOrg }
  }

  async function activeSub(userId: number, forOrg = orgId, totalSessions = 4) {
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: forOrg, name: 'Абонемент 4', totalSessions },
    )
    return subscriptionService.createFromPlan({ userId }, forOrg, plan.id, { autoActivate: true })
  }

  describe('listMySubscriptions (21.4.9)', () => {
    it('returns the active subscription with remaining sessions', async () => {
      const p = await newPlayer()
      const sub = await activeSub(p.id)
      await db.execute(sql`UPDATE subscriptions SET used_sessions = 1 WHERE id = ${sub.id}`)
      const rows = await botService.listMySubscriptions(p.tg)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        organizationId: orgId,
        organizationName: 'Bot Org',
        planName: 'Абонемент 4',
        remaining: 3,
        total: 4,
      })
    })
    it('hides pending, exhausted, expired and cancelled subscriptions', async () => {
      const p = await newPlayer()
      const plan = await planService.create(
        { userId: ownerId },
        { organizationId: orgId, name: 'Plan', totalSessions: 2 },
      )
      for (const status of ['pending', 'exhausted', 'cancelled', 'expired'] as const) {
        const s = await subscriptionService.createFromPlan({ userId: p.id }, orgId, plan.id)
        await db.execute(sql`UPDATE subscriptions SET status = ${status} WHERE id = ${s.id}`)
      }
      const lapsed = await activeSub(p.id)
      await db.execute(
        sql`UPDATE subscriptions SET expires_at = now() - interval '1 day' WHERE id = ${lapsed.id}`,
      )
      expect(await botService.listMySubscriptions(p.tg)).toEqual([])
    })
    it('hides groups with subscriptions switched off', async () => {
      const p = await newPlayer()
      await activeSub(p.id)
      await db.execute(sql`UPDATE organizations SET subscriptions_enabled = false`)
      expect(await botService.listMySubscriptions(p.tg)).toEqual([])
    })
    it('IDOR: never shows another player subscription, even in the same group', async () => {
      const p = await newPlayer()
      const q = await newPlayer()
      await activeSub(q.id)
      expect(await botService.listMySubscriptions(p.tg)).toEqual([])
      expect(await botService.listMySubscriptions('424242')).toEqual([])
      expect(await botService.listMySubscriptions('abc')).toEqual([])
    })
    it('IDOR: non-members, blocked and left players get nothing; other group is not mixed in', async () => {
      const { outsider, blocked, left, other, otherOrg } = await deniedPlayers()
      for (const u of [outsider, blocked, left]) await activeSub(u.id)
      await activeSub(other.id, otherOrg.id)
      for (const u of [outsider, blocked, left])
        expect(await botService.listMySubscriptions(u.tg), String(u.id)).toEqual([])
      const rows = await botService.listMySubscriptions(other.tg)
      expect(rows.map((r) => r.organizationId)).toEqual([otherOrg.id])
    })
  })

  describe('eventRoster (21.4.9)', () => {
    it('member sees names and seats only, waitlist is not shown', async () => {
      const a = await newPlayer()
      const b = await newPlayer()
      const w = await newPlayer()
      await db.execute(
        sql`UPDATE users SET name = 'Анна', telegram_username = 'anna_tg' WHERE id = ${a.id}`,
      )
      await db.execute(sql`UPDATE users SET name = 'Борис' WHERE id = ${b.id}`)
      const ev = await makeEvent({ capacity: 2 })
      await bookingService.book({ userId: a.id }, orgId, ev.id, { method: 'free' })
      await bookingService.book({ userId: b.id }, orgId, ev.id, { method: 'free' })
      const wl = await bookingService.book({ userId: w.id }, orgId, ev.id, { method: 'free' })
      expect(wl.status).toBe('waitlisted')
      const res = await botService.eventRoster(a.tg, ev.id)
      expect(res).toMatchObject({ result: 'ok', title: 'Основа', capacity: 2 })
      if (res.result !== 'ok') throw new Error('unreachable')
      expect(res.players).toEqual([
        { name: 'Анна', seats: 1 },
        { name: 'Борис', seats: 1 },
      ])
      expect(JSON.stringify(res)).not.toContain('anna_tg')
      // повтор безопасен: тот же результат
      expect(await botService.eventRoster(a.tg, ev.id)).toEqual(res)
    })
    it('IDOR: non-members, blocked, left and members of another group get not_found', async () => {
      const { outsider, blocked, left, other } = await deniedPlayers()
      const a = await newPlayer()
      const ev = await makeEvent()
      await bookingService.book({ userId: a.id }, orgId, ev.id, { method: 'free' })
      for (const u of [outsider, blocked, left, other])
        expect(await botService.eventRoster(u.tg, ev.id), String(u.id)).toEqual({
          result: 'not_found',
        })
      expect(await botService.eventRoster('424242', ev.id)).toEqual({ result: 'not_found' })
      expect(await botService.eventRoster(a.tg, 0)).toEqual({ result: 'not_found' })
    })
    it('draft events and deleted groups are not_found for members', async () => {
      const a = await newPlayer()
      const ev = await makeEvent()
      await db.execute(sql`UPDATE events SET status = 'draft' WHERE id = ${ev.id}`)
      expect(await botService.eventRoster(a.tg, ev.id)).toEqual({ result: 'not_found' })
      await db.execute(sql`UPDATE events SET status = 'published' WHERE id = ${ev.id}`)
      expect((await botService.eventRoster(a.tg, ev.id)).result).toBe('ok')
      await db.execute(
        sql`UPDATE organizations SET deleted_at = now(), restore_until = now() + interval '30 days' WHERE id = ${orgId}`,
      )
      expect(await botService.eventRoster(a.tg, ev.id)).toEqual({ result: 'not_found' })
    })
  })
})
