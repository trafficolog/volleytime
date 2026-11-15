import {
  appendEventBalanceEntry,
  asc,
  closeDb,
  db,
  eq,
  notifications,
  organizations,
  payments,
  and,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { collectionService } from '../collections/service'
import { EVENT_BALANCE_LOW_THRESHOLD, eventBalanceService } from '../event-balance'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { createNotificationCollector } from './collect'
import { notifierService, setNotifierTransport } from './service'
import type { NotifyPayload } from './types'
import { notificationFeedService } from './feed'

/**
 * Task 21.4.5: новые виды ленты организатора. Тип записи в БД — `organizer_action_required`
 * (схема не меняется), вид определяет `payload.params.kind`.
 */
const future = (h = 24) => new Date(Date.now() + h * 3600_000)
const previousFlag = process.env.EVENT_BALANCE_ENFORCED

let ownerId: number
let organizerId: number
let otherOwnerId: number
let orgId: number
let otherOrgId: number

async function newUser(name: string) {
  const [u] = await db
    .insert(users)
    .values({ email: `of-${Math.random()}@t.by`, name })
    .returning()
  return u!.id
}

async function addMember(userId: number, role?: 'organizer') {
  const m = await memberService.add({ userId: ownerId }, { organizationId: orgId, userId })
  if (role) await memberService.changeRole({ userId: ownerId }, m.id, role)
}

async function paidEvent(title = 'Основа', extra: Record<string, unknown> = {}) {
  return eventService.create({ userId: ownerId }, orgId, {
    title,
    startsAt: future(),
    endsAt: future(26),
    capacity: 10,
    price: 1500,
    ...extra,
  })
}

async function pendingPaymentIds() {
  const rows = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.organizationId, orgId), eq(payments.status, 'pending')))
    .orderBy(asc(payments.id))
  return rows.map((r) => r.id)
}

interface FeedRow {
  id: number
  type: string
  eventId: number | null
  params: Record<string, unknown>
  readAt: Date | null
}

async function feedOf(userId: number, kind?: string): Promise<FeedRow[]> {
  const page = await notificationFeedService.list(userId, { limit: 100 })
  return page.items
    .map((i) => ({
      id: i.id,
      type: i.type,
      eventId: i.eventId,
      params: ((i.payload as { params?: Record<string, unknown> }).params ?? {}) as Record<
        string,
        unknown
      >,
      readAt: i.readAt,
    }))
    .filter((i) => i.type === 'organizer_action_required' && (!kind || i.params.kind === kind))
}

describe('organizer feed kinds (21.4.5)', { timeout: 60_000 }, () => {
  beforeEach(async () => {
    vi.stubEnv('COLLECTIONS_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('Owner')
    organizerId = await newUser('Organizer')
    otherOwnerId = await newUser('OtherOwner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Org A' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Org B' })).id
    await addMember(organizerId, 'organizer')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('booking_created', () => {
    it('managers of the group get one row, the player and other groups get none', async () => {
      const ev = await paidEvent('Открытая игра', { price: 0 })
      const player = await newUser('Денис')
      await addMember(player)
      const b = await bookingService.book({ userId: player }, orgId, ev.id, { method: 'free' })

      for (const manager of [ownerId, organizerId]) {
        const rows = await feedOf(manager, 'booking_created')
        expect(rows).toHaveLength(1)
        expect(rows[0]!.eventId).toBe(ev.id)
        expect(rows[0]!.params).toMatchObject({
          kind: 'booking_created',
          playerName: 'Денис',
          eventTitle: 'Открытая игра',
          seats: 1,
          organizationId: orgId,
        })
      }
      expect(await feedOf(player)).toHaveLength(0)
      expect(await feedOf(otherOwnerId)).toHaveLength(0)
      const keys = await db
        .select({ k: notifications.dedupKey })
        .from(notifications)
        .where(eq(notifications.recipientUserId, ownerId))
      expect(keys.map((k) => k.k)).toContain(
        `organizer_action_required:booking_created:booking:${b.id}:1`,
      )
    })

    it('a manager who books is not notified about her own booking', async () => {
      const ev = await paidEvent('Игра', { price: 0 })
      await bookingService.book({ userId: organizerId }, orgId, ev.id, { method: 'free' })
      expect(await feedOf(organizerId, 'booking_created')).toHaveLength(0)
      expect(await feedOf(ownerId, 'booking_created')).toHaveLength(1)
    })

    it('rebooking after cancellation is a new incarnation and a new notification', async () => {
      const ev = await paidEvent('Игра', { price: 0 })
      const player = await newUser('Аня')
      await addMember(player)
      const b = await bookingService.book({ userId: player }, orgId, ev.id, { method: 'free' })
      await bookingService.cancel({ userId: player }, b.id)
      await bookingService.book({ userId: player }, orgId, ev.id, { method: 'free' })
      expect(await feedOf(ownerId, 'booking_created')).toHaveLength(2)
    })
  })

  describe('booking_cancelled', () => {
    it('carries seats, paid money (D-14) and the waitlist hand-off', async () => {
      const ev = await paidEvent('Основа', { price: 1500, capacity: 1 })
      const p1 = await newUser('Катя')
      const p2 = await newUser('Игрок2')
      await addMember(p1)
      await addMember(p2)
      const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'cash' })
      const [paymentId] = await pendingPaymentIds()
      await paymentService.confirm({ userId: ownerId }, paymentId!, { orgId })
      await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })

      await bookingService.cancel({ userId: p1 }, b1.id)

      const rows = await feedOf(ownerId, 'booking_cancelled')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.params).toMatchObject({
        kind: 'booking_cancelled',
        playerName: 'Катя',
        eventTitle: 'Основа',
        seats: 1,
        paidSeats: 1,
        paidAmount: 1500,
        promotedFromWaitlist: true,
      })
      expect(rows[0]!.eventId).toBe(ev.id)
      expect(await feedOf(otherOwnerId, 'booking_cancelled')).toHaveLength(0)
      expect(await feedOf(p1, 'booking_cancelled')).toHaveLength(0)
    })

    it('repeated cancellation does not duplicate the notification', async () => {
      const ev = await paidEvent('Игра', { price: 0 })
      const player = await newUser('Аня')
      await addMember(player)
      const b = await bookingService.book({ userId: player }, orgId, ev.id, { method: 'free' })
      await bookingService.cancel({ userId: player }, b.id)
      await bookingService.cancel({ userId: player }, b.id)
      const rows = await feedOf(ownerId, 'booking_cancelled')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.params).toMatchObject({ promotedFromWaitlist: false, paidSeats: 0 })
    })
  })

  describe('payments_pending aggregate', () => {
    it('keeps one open row per manager, counts only unprocessed payments and reopens', async () => {
      const ev = await paidEvent('Основа')
      const ev2 = await paidEvent('Микст')
      const players = [await newUser('A'), await newUser('B'), await newUser('C')]
      for (const p of players) await addMember(p)
      await bookingService.book({ userId: players[0]! }, orgId, ev.id, { method: 'cash' })
      await bookingService.book({ userId: players[1]! }, orgId, ev2.id, { method: 'cash' })

      let rows = await feedOf(ownerId, 'payments_pending')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.params).toMatchObject({ kind: 'payments_pending', count: 2 })
      expect(rows[0]!.params.eventTitles).toEqual(expect.arrayContaining(['Основа', 'Микст']))
      expect(typeof rows[0]!.params.oldestAt).toBe('string')
      expect(rows[0]!.readAt).toBeNull()

      // третий платёж: та же строка, счётчик растёт
      await bookingService.book({ userId: players[2]! }, orgId, ev.id, { method: 'cash' })
      rows = await feedOf(ownerId, 'payments_pending')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.params.count).toBe(3)

      // обработанные (подтверждённый и отклонённый) в счёт не входят
      const pending = await pendingPaymentIds()
      await paymentService.confirm({ userId: ownerId }, pending[0]!, { orgId })
      await paymentService.cancel({ userId: ownerId }, pending[1]!, { orgId })
      rows = await feedOf(ownerId, 'payments_pending')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.params.count).toBe(1)

      await paymentService.confirm({ userId: ownerId }, pending[2]!, { orgId })
      rows = await feedOf(ownerId, 'payments_pending')
      expect(rows[0]!.params.count).toBe(0)
      expect(rows[0]!.readAt).not.toBeNull()

      // новый платёж после обработки всех — новая непрочитанная строка
      const late = await newUser('D')
      await addMember(late)
      await bookingService.book({ userId: late }, orgId, ev.id, { method: 'cash' })
      rows = await feedOf(ownerId, 'payments_pending')
      expect(rows).toHaveLength(2)
      const open = rows.filter((r) => r.params.count === 1)
      expect(open).toHaveLength(1)
      expect(open[0]!.readAt).toBeNull()
    })

    it('a growing count marks the row unread again; other groups and players see nothing', async () => {
      const ev = await paidEvent('Основа')
      const a = await newUser('A')
      const b = await newUser('B')
      await addMember(a)
      await addMember(b)
      await bookingService.book({ userId: a }, orgId, ev.id, { method: 'cash' })
      const [first] = await feedOf(ownerId, 'payments_pending')
      await notificationFeedService.markRead(ownerId, { ids: [first!.id] })
      await bookingService.book({ userId: b }, orgId, ev.id, { method: 'cash' })
      const [after] = await feedOf(ownerId, 'payments_pending')
      expect(after!.id).toBe(first!.id)
      expect(after!.params.count).toBe(2)
      expect(after!.readAt).toBeNull()
      expect(await feedOf(otherOwnerId, 'payments_pending')).toHaveLength(0)
      expect(await feedOf(a, 'payments_pending')).toHaveLength(0)
    })
  })

  describe('event_balance_low', () => {
    async function setBalance(n: number) {
      const current = (await eventBalanceService.get({ userId: ownerId }, orgId)).balance
      if (current === n) return
      await db.transaction((tx) =>
        appendEventBalanceEntry(tx, {
          organizationId: orgId,
          delta: n - current,
          reason: 'correction',
          actor: { kind: 'user', userId: ownerId },
          comment: 'test setup',
        }),
      )
    }
    const publish = (title: string) =>
      eventService.create({ userId: ownerId }, orgId, {
        title,
        startsAt: future(),
        endsAt: future(26),
        capacity: 5,
        price: 0,
      })

    it('fires once when the balance crosses the threshold, owner only, no repeats', async () => {
      process.env.EVENT_BALANCE_ENFORCED = 'true'
      await setBalance(EVENT_BALANCE_LOW_THRESHOLD + 1)
      await publish('Игра 1') // остаток = порог
      let rows = await feedOf(ownerId, 'event_balance_low')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.params).toMatchObject({
        kind: 'event_balance_low',
        balance: EVENT_BALANCE_LOW_THRESHOLD,
        threshold: EVENT_BALANCE_LOW_THRESHOLD,
        organizationId: orgId,
      })
      await publish('Игра 2') // ниже порога — без повтора
      await publish('Игра 3')
      rows = await feedOf(ownerId, 'event_balance_low')
      expect(rows).toHaveLength(1)
      expect(await feedOf(organizerId, 'event_balance_low')).toHaveLength(0)
      expect(await feedOf(otherOwnerId, 'event_balance_low')).toHaveLength(0)

      // пополнение и повторное пересечение — новое уведомление
      await setBalance(EVENT_BALANCE_LOW_THRESHOLD + 1)
      await publish('Игра 4')
      expect(await feedOf(ownerId, 'event_balance_low')).toHaveLength(2)
    })

    it('does not fire while above the threshold or with enforcement off', async () => {
      process.env.EVENT_BALANCE_ENFORCED = 'true'
      await setBalance(EVENT_BALANCE_LOW_THRESHOLD + 5)
      await publish('Игра')
      expect(await feedOf(ownerId, 'event_balance_low')).toHaveLength(0)
      process.env.EVENT_BALANCE_ENFORCED = 'false'
      await setBalance(EVENT_BALANCE_LOW_THRESHOLD + 1)
      await publish('Игра 2')
      expect(await feedOf(ownerId, 'event_balance_low')).toHaveLength(0)
    })
  })

  describe('collection pledge deep link', () => {
    it('carries collectionId and a collection target for the bot button', async () => {
      const player = await newUser('Соня')
      await addMember(player)
      const c = await collectionService.create({ userId: ownerId }, orgId, {
        title: 'Новый комплект мячей',
        targetAmount: 25_000,
      })
      const collector = createNotificationCollector()
      await collectionService.contribute(
        { userId: player, notifications: collector },
        orgId,
        c.id,
        {
          amount: 2000,
          method: 'cash',
        },
      )
      const pending = collector.filter((n) => n.type === 'payment_pending_organizer')
      expect(pending.length).toBeGreaterThan(0)
      for (const n of pending) {
        expect(n.params.collectionId).toBe(c.id)
        expect(n.params.target).toBe('collection')
      }
    })

    it('the bot button «Открыть» opens that collection in the Mini App', async () => {
      vi.stubEnv('NUXT_PUBLIC_WEB_URL', 'https://app.example')
      await db.update(users).set({ telegramUserId: 9001n }).where(eq(users.id, ownerId))
      const player = await newUser('Соня')
      await addMember(player)
      const c = await collectionService.create({ userId: ownerId }, orgId, {
        title: 'Мячи',
        targetAmount: 25_000,
      })
      const collector = createNotificationCollector()
      await collectionService.contribute(
        { userId: player, notifications: collector },
        orgId,
        c.id,
        {
          amount: 2000,
          method: 'cash',
        },
      )
      const n = collector.find((x) => x.userId === ownerId)!
      const sent: NotifyPayload[] = []
      setNotifierTransport({
        async send(p) {
          sent.push(p)
        },
      })
      await notifierService.deliver(ownerId, n.type, n.params)
      expect(sent[0]!.keyboard?.[0]?.[0]).toMatchObject({
        text: 'Открыть',
        webAppUrl: `https://app.example/m/orgs/${orgId}/collections/${c.id}`,
      })
    })
  })

  describe('concurrent recount of the pending aggregate (review I1/I2)', () => {
    const rounds = 5

    it('parallel confirmations in different events leave the exact count and close at 0', async () => {
      const third = await newUser('Third')
      await addMember(third, 'organizer')
      for (let r = 0; r < rounds; r++) {
        const evA = await paidEvent(`A${r}`)
        const evB = await paidEvent(`B${r}`)
        const players = [await newUser('p'), await newUser('q'), await newUser('s')]
        for (const p of players) await addMember(p)
        await bookingService.book({ userId: players[0]! }, orgId, evA.id, { method: 'cash' })
        await bookingService.book({ userId: players[1]! }, orgId, evB.id, { method: 'cash' })
        await bookingService.book({ userId: players[2]! }, orgId, evB.id, { method: 'cash' })
        const pending = await pendingPaymentIds()
        expect(pending).toHaveLength(3)
        // два подтверждения параллельно: остаётся один ожидающий платёж
        await Promise.all([
          paymentService.confirm({ userId: ownerId }, pending[0]!, { orgId }),
          paymentService.confirm({ userId: organizerId }, pending[1]!, { orgId }),
        ])
        for (const m of [ownerId, organizerId, third]) {
          const open = (await feedOf(m, 'payments_pending')).filter((x) => x.params.count !== 0)
          expect(open).toHaveLength(1)
          expect(open[0]!.params.count).toBe(1)
        }
        await paymentService.confirm({ userId: ownerId }, pending[2]!, { orgId })
        for (const m of [ownerId, organizerId, third]) {
          const rows = await feedOf(m, 'payments_pending')
          expect(rows.every((x) => x.params.count === 0 && x.readAt !== null)).toBe(true)
        }
      }
    })

    it('parallel pending payments in different events open exactly one row per manager', async () => {
      const third = await newUser('Third')
      await addMember(third, 'organizer')
      for (let r = 0; r < rounds; r++) {
        await db.delete(notifications).where(eq(notifications.organizationId, orgId))
        await db.delete(payments).where(eq(payments.organizationId, orgId))
        const evs = [
          await paidEvent(`E1-${r}`),
          await paidEvent(`E2-${r}`),
          await paidEvent(`E3-${r}`),
        ]
        const players = [await newUser('p'), await newUser('q'), await newUser('s')]
        for (const p of players) await addMember(p)
        await Promise.all(
          players.map((p, i) =>
            bookingService.book({ userId: p }, orgId, evs[i]!.id, { method: 'cash' }),
          ),
        )
        for (const m of [ownerId, organizerId, third]) {
          const rows = await feedOf(m, 'payments_pending')
          expect(rows).toHaveLength(1)
          expect(rows[0]!.params.count).toBe(3)
        }
      }
    })
  })

  it('cancellation by a manager is marked byManager', async () => {
    const ev = await paidEvent('Игра', { price: 0 })
    const player = await newUser('Катя')
    await addMember(player)
    const b = await bookingService.book({ userId: player }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: organizerId }, b.id, { byAdmin: true })
    const rows = await feedOf(ownerId, 'booking_cancelled')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.params.byManager).toBe(true)
    // автор действия не получает уведомление о собственной отмене
    expect(await feedOf(organizerId, 'booking_cancelled')).toHaveLength(0)
  })

  it('a feed write failure does not roll back the money operation', async () => {
    const ev = await paidEvent('Игра')
    const player = await newUser('Катя')
    await addMember(player)
    await bookingService.book({ userId: player }, orgId, ev.id, { method: 'cash' })
    const [pid] = await pendingPaymentIds()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // сломанный тип ломает вставку ленты внутри savepoint
    await db.execute(
      sql`ALTER TABLE notifications ADD CONSTRAINT feed_break CHECK (type <> 'organizer_action_required') NOT VALID`,
    )
    try {
      await paymentService.confirm({ userId: ownerId }, pid!, { orgId })
    } finally {
      await db.execute(sql`ALTER TABLE notifications DROP CONSTRAINT feed_break`)
      spy.mockRestore()
    }
    const [p] = await db.select().from(payments).where(eq(payments.id, pid!))
    expect(p!.status).toBe('succeeded')
  })

  it('nothing is written for another group', async () => {
    const ev = await paidEvent('Игра', { price: 0 })
    const player = await newUser('P')
    await addMember(player)
    await bookingService.book({ userId: player }, orgId, ev.id, { method: 'free' })
    const rows = await db
      .select({ r: notifications.recipientUserId })
      .from(notifications)
      .where(eq(notifications.organizationId, otherOrgId))
    expect(rows).toHaveLength(0)
  })
})
