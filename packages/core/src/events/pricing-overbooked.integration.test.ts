import {
  bookings,
  closeDb,
  db,
  eq,
  events,
  inArray,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { organizationService } from '../organizations/service'

import { readEventPriceQuote, readEventPricing } from './pricing-read-model'
import { eventPricingService } from './pricing-service'
import { eventService } from './service'

/**
 * Разбор 500 при расчёте цены, когда занятых мест больше вместимости (QA 20.5.6): список событий и
 * карточка читают `readEventPricing`, которая бросала RangeError из `previewSplitAmount`, тогда как
 * `readEventPriceQuote` уже ограничивала занятость вместимостью. Состояние возможно после
 * уменьшения вместимости и у данных, созданных до многоместной записи.
 */
describe('split pricing with seats taken above capacity', () => {
  let ownerId: number
  let orgId: number
  let eventId: number
  let people: number[] = []

  beforeEach(async () => {
    people = (
      await db
        .insert(users)
        .values(
          Array.from({ length: 3 }, (_, i) => ({
            email: `overbooked-${crypto.randomUUID()}-${i}@test.by`,
          })),
        )
        .returning()
    ).map((p) => p.id)
    ownerId = people[0]!
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Overbooked' })).id
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
        title: 'Overbooked',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 4,
        priceMode: 'split',
        targetAmount: 10000,
      })
    ).id
    await db.insert(bookings).values(
      people.slice(1).map((userId) => ({
        eventId,
        userId,
        organizationId: orgId,
        status: 'confirmed' as const,
        method: 'cash' as const,
        seats: 3,
      })),
    )
    // 6 занятых мест при вместимости 4
    await db.update(events).set({ capacity: 4 }).where(eq(events.id, eventId))
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(users).where(inArray(users.id, people))
  })
  afterAll(closeDb)

  it('readEventPricing clamps the roster to capacity instead of throwing', async () => {
    const pricing = await readEventPricing({ userId: ownerId }, eventId)
    expect(pricing).toMatchObject({ mode: 'split', participantCount: 4, basis: 'current' })
    expect(pricing.minAmount).toBe(2500)
  })

  it('the price quote agrees with the clamped forecast', async () => {
    const quote = await readEventPriceQuote(
      { userId: ownerId },
      { organizationId: orgId, eventId, includeDrafts: true },
    )
    expect(quote.seatCount).toEqual({ current: 4, max: 4 })
  })

  it('settlement is refused: it would split over actual seats, the forecast over capacity', async () => {
    await expect(
      eventPricingService.settle({ userId: ownerId }, orgId, eventId),
    ).rejects.toMatchObject({
      code: 'event.split_over_capacity',
    })
    // доли не зафиксированы, записи не тронуты
    const after = await db.select().from(bookings).where(eq(bookings.eventId, eventId))
    expect(after.every((b) => b.allocatedAmount === null && b.status === 'confirmed')).toBe(true)
  })
})
