import { closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'
import { venueService } from '../venues/service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `f5-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

describe('Phase 5 — end-to-end flows (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Flow5 Club' })
    orgId = org.id
  })

  it('FULL: venue → event → subscription → book → attend', async () => {
    // организатор готовит инфраструктуру
    const venue = await venueService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Зал №1', capacityHint: 12 },
    )
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Тренировка',
      venueId: venue.id,
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
      price: 1500,
    })
    const plan = await planService.create(
      { userId: ownerId },
      {
        organizationId: orgId,
        name: 'Абонемент 8',
        totalSessions: 8,
        validityDays: 60,
        price: 8000,
      },
    )

    // игрок покупает абонемент и записывается
    const pid = await newPlayer()
    const sub = await subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
      autoActivate: true,
    })
    const booking = await bookingService.book({ userId: pid }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub.id,
    })

    expect(booking.status).toBe('confirmed')
    expect((await subscriptionService.getById({ userId: pid }, sub.id)).usedSessions).toBe(1)

    // организатор отмечает посещаемость
    await db
      .update(events)
      .set({ startsAt: new Date(Date.now() - 3600_000) })
      .where(eq(events.id, ev.id))
    await bookingService.bulkAttendance({ userId: ownerId }, orgId, ev.id, [
      { bookingId: booking.id, attended: true },
    ])
    expect((await bookingService.getById({ userId: ownerId }, booking.id)).status).toBe('attended')
  })

  it('FULL: waitlist → cancel → promotion → subscription restored', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Малый зал',
      startsAt: future(),
      endsAt: future(26),
      capacity: 1,
      price: 1500,
    })
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Абонемент', totalSessions: 5 },
    )

    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const sub1 = await subscriptionService.createFromPlan({ userId: p1 }, orgId, plan.id, {
      autoActivate: true,
    })

    // p1 занимает единственное место абонементом
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, {
      method: 'subscription',
      subscriptionId: sub1.id,
    })
    expect(b1.status).toBe('confirmed')
    expect((await subscriptionService.getById({ userId: p1 }, sub1.id)).usedSessions).toBe(1)

    // p2 в лист ожидания
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })
    expect(b2.status).toBe('waitlisted')

    // p1 отменяет → сессия возвращается, p2 продвигается
    const { promoted } = await bookingService.cancel({ userId: p1 }, b1.id)
    expect((await subscriptionService.getById({ userId: p1 }, sub1.id)).usedSessions).toBe(0)
    expect(promoted?.id).toBe(b2.id)
    expect(promoted?.status).toBe('pending_payment') // платное событие
  })

  it('INVARIANT: capacity never exceeded across mixed methods', async () => {
    const CAP = 2
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Смешанное',
      startsAt: future(),
      endsAt: future(26),
      capacity: CAP,
      price: 1500,
    })
    const plan = await planService.create(
      { userId: ownerId },
      { organizationId: orgId, name: 'Абонемент', totalSessions: 5 },
    )

    // 5 игроков: часть абонементом, часть налом — параллельно
    const players = await Promise.all(Array.from({ length: 5 }, () => newPlayer()))
    const subs = await Promise.all(
      players.slice(0, 2).map((pid) =>
        subscriptionService.createFromPlan({ userId: pid }, orgId, plan.id, {
          autoActivate: true,
        }),
      ),
    )

    const results = await Promise.allSettled([
      bookingService.book({ userId: players[0]! }, orgId, ev.id, {
        method: 'subscription',
        subscriptionId: subs[0]!.id,
      }),
      bookingService.book({ userId: players[1]! }, orgId, ev.id, {
        method: 'subscription',
        subscriptionId: subs[1]!.id,
      }),
      bookingService.book({ userId: players[2]! }, orgId, ev.id, { method: 'cash' }),
      bookingService.book({ userId: players[3]! }, orgId, ev.id, { method: 'cash' }),
      bookingService.book({ userId: players[4]! }, orgId, ev.id, { method: 'cash' }),
    ])

    const occupying = results.filter(
      (r) => r.status === 'fulfilled' && ['confirmed', 'pending_payment'].includes(r.value.status),
    ).length
    // критичный инвариант: занятых мест ровно capacity, остальные в waitlist
    expect(occupying).toBe(CAP)
  })

  it('SECURITY: cannot book event of another organization', async () => {
    const [u2] = await db
      .insert(users)
      .values({ email: `o2-${Math.random()}@t.by` })
      .returning()
    const otherOrg = await organizationService.create({ userId: u2!.id }, { name: 'Other Club' })
    const foreignEvent = await eventService.create({ userId: u2!.id }, otherOrg.id, {
      title: 'Чужое',
      startsAt: future(),
      endsAt: future(26),
      capacity: 10,
    })
    const pid = await newPlayer() // участник нашей org
    await expect(
      bookingService.book({ userId: pid }, orgId, foreignEvent.id, { method: 'free' }),
    ).rejects.toThrow()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
