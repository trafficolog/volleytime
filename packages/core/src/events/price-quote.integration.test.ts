import {
  bookings,
  closeDb,
  db,
  eq,
  inArray,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { behindEventLock } from '../__tests__/event-lock-barrier'
import { bookingService } from '../bookings/service'
import { organizationService } from '../organizations/service'

import { readEventPriceQuote } from './pricing-read-model'
import { eventPricingService } from './pricing-service'
import { eventService } from './service'

/**
 * Task 20.1.1: цена из `readEventPriceQuote` под гонкой «отмена в последнюю минуту ↔ закрытие
 * записи». Порядок фиксирует реальный advisory-lock события (behindEventLock).
 */
describe('price quote under last-minute cancel vs settle (20.1.1)', { timeout: 30_000 }, () => {
  let ownerId: number
  let orgId: number
  let eventId: number
  let people: number[] = []
  const target = 10001
  const quoteFor = (userId: number) =>
    readEventPriceQuote({ userId }, { organizationId: orgId, eventId, includeDrafts: false })
  const reserve = (index: number) =>
    bookingService.book({ userId: people[index]! }, orgId, eventId, { method: 'cash' })

  beforeEach(async () => {
    people = (
      await db
        .insert(users)
        .values(
          Array.from({ length: 5 }, (_, i) => ({
            email: `price-race-${crypto.randomUUID()}-${i}@test.by`,
          })),
        )
        .returning()
    ).map((p) => p.id)
    ownerId = people[0]!
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Price race' })).id
    await db.insert(organizationMembers).values(
      people.slice(1).map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    eventId = (
      await eventService.create({ userId: ownerId }, orgId, {
        title: 'Price race',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 4,
        priceMode: 'split',
        targetAmount: target,
      })
    ).id
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(users).where(inArray(users.id, people))
  })
  afterAll(closeDb)

  it.each([true, false])(
    'every allocated player is quoted exactly their share; sum equals target: settle first=%s',
    async (settleFirst) => {
      const booked = [await reserve(1), await reserve(2), await reserve(3)]
      expect(await quoteFor(people[1]!)).toMatchObject({
        basis: 'forecast',
        perSeat: { min: 2500, max: 3334 },
      })
      const settle = () => eventPricingService.settle({ userId: ownerId }, orgId, eventId)
      const cancel = () => bookingService.cancel({ userId: people[3]! }, booked[2]!.id)
      const results = await behindEventLock(
        eventId,
        settleFirst ? [settle, cancel] : [cancel, settle],
      )
      expect(results.map((r) => r.status)).toEqual(
        settleFirst ? ['fulfilled', 'rejected'] : ['fulfilled', 'fulfilled'],
      )
      const participants = settleFirst ? 3 : 2
      const rows = await db.select().from(bookings).where(eq(bookings.eventId, eventId))
      const allocated = rows.filter((b) => b.allocatedAmount !== null)
      expect(allocated).toHaveLength(participants)
      expect(allocated.reduce((sum, b) => sum + b.allocatedAmount!, 0)).toBe(target)
      for (const b of allocated)
        expect(await quoteFor(b.userId)).toMatchObject({
          basis: 'settled',
          total: { min: b.allocatedAmount, max: b.allocatedAmount },
          seatCount: { current: participants, max: participants },
        })
      // после фиксации отмена организатором не меняет цену оставшимся
      await bookingService.cancel({ userId: ownerId }, allocated[0]!.id, { byAdmin: true })
      expect(await quoteFor(allocated[1]!.userId)).toMatchObject({
        total: { min: allocated[1]!.allocatedAmount, max: allocated[1]!.allocatedAmount },
        seatCount: { current: participants, max: participants },
      })
      // отменивший до закрытия игрок видит диапазон зафиксированного деления, а не свою долю
      if (!settleFirst)
        expect(await quoteFor(people[3]!)).toMatchObject({
          basis: 'settled',
          perSeat: { min: 5000, max: 5001 },
          total: { min: 5000, max: 5001 },
        })
    },
  )
})
