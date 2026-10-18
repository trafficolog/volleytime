import {
  closeDb,
  db,
  eq,
  notifications,
  organizations,
  scheduledJobs,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  enqueueNotification,
  enqueueNotifications,
  processDueJobs,
  resetDeliveryPacing,
  UNREACHABLE_COOLDOWN_MS,
} from '../scheduler/journal'

import { createNotificationCollector, dispatchNotifications } from './collect'
import { DeliveryError } from './delivery-error'
import { notificationFeedService } from './feed'
import { feedKeyOf, isCriticalNotification } from './feed-types'
import { setNotifierTransport } from './service'
import type { NotifyPayload } from './types'

/**
 * Task 20.3.2: хранимая лента и доставка через журнал `scheduled_jobs` (PostgreSQL, транспорт —
 * mock, в Telegram ничего не уходит). Время — `now`, переданный в проход доставки.
 */
const H = 3600_000
const MIN = 60_000
// 2026-10-20 10:00 UTC = 13:00 в Минске (UTC+3)
const NOON = Date.UTC(2026, 9, 20, 10, 0, 0)
// 2026-10-20 20:30 UTC = 23:30 в Минске
const NIGHT = Date.UTC(2026, 9, 20, 20, 30, 0)

let sent: NotifyPayload[]
let failWith: (() => unknown) | null
let orgId: number
let nextTg = 7000n

async function newUser(extra: Partial<typeof users.$inferInsert> = {}): Promise<number> {
  const tg = nextTg++
  const [u] = await db
    .insert(users)
    .values({ email: `u${tg}@example.com`, telegramUserId: tg, ...extra })
    .returning({ id: users.id })
  return u!.id
}

const base = (
  userId: number,
  key: string,
  type: Parameters<typeof enqueueNotification>[1]['type'],
) => ({
  type,
  dedupKey: key,
  userId,
  organizationId: orgId,
  eventId: null,
  params: { eventTitle: 'Игра', organizationId: orgId },
  runAt: new Date(NOON),
})

const jobOf = async (key: string) =>
  (await db.select().from(scheduledJobs).where(eq(scheduledJobs.dedupKey, key)))[0]!

const feedOf = async (userId: number) =>
  db.select().from(notifications).where(eq(notifications.recipientUserId, userId))

const run = (now: number, opts: Parameters<typeof processDueJobs>[0] = {}) =>
  processDueJobs({ now: new Date(now), paceMs: 0, ...opts })

describe('notifications feed (20.3.2, PostgreSQL)', { timeout: 60_000 }, () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await db.delete(scheduledJobs)
    const owner = await newUser()
    const [org] = await db
      .insert(organizations)
      .values({ slug: 'feed', name: 'Feed', ownerUserId: owner })
      .returning({ id: organizations.id })
    orgId = org!.id
    sent = []
    failWith = null
    resetDeliveryPacing()
    setNotifierTransport({
      async send(payload) {
        if (failWith) throw failWith()
        sent.push(payload)
      },
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setNotifierTransport({ async send() {} })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('feed keys and critical types', () => {
    it('derives the ADR key from the journal key', () => {
      expect(feedKeyOf('reminder_24h', 'reminder_24h:event:7:user:3')).toBe('reminder_24h:event:7')
      expect(feedKeyOf('split_price_settled', 'split_price_settled:event:7:user:3')).toBe(
        'split_settled:event:7',
      )
      expect(feedKeyOf('split_settled_organizer', 'split_settled_organizer:event:7:user:3')).toBe(
        'split_settled:event:7:organizer',
      )
      expect(feedKeyOf('payment_confirmed', 'payment_confirmed:booking:5:1:9:user:3')).toBe(
        'payment_confirmed:booking:5:1:9',
      )
      expect(
        feedKeyOf('payment_pending_organizer', 'payment_pending_organizer:payment:4:user:3'),
      ).toBe('organizer_action_required:payment:4')
    })

    it('treats offers, payments and cancellation as critical', () => {
      for (const t of [
        'waitlist_offer',
        'payment_confirmed',
        'payment_rejected',
        'event_cancelled',
      ])
        expect(isCriticalNotification(t as 'waitlist_offer')).toBe(true)
      for (const t of ['reminder_24h', 'reminder_2h', 'booking_opened', 'split_price_settled'])
        expect(isCriticalNotification(t as 'reminder_2h')).toBe(false)
    })
  })

  describe('one notification per type and event', () => {
    it('stores one feed row and one job, ignoring repeats', async () => {
      const u = await newUser()
      const job = base(u, 'reminder_24h:event:1:user:' + u, 'reminder_24h')
      expect(await enqueueNotification(db, job)).toBe(true)
      expect(await enqueueNotification(db, job)).toBe(false)
      const rows = await feedOf(u)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        type: 'reminder_24h',
        dedupKey: 'reminder_24h:event:1',
        deliveryStatus: 'pending',
        organizationId: orgId,
      })
      expect(await db.select().from(scheduledJobs)).toHaveLength(1)
    })

    it('does not queue a second message when another path already recorded the type', async () => {
      const u = await newUser()
      // задача журнала очищена через 90 дней, запись ленты осталась: повторная постановка не шлёт заново
      const job = base(u, 'split_price_settled:event:2:user:' + u, 'split_price_settled')
      expect(await enqueueNotification(db, job)).toBe(true)
      await run(NOON)
      await db.delete(scheduledJobs)
      expect(await enqueueNotification(db, job)).toBe(false)
      await run(NOON + MIN)
      expect(sent).toHaveLength(1)
      expect(await feedOf(u)).toHaveLength(1)
    })

    it('keeps the organizer message apart from the player one', async () => {
      const u = await newUser()
      await enqueueNotifications(db, [
        base(u, 'split_price_settled:event:3:user:' + u, 'split_price_settled'),
        base(u, 'split_settled_organizer:event:3:user:' + u, 'split_settled_organizer'),
      ])
      expect((await feedOf(u)).map((n) => n.dedupKey).sort()).toEqual([
        'split_settled:event:3',
        'split_settled:event:3:organizer',
      ])
    })

    it('removes the feed row when its journal job already exists', async () => {
      const u = await newUser()
      await db.insert(scheduledJobs).values({
        kind: 'reminder_2h',
        dedupKey: 'old:key',
        payload: {},
        runAt: new Date(NOON + 99 * H),
      })
      expect(await enqueueNotification(db, base(u, 'old:key', 'reminder_2h'))).toBe(false)
      expect(await feedOf(u)).toHaveLength(0)
    })

    it('does not send twice when dispatch repeats a payment operation', async () => {
      const u = await newUser()
      const make = () => {
        const list = createNotificationCollector()
        list.push({
          userId: u,
          type: 'payment_confirmed',
          dedupKey: `payment_confirmed:booking:5:1:9:user:${u}`,
          params: { amount: 1000, currency: 'BYN', organizationId: orgId },
        })
        return list
      }
      await dispatchNotifications(make())
      await dispatchNotifications(make())
      expect(sent).toHaveLength(1)
      expect(await feedOf(u)).toHaveLength(1)
      // следующая операция над той же записью — другой ключ — новое уведомление
      const next = make()
      next[0]!.dedupKey = `payment_confirmed:booking:5:1:12:user:${u}`
      await dispatchNotifications(next)
      expect(sent).toHaveLength(2)
    })

    it('sends mini-app confirmations directly and keeps them out of the feed', async () => {
      const u = await newUser()
      await dispatchNotifications([
        { userId: u, type: 'booking_confirmed', params: { eventTitle: 'X', eventId: 1 } },
      ])
      expect(sent).toHaveLength(1)
      expect(await feedOf(u)).toHaveLength(0)
    })
  })

  describe('delivery', () => {
    it('marks the feed row sent with the delivery time', async () => {
      const u = await newUser()
      await enqueueNotification(db, base(u, 'k:sent', 'booking_opened'))
      expect(await run(NOON)).toMatchObject({ sent: 1 })
      expect(sent[0]?.text).toContain('Запись открыта')
      expect(sent[0]?.telegramId).toBe(String(nextTg - 1n))
      const [row] = await feedOf(u)
      expect(row).toMatchObject({ deliveryStatus: 'sent', attempts: 1, lastError: null })
      expect(row!.deliveredAt!.getTime()).toBeGreaterThanOrEqual(NOON)
      expect(row!.deliveredAt!.getTime()).toBeLessThan(NOON + 5000)
      expect(await jobOf('k:sent')).toMatchObject({ status: 'done' })
    })

    it('skips a stale notification and records why', async () => {
      const u = await newUser()
      await enqueueNotification(db, {
        ...base(u, 'k:stale', 'waitlist_offer'),
        check: { kind: 'offer', offerId: 999_999 },
      })
      expect(await run(NOON)).toMatchObject({ skipped: 1, sent: 0 })
      expect(sent).toHaveLength(0)
      expect((await feedOf(u))[0]).toMatchObject({ deliveryStatus: 'skipped', lastError: 'stale' })
    })

    it('skips a user without Telegram', async () => {
      const [u] = await db
        .insert(users)
        .values({ email: 'nobot@example.com' })
        .returning({ id: users.id })
      await enqueueNotification(db, base(u!.id, 'k:notg', 'booking_opened'))
      expect(await run(NOON)).toMatchObject({ skipped: 1 })
      expect((await feedOf(u!.id))[0]).toMatchObject({
        deliveryStatus: 'skipped',
        lastError: 'no_telegram',
      })
    })

    it('retries a transient failure with backoff and fails after the attempt limit', async () => {
      const u = await newUser()
      failWith = () => new DeliveryError('transient')
      await enqueueNotification(db, base(u, 'k:down', 'booking_opened'))
      let t = NOON
      expect(await run(t)).toMatchObject({ retried: 1 })
      expect((await feedOf(u))[0]).toMatchObject({ deliveryStatus: 'pending', attempts: 1 })
      for (let i = 0; i < 5; i++) {
        t += 31 * MIN
        await run(t)
      }
      expect(await jobOf('k:down')).toMatchObject({ status: 'failed', attempts: 6 })
      expect((await feedOf(u))[0]).toMatchObject({
        deliveryStatus: 'failed',
        attempts: 6,
        lastError: 'delivery transient',
      })
      // исчерпанная задача не повторяется
      failWith = null
      await run(t + 24 * H)
      expect(sent).toHaveLength(0)
    })
  })

  describe('quiet hours', () => {
    const night = { quietHoursStart: 22 * 60, quietHoursEnd: 7 * 60 }

    it('defers a regular notification to the end of the window without spending an attempt', async () => {
      const u = await newUser(night)
      await enqueueNotification(db, { ...base(u, 'k:q1', 'reminder_24h'), runAt: new Date(NIGHT) })
      expect(await run(NIGHT)).toMatchObject({ deferred: 1, sent: 0 })
      expect(sent).toHaveLength(0)
      // 07:00 по Минску = 04:00 UTC следующих суток
      const end = Date.UTC(2026, 9, 21, 4, 0, 0)
      expect(await jobOf('k:q1')).toMatchObject({
        status: 'pending',
        attempts: 0,
        runAt: new Date(end),
      })
      expect((await feedOf(u))[0]).toMatchObject({ deliveryStatus: 'pending' })
      // окно ещё не закончилось — задача не берётся
      expect(await run(end - MIN)).toMatchObject({ sent: 0, deferred: 0 })
      expect(await run(end)).toMatchObject({ sent: 1 })
      expect((await feedOf(u))[0]).toMatchObject({ deliveryStatus: 'sent' })
    })

    it('never delays critical notifications', async () => {
      const u = await newUser(night)
      for (const [i, type] of (
        ['waitlist_offer', 'payment_confirmed', 'payment_rejected', 'event_cancelled'] as const
      ).entries())
        await enqueueNotification(db, { ...base(u, `k:crit${i}`, type), runAt: new Date(NIGHT) })
      expect(await run(NIGHT)).toMatchObject({ sent: 4, deferred: 0 })
    })

    it('sends during the day and for users without quiet hours', async () => {
      const a = await newUser(night)
      const b = await newUser()
      await enqueueNotification(db, base(a, 'k:day', 'reminder_2h'))
      await enqueueNotification(db, { ...base(b, 'k:none', 'reminder_2h'), runAt: new Date(NIGHT) })
      expect(await run(NOON)).toMatchObject({ sent: 1 })
      expect(await run(NIGHT)).toMatchObject({ sent: 1 })
    })

    it('uses the timezone of the source group', async () => {
      // 23:30 в Минске, но 16:30 в Нью-Йорке: окно 22:00-07:00 группы в Нью-Йорке ещё не началось
      await db
        .update(organizations)
        .set({ defaultTimezone: 'America/New_York' })
        .where(eq(organizations.id, orgId))
      const u = await newUser(night)
      await enqueueNotification(db, { ...base(u, 'k:tz', 'reminder_2h'), runAt: new Date(NIGHT) })
      expect(await run(NIGHT)).toMatchObject({ sent: 1 })
    })
  })

  describe('unreachable recipients', () => {
    it('marks the user unreachable on a blocked bot and does not retry', async () => {
      const u = await newUser()
      failWith = () => new DeliveryError('blocked')
      await enqueueNotification(db, base(u, 'k:b1', 'booking_opened'))
      expect(await run(NOON)).toMatchObject({ unreachable: 1, retried: 0 })
      expect(await jobOf('k:b1')).toMatchObject({
        status: 'skipped',
        attempts: 1,
        lastError: 'bot_blocked',
      })
      expect((await feedOf(u))[0]).toMatchObject({
        deliveryStatus: 'failed',
        lastError: 'bot_blocked',
      })
      const [user] = await db.select().from(users).where(eq(users.id, u))
      expect(user!.botBlockedAt!.getTime()).toBeGreaterThanOrEqual(NOON)
      expect(user!.botBlockedAt!.getTime()).toBeLessThan(NOON + 5000)
    })

    it('skips an unreachable user without calling Telegram, then tries again after the cooldown', async () => {
      const u = await newUser({ botBlockedAt: new Date(NOON) })
      await enqueueNotification(db, base(u, 'k:b2', 'booking_opened'))
      expect(await run(NOON + H)).toMatchObject({ unreachable: 1, sent: 0 })
      expect(sent).toHaveLength(0)
      expect((await feedOf(u))[0]).toMatchObject({
        deliveryStatus: 'skipped',
        lastError: 'bot_unreachable',
      })
      // критичные тоже не отправляются заведомо недоступному получателю
      await enqueueNotification(db, base(u, 'k:b3', 'waitlist_offer'))
      expect(await run(NOON + 2 * H)).toMatchObject({ unreachable: 1, sent: 0 })

      // по истечении срока пробуем один раз; успех снимает отметку
      await enqueueNotification(db, base(u, 'k:b4', 'booking_opened'))
      expect(await run(NOON + UNREACHABLE_COOLDOWN_MS + MIN)).toMatchObject({ sent: 1 })
      const [user] = await db.select().from(users).where(eq(users.id, u))
      expect(user!.botBlockedAt).toBeNull()
    })
  })

  describe('Bot API rate limit', () => {
    it('waits for retry-after, keeps the rest of the batch and spends no attempts', async () => {
      const [a, b, c] = [await newUser(), await newUser(), await newUser()]
      failWith = () => new DeliveryError('rate_limited', 20_000)
      for (const [i, u] of [a, b, c].entries())
        await enqueueNotification(db, base(u, `k:r${i}`, 'booking_opened'))
      expect(await run(NOON)).toMatchObject({ deferred: 1, sent: 0, retried: 0 })
      // первая задача отложена на retry-after, остальные возвращены нетронутыми
      expect(await jobOf('k:r0')).toMatchObject({
        status: 'pending',
        attempts: 0,
        runAt: expect.any(Date),
      })
      const waitUntil = (await jobOf('k:r0')).runAt.getTime()
      expect(waitUntil).toBeGreaterThanOrEqual(NOON + 20_000)
      expect(waitUntil).toBeLessThan(NOON + 25_000) // часы прохода: now + реальные миллисекунды
      expect(await jobOf('k:r1')).toMatchObject({ status: 'pending', attempts: 0 })
      expect(await jobOf('k:r2')).toMatchObject({ status: 'pending', attempts: 0 })

      failWith = null
      // пока действует лимит, бот не нагружается
      expect(await run(NOON + 10_000)).toMatchObject({ sent: 0 })
      expect(sent).toHaveLength(0)
      expect(await run(NOON + 21_000)).toMatchObject({ sent: 3 })
    })

    it('delivers in order of run_at within a pass', async () => {
      const [a, b] = [await newUser(), await newUser()]
      await enqueueNotification(db, { ...base(b, 'k:o2', 'booking_opened'), runAt: new Date(NOON) })
      await enqueueNotification(db, {
        ...base(a, 'k:o1', 'booking_opened'),
        runAt: new Date(NOON - MIN),
      })
      await run(NOON)
      const tg = async (id: number) =>
        String((await db.select().from(users).where(eq(users.id, id)))[0]!.telegramUserId)
      expect(sent.map((p) => p.telegramId)).toEqual([await tg(a), await tg(b)])
    })
  })

  describe('feed API service', () => {
    it('lists only own notifications, newest first, with paging and unread count', async () => {
      const me = await newUser()
      const other = await newUser()
      for (let i = 1; i <= 5; i++)
        await enqueueNotification(
          db,
          base(me, `reminder_24h:event:${i}:user:${me}`, 'reminder_24h'),
        )
      await enqueueNotification(
        db,
        base(other, `reminder_24h:event:1:user:${other}`, 'reminder_24h'),
      )

      const first = await notificationFeedService.list(me, { limit: 2 })
      expect(first.items).toHaveLength(2)
      expect(first.unreadCount).toBe(5)
      expect(first.nextCursor).not.toBeNull()
      const second = await notificationFeedService.list(me, { limit: 2, cursor: first.nextCursor! })
      const third = await notificationFeedService.list(me, { limit: 2, cursor: second.nextCursor! })
      const ids = [...first.items, ...second.items, ...third.items].map((n) => n.id)
      expect(new Set(ids).size).toBe(5)
      expect(ids).toEqual([...ids].sort((x, y) => y - x))
      expect(third.nextCursor).toBeNull()
    })

    it('narrows the feed to one group', async () => {
      const me = await newUser()
      const [org2] = await db
        .insert(organizations)
        .values({ slug: 'feed2', name: 'Feed 2', ownerUserId: me })
        .returning({ id: organizations.id })
      await enqueueNotification(db, base(me, `reminder_24h:event:1:user:${me}`, 'reminder_24h'))
      await enqueueNotification(db, {
        ...base(me, `reminder_24h:event:2:user:${me}`, 'reminder_24h'),
        organizationId: org2!.id,
      })
      expect(
        (await notificationFeedService.list(me, { organizationId: org2!.id })).items,
      ).toHaveLength(1)
      expect((await notificationFeedService.list(me)).items).toHaveLength(2)
    })

    it('marks as read only the caller own notifications', async () => {
      const me = await newUser()
      const other = await newUser()
      await enqueueNotification(db, base(me, `reminder_24h:event:1:user:${me}`, 'reminder_24h'))
      await enqueueNotification(
        db,
        base(other, `reminder_24h:event:1:user:${other}`, 'reminder_24h'),
      )
      const mine = (await feedOf(me))[0]!.id
      const theirs = (await feedOf(other))[0]!.id

      // чужой идентификатор не затрагивается (IDOR)
      expect(await notificationFeedService.markRead(me, { ids: [theirs] })).toBe(0)
      expect((await feedOf(other))[0]!.readAt).toBeNull()

      expect(await notificationFeedService.markRead(me, { ids: [mine] })).toBe(1)
      expect(await notificationFeedService.markRead(me, { ids: [mine] })).toBe(0) // повтор — no-op
      expect((await notificationFeedService.list(me)).unreadCount).toBe(0)
      expect((await notificationFeedService.list(other)).unreadCount).toBe(1)
    })

    it('marks all as read, optionally per group', async () => {
      const me = await newUser()
      const [org2] = await db
        .insert(organizations)
        .values({ slug: 'feed3', name: 'Feed 3', ownerUserId: me })
        .returning({ id: organizations.id })
      await enqueueNotification(db, base(me, `reminder_24h:event:1:user:${me}`, 'reminder_24h'))
      await enqueueNotification(db, {
        ...base(me, `reminder_24h:event:2:user:${me}`, 'reminder_24h'),
        organizationId: org2!.id,
      })
      expect(
        await notificationFeedService.markRead(me, { all: true, organizationId: org2!.id }),
      ).toBe(1)
      expect((await notificationFeedService.list(me)).unreadCount).toBe(1)
      expect(await notificationFeedService.markRead(me, { all: true })).toBe(1)
      expect(await notificationFeedService.markRead(me, {})).toBe(0)
    })

    it('stores and validates quiet hours', async () => {
      const me = await newUser()
      expect(await notificationFeedService.getQuietHours(me)).toBeNull()
      await notificationFeedService.setQuietHours(me, { start: 1320, end: 420 })
      expect(await notificationFeedService.getQuietHours(me)).toEqual({ start: 1320, end: 420 })
      await expect(
        notificationFeedService.setQuietHours(me, { start: 1440, end: 0 }),
      ).rejects.toThrow()
      await notificationFeedService.setQuietHours(me, null)
      expect(await notificationFeedService.getQuietHours(me)).toBeNull()
    })
  })
})
