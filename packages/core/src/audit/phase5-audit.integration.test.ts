import { auditLog, closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { planService } from '../subscription-plans/service'
import { subscriptionService } from '../subscriptions/service'
import { venueService } from '../venues/service'

/** Task 5.13.12 (review 5 P1#12): мутации Phase 5 оставляют audit-записи. */
describe('Phase 5 audit wiring (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('records events, bookings, subscriptions, plans, venues', async () => {
    const [o] = await db.insert(users).values({ email: 'a5-owner@t.by' }).returning()
    const [p1] = await db.insert(users).values({ email: 'a5-p1@t.by' }).returning()
    const [p2] = await db.insert(users).values({ email: 'a5-p2@t.by' }).returning()
    const own = { userId: o!.id }
    const org = await organizationService.create(own, { name: 'Audit 5' })
    await memberService.add(own, { organizationId: org.id, userId: p1!.id })
    await memberService.add(own, { organizationId: org.id, userId: p2!.id })

    const venue = await venueService.create(own, { organizationId: org.id, name: 'Зал' })
    await venueService.update(own, venue.id, { address: 'ул. Мира, 1' })
    const plan = await planService.create(own, {
      organizationId: org.id,
      name: 'Восемь',
      totalSessions: 8,
      price: 8000,
    })
    await planService.update(own, plan.id, { price: 9000 })
    await subscriptionService.purchase({ userId: p1!.id }, org.id, plan.id, { method: 'cash' })

    const ev = await eventService.create(own, org.id, {
      title: 'Тренировка',
      startsAt: new Date(Date.now() + 86400_000),
      endsAt: new Date(Date.now() + 93600_000),
      capacity: 1,
      price: 0,
      venueId: venue.id,
    })
    await eventService.update(own, ev.id, { title: 'Тренировка (зал 2)' })
    const b1 = await bookingService.book({ userId: p1!.id }, org.id, ev.id, { method: 'free' })
    await bookingService.book({ userId: p2!.id }, org.id, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: p1!.id }, b1.id)
    await db
      .update(events)
      .set({ startsAt: new Date(Date.now() - 1000) })
      .where(eq(events.id, ev.id))
    const promoted = await db.query.bookings.findFirst({
      where: (b, { and, eq: e }) => and(e(b.eventId, ev.id), e(b.userId, p2!.id)),
    })
    await bookingService.bulkAttendance(own, org.id, ev.id, [
      { bookingId: promoted!.id, attended: true },
    ])
    await planService.archive(own, plan.id)
    await venueService.archive(own, venue.id)

    const actions = (
      await db.select().from(auditLog).where(eq(auditLog.organizationId, org.id))
    ).map((r) => r.action)
    for (const a of [
      'venue.created',
      'venue.updated',
      'plan.created',
      'plan.updated',
      'subscription.purchased',
      'event.created',
      'event.updated',
      'booking.created',
      'booking.cancelled',
      'booking.promoted',
      'booking.attendance_marked',
      'plan.archived',
      'venue.archived',
    ]) {
      expect(actions).toContain(a)
    }
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
