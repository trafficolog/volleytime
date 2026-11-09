import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  ledgerEntries,
  organizationEventBalances,
  organizationOwnershipTransfers,
  organizations,
  payments,
  scheduledJobs,
  subscriptions,
  users,
  waitlistOffers,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { botService } from '../bot/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { notificationFeedService } from '../notifier/feed'
import { setNotifierTransport } from '../notifier/service'
import type { NotifyPayload } from '../notifier/types'
import { organizationService } from '../organizations/service'
import { enqueueNotification, processDueJobs } from '../scheduler/journal'
import { runSchedulerTick } from '../scheduler/tick'

import { organizationDeletionService, ownershipTransferService } from './service'

/**
 * Task 21.2.17: фоновые задачи и бот не трогают мягко удалённую группу. Время — фальшивый `Date`,
 * проходы планировщика вызываются напрямую. До удаления в группе есть: split-событие с записями
 * (фиксация долей при закрытии — деньги), событие с открытием записи, полное событие с
 * предложением места из очереди и поставленное уведомление. После удаления ни один проход не
 * меняет её событий, записей, предложений, платежей, кассы и баланса событий и ничего не шлёт.
 * После восстановления обработка продолжается обычным путём.
 */
describe('deleted group and background jobs (21.2.17, PostgreSQL)', { timeout: 60_000 }, () => {
  const H = 3600_000
  const MIN = 60_000
  let BASE: number
  let ownerId: number
  let orgId: number
  let sent: NotifyPayload[]

  const at = (ms: number) => vi.setSystemTime(new Date(BASE + ms))
  const tick = () => runSchedulerTick({ now: new Date() })

  async function players(n: number) {
    const rows = await db
      .insert(users)
      .values(
        Array.from({ length: n }, (_, i) => ({
          email: `dg-${crypto.randomUUID()}-${i}@t.by`,
          telegramUserId: BigInt(Math.floor(1e9 + Math.random() * 1e11)),
        })),
      )
      .returning()
    for (const u of rows)
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u.id })
    return rows
  }

  /** Всё, что фоновая задача могла бы изменить в группе: события, записи, деньги, очередь, журнал. */
  async function groupState() {
    const rows = await Promise.all([
      db.select().from(events).where(eq(events.organizationId, orgId)).orderBy(events.id),
      db.select().from(bookings).where(eq(bookings.organizationId, orgId)).orderBy(bookings.id),
      db.select().from(payments).where(eq(payments.organizationId, orgId)).orderBy(payments.id),
      db.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, orgId)),
      db.select().from(eventBalanceEntries).where(eq(eventBalanceEntries.organizationId, orgId)),
      db
        .select()
        .from(organizationEventBalances)
        .where(eq(organizationEventBalances.organizationId, orgId)),
      db.select().from(subscriptions).where(eq(subscriptions.organizationId, orgId)),
      db.select().from(waitlistOffers).where(eq(waitlistOffers.organizationId, orgId)),
    ])
    return JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  }

  beforeEach(async () => {
    BASE = Math.floor(Date.now() / MIN) * MIN
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(BASE))
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    sent = []
    setNotifierTransport({
      async send(payload) {
        sent.push(payload)
      },
    })
    await db.delete(scheduledJobs)
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `dg-owner-${crypto.randomUUID()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Удаляемая' })).id
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    setNotifierTransport({ async send() {} })
  })

  afterAll(async () => {
    await db.delete(scheduledJobs)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('skips the deleted group in every scheduler step and resumes after restore', async () => {
    const [a, b, c, d] = await players(4)
    // split: фиксация долей при закрытии записи создала бы платежи (деньги)
    const split = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Split',
      startsAt: new Date(BASE + 48 * H),
      endsAt: new Date(BASE + 50 * H),
      capacity: 4,
      price: 0,
      priceMode: 'split',
      targetAmount: 1001,
    })
    for (const p of [a!, b!, c!])
      await bookingService.book({ userId: p.id }, orgId, split.id, { method: 'cash' })
    // «запись открыта» через 10 ч
    await eventService.create({ userId: ownerId }, orgId, {
      title: 'Opens later',
      startsAt: new Date(BASE + 72 * H),
      endsAt: new Date(BASE + 74 * H),
      capacity: 4,
      price: 1000,
      bookingOpensAt: new Date(BASE + 10 * H),
    })
    // полное событие: освободившееся место предложено первому в очереди (TTL 30 мин)
    const full = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Full',
      startsAt: new Date(BASE + 60 * H),
      endsAt: new Date(BASE + 62 * H),
      capacity: 1,
      price: 0,
    })
    const first = await bookingService.book({ userId: a!.id }, orgId, full.id, { method: 'free' })
    await bookingService.book({ userId: d!.id }, orgId, full.id, { method: 'free' })
    await bookingService.cancel({ userId: a!.id }, first.id)
    const [offer] = await db
      .select()
      .from(waitlistOffers)
      .where(eq(waitlistOffers.eventId, full.id))
    expect(offer?.status).toBe('offered')
    // уведомление, поставленное до удаления, не должно уйти после него
    await enqueueNotification(db, {
      type: 'reminder_24h',
      dedupKey: `test:dg:${orgId}`,
      organizationId: orgId,
      eventId: split.id,
      runAt: new Date(BASE + 5 * MIN),
      userId: a!.id,
      params: {
        eventTitle: 'Split',
        eventDate: split.startsAt.toISOString(),
        organizationId: orgId,
        eventId: split.id,
      },
    })
    const sentBefore = sent.length

    await organizationDeletionService.delete({ userId: ownerId }, orgId, {
      confirmName: 'Удаляемая',
    })
    const before = await groupState()
    const keysBefore = (
      await db.select().from(scheduledJobs).where(eq(scheduledJobs.organizationId, orgId))
    )
      .map((j) => j.dedupKey)
      .sort()
    expect(keysBefore).toContain(`test:dg:${orgId}`)

    // проходы через все моменты: доставка, открытие записи, истечение предложения, напоминания,
    // закрытие записи с фиксацией split
    for (const t of [10 * MIN, 10 * H + MIN, 24 * H, 30 * H, 46 * H]) {
      at(t)
      await tick()
      await tick()
    }
    await processDueJobs({ now: new Date(), paceMs: 0 })
    const after = await groupState()
    // события, записи, платежи, касса, баланс событий, абонементы и очередь не изменились
    expect(after).toBe(before)
    // новых задач не поставлено; поставленные до удаления уведомления закрыты без отправки
    const jobs = await db
      .select()
      .from(scheduledJobs)
      .where(eq(scheduledJobs.organizationId, orgId))
    expect(jobs.map((j) => j.dedupKey).sort()).toEqual(keysBefore)
    for (const job of jobs)
      expect(job).toMatchObject({ status: 'skipped', lastError: 'group_deleted' })
    expect(sent).toHaveLength(sentBefore)
    const splitNow = (await db.query.events.findFirst({ where: eq(events.id, split.id) }))!
    expect(splitNow.status).toBe('published')
    expect(splitNow.pricingSettledAt).toBeNull()
    expect(
      (await db.select().from(waitlistOffers).where(eq(waitlistOffers.id, offer!.id)))[0]!.status,
    ).toBe('offered')

    // бот не показывает события и записи удалённой группы и не даёт ими управлять
    const tg = String(b!.telegramUserId)
    expect(await botService.listGames(tg)).toEqual([])
    expect(await botService.listMyBookings(tg)).toEqual([])
    expect(await botService.cancelMyBooking(tg, split.id)).toBe('not_found')
    expect(await botService.acceptMyOffer(String(d!.telegramUserId), full.id)).toBe('not_found')
    // лента уведомлений участника не показывает уведомлений удалённой группы
    const feed = await notificationFeedService.list(a!.id)
    expect(feed.items.filter((i) => i.organizationId === orgId)).toEqual([])
    expect(await groupState()).toBe(after)

    // восстановление: обработка продолжается обычным путём
    at(46 * H + MIN)
    await organizationDeletionService.restore({ userId: ownerId }, orgId)
    await tick()
    const closed = (await db.query.events.findFirst({ where: eq(events.id, split.id) }))!
    expect(closed).toMatchObject({ status: 'closed', pricingParticipantCount: 3 })
    const paid = await db
      .select({ amount: payments.amount })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(bookings.eventId, split.id))
    expect(paid.map((p) => p.amount).sort()).toEqual([333, 334, 334])
    expect(
      (await db.select().from(waitlistOffers).where(eq(waitlistOffers.id, offer!.id)))[0]!.status,
    ).toBe('expired')
    expect((await botService.listMyBookings(tg)).length).toBeGreaterThan(0)
    expect(
      (await notificationFeedService.list(a!.id)).items.some((i) => i.organizationId === orgId),
    ).toBe(true)
  })

  it('expires pending ownership transfers on the tick and records it in the audit log', async () => {
    const [p] = await players(1)
    const member = (await db.query.organizationMembers.findFirst({
      where: (m, { and, eq: e }) => and(e(m.organizationId, orgId), e(m.userId, p!.id)),
    }))!
    await ownershipTransferService.start({ userId: ownerId }, orgId, {
      recipientMemberId: member.id,
    })
    at(72 * H - MIN)
    await tick()
    expect((await db.select().from(organizationOwnershipTransfers))[0]!.status).toBe('pending')
    at(72 * H)
    await tick()
    const [t] = await db.select().from(organizationOwnershipTransfers)
    expect(t).toMatchObject({ status: 'expired' })
    expect(t!.resolvedAt).not.toBeNull()
    const entries = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'ownership_transfer.expired'))
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ organizationId: orgId, userId: null, entityId: t!.id })
    // повторный проход не пишет второй записи
    await tick()
    expect(
      await db.select().from(auditLog).where(eq(auditLog.action, 'ownership_transfer.expired')),
    ).toHaveLength(1)
  })
})
