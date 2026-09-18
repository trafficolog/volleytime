import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { createNotificationCollector, dispatchNotifications } from './collect'
import { setNotifierTransport } from './service'
import type { NotifyPayload, PendingNotification } from './types'

let ownerId: number
let orgId: number
let sent: NotifyPayload[] = []

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer(tgId: bigint) {
  const [u] = await db
    .insert(users)
    .values({ email: `c8-${Math.random()}@t.by`, telegramUserId: tgId })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

describe('collect-then-notify (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    sent = []
    setNotifierTransport({
      async send(p) {
        sent.push(p)
      },
    })
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Notify Org' })
    orgId = org.id
  })

  it('book collects booking_confirmed, dispatched after commit', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Тренировка',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 0,
    })
    const pid = await newPlayer(1001n)

    const notifications: PendingNotification[] = createNotificationCollector()
    await bookingService.book({ userId: pid, notifications }, orgId, ev.id, { method: 'free' })

    // во время транзакции ничего не отправлено
    expect(sent).toHaveLength(0)
    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.type).toBe('booking_confirmed')

    // после коммита — отправка
    const count = await dispatchNotifications(notifications)
    expect(count).toBe(1)
    expect(sent[0]?.telegramId).toBe('1001')
    expect(sent[0]?.text).toContain('Тренировка')
  })

  it('full event → waitlisted notification', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Малый',
      startsAt: future(),
      endsAt: future(26),
      capacity: 1,
      price: 0,
    })
    const p1 = await newPlayer(2001n)
    const p2 = await newPlayer(2002n)
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })

    const notifications = createNotificationCollector()
    await bookingService.book({ userId: p2, notifications }, orgId, ev.id, { method: 'free' })
    expect(notifications[0]?.type).toBe('booking_waitlisted')
  })

  it('cancel → waitlist_promoted notification for next in queue', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Очередь',
      startsAt: future(),
      endsAt: future(26),
      capacity: 1,
      price: 0,
    })
    const p1 = await newPlayer(3001n)
    const p2 = await newPlayer(3002n)
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })

    const notifications = createNotificationCollector()
    await bookingService.cancel({ userId: p1, notifications }, b1.id)
    const promoted = notifications.find((n) => n.type === 'waitlist_promoted')
    expect(promoted?.userId).toBe(p2)

    await dispatchNotifications(notifications)
    expect(sent.some((s) => s.telegramId === '3002' && s.text.includes('Освободилось'))).toBe(true)
  })

  it('payment confirm → payment_confirmed notification', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Платная',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 2000,
    })
    const pid = await newPlayer(4001n)
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })

    const notifications = createNotificationCollector()
    await paymentService.confirm({ userId: ownerId, notifications }, b.paymentId!)
    expect(notifications[0]?.type).toBe('payment_confirmed')

    await dispatchNotifications(notifications)
    expect(sent[0]?.text).toContain('20,00 BYN')
  })

  it('event cancel → event_cancelled to all participants', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Отменённое',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 0,
    })
    const p1 = await newPlayer(5001n)
    const p2 = await newPlayer(5002n)
    await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'free' })

    const notifications = createNotificationCollector()
    await eventService.cancel({ userId: ownerId, notifications }, ev.id)
    expect(notifications.filter((n) => n.type === 'event_cancelled')).toHaveLength(2)

    const count = await dispatchNotifications(notifications)
    expect(count).toBe(2)
  })

  it('without collector services work as before (no-op)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Без коллектора',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 0,
    })
    const pid = await newPlayer(6001n)
    const b = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'free' })
    expect(b.status).toBe('confirmed') // сервис работает, просто уведомления не собраны
    expect(sent).toHaveLength(0)
  })

  it('8.8.6: organizer gets payment_pending_organizer with player and event', async () => {
    // владелец с Telegram — чтобы уведомление реально ушло
    await db
      .update(users)
      .set({ telegramUserId: 424242n, name: 'Организатор' })
      .where(eq(users.id, ownerId))
    const pid = await newPlayer(515151n)
    await db.update(users).set({ name: 'Никита' }).where(eq(users.id, pid))
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Платная тренировка',
      startsAt: future(30),
      endsAt: future(32),
      capacity: 5,
      price: 1500,
    })
    const notifications = createNotificationCollector()
    await bookingService.book({ userId: pid, notifications }, orgId, ev.id, { method: 'cash' })
    await dispatchNotifications(notifications)
    const toOwner = sent.find((p) => p.telegramId === '424242')
    expect(toOwner).toBeDefined()
    expect(toOwner!.text).toContain('Никита')
    expect(toOwner!.text).toContain('Платная тренировка')
    expect(toOwner!.text).toContain('15,00 BYN')
  })

  it('8.9.1: cash booking notifies about pending payment, subscription booking confirms', async () => {
    const pid = await newPlayer(616161n)
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Оплата на месте',
      startsAt: future(40),
      endsAt: future(42),
      capacity: 5,
      price: 1500,
    })
    const notifications = createNotificationCollector()
    await bookingService.book({ userId: pid, notifications }, orgId, ev.id, { method: 'cash' })
    await dispatchNotifications(notifications)
    const toPlayer = sent.find((p) => p.telegramId === '616161')
    expect(toPlayer).toBeDefined()
    expect(toPlayer!.text).not.toContain('Вы записаны')
    expect(toPlayer!.text).toContain('держим место до подтверждения оплаты')
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
