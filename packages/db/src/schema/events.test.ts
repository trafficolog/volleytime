import { readFile } from 'node:fs/promises'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db, eq, sql } from '../index'

import { bookings } from './bookings'
import { events } from './events'
import { organizations } from './organizations'
import { users } from './users'
import { venues } from './venues'

async function setup() {
  const [owner] = await db
    .insert(users)
    .values({ email: `o-${Math.random()}@t.by` })
    .returning()
  const [org] = await db
    .insert(organizations)
    .values({ slug: `s-${Math.random()}`.slice(0, 40), name: 'Org', ownerUserId: owner!.id })
    .returning()
  const [venue] = await db
    .insert(venues)
    .values({ organizationId: org!.id, name: 'Зал' })
    .returning()
  return { owner: owner!, org: org!, venue: venue! }
}

function baseEvent(orgId: number, creatorId: number) {
  return {
    organizationId: orgId,
    createdByUserId: creatorId,
    title: 'Тренировка',
    startsAt: new Date('2026-06-01T18:00:00Z'),
    endsAt: new Date('2026-06-01T20:00:00Z'),
    capacity: 12,
  }
}

describe('events schema (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('inserts event with defaults', async () => {
    const { org, owner } = await setup()
    const [ev] = await db.insert(events).values(baseEvent(org.id, owner.id)).returning()
    expect(ev?.type).toBe('training')
    expect(ev?.status).toBe('published')
    expect(ev?.price).toBe(0)
    expect(ev?.currency).toBe('BYN')
    expect(ev).toMatchObject({
      priceMode: 'fixed',
      targetAmount: null,
      pricingSettledAt: null,
      pricingParticipantCount: null,
    })
  })

  it('stores price as minor integer', async () => {
    const { org, owner } = await setup()
    const [ev] = await db
      .insert(events)
      .values({ ...baseEvent(org.id, owner.id), price: 1500 }) // 15.00 BYN
      .returning()
    expect(ev?.price).toBe(1500)
    expect(ev?.priceMode).toBe('fixed')
  })

  it('persists split target and settlement metadata', async () => {
    const { org, owner } = await setup()
    const settledAt = new Date('2026-06-01T17:00:00Z')
    const [ev] = await db
      .insert(events)
      .values({
        ...baseEvent(org.id, owner.id),
        priceMode: 'split',
        targetAmount: 10000,
        pricingSettledAt: settledAt,
        pricingParticipantCount: 3,
      })
      .returning()
    expect(ev).toMatchObject({
      priceMode: 'split',
      price: 0,
      targetAmount: 10000,
      pricingSettledAt: settledAt,
      pricingParticipantCount: 3,
    })
  })

  it('migrates existing fixed/free rows without changing prices or bookings', async () => {
    const { org, owner } = await setup()
    const migration = await readFile(
      new URL('../../migrations/0020_overjoyed_stick.sql', import.meta.url),
      'utf8',
    )
    // Reconstruct the previous schema inside a rollback-only test transaction.
    const rollback = new Error('rollback migration fixture')
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(
            'ALTER TABLE events DROP COLUMN price_mode, DROP COLUMN target_amount, DROP COLUMN pricing_settled_at, DROP COLUMN pricing_participant_count',
          ),
        )
        await tx.execute(sql.raw('ALTER TABLE bookings DROP COLUMN allocated_amount'))
        await tx.execute(sql.raw('DROP TYPE public.event_price_mode'))
        await tx.execute(
          sql`INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, price) VALUES (${org.id}, ${owner.id}, 'Legacy free', '2026-06-01T18:00:00Z', '2026-06-01T20:00:00Z', 4, 0), (${org.id}, ${owner.id}, 'Legacy paid', '2026-06-01T18:00:00Z', '2026-06-01T20:00:00Z', 4, 1500)`,
        )
        await tx.execute(
          sql`INSERT INTO bookings (event_id, user_id, organization_id, status, method) SELECT id, ${owner.id}, ${org.id}, 'confirmed', 'free' FROM events WHERE title = 'Legacy free'`,
        )
        for (const statement of migration.split('--> statement-breakpoint')) {
          await tx.execute(sql.raw(statement))
        }
        const rows = await tx
          .select({
            title: events.title,
            price: events.price,
            priceMode: events.priceMode,
            targetAmount: events.targetAmount,
            pricingSettledAt: events.pricingSettledAt,
            pricingParticipantCount: events.pricingParticipantCount,
          })
          .from(events)
          .orderBy(events.title)
        expect(rows).toEqual([
          {
            title: 'Legacy free',
            price: 0,
            priceMode: 'fixed',
            targetAmount: null,
            pricingSettledAt: null,
            pricingParticipantCount: null,
          },
          {
            title: 'Legacy paid',
            price: 1500,
            priceMode: 'fixed',
            targetAmount: null,
            pricingSettledAt: null,
            pricingParticipantCount: null,
          },
        ])
        expect(
          await tx
            .select({
              status: bookings.status,
              method: bookings.method,
              allocatedAmount: bookings.allocatedAmount,
              paymentId: bookings.paymentId,
            })
            .from(bookings),
        ).toEqual([{ status: 'confirmed', method: 'free', allocatedAmount: null, paymentId: null }])
        throw rollback
      }),
    ).rejects.toBe(rollback)
  })

  it.each([
    { priceMode: 'split' as const, targetAmount: null },
    { priceMode: 'split' as const, targetAmount: 0 },
    { priceMode: 'split' as const, targetAmount: 100, price: 1 },
    { priceMode: 'fixed' as const, targetAmount: 100 },
    { priceMode: 'fixed' as const, pricingSettledAt: new Date(), pricingParticipantCount: 1 },
    { priceMode: 'split' as const, targetAmount: 100, pricingParticipantCount: 1 },
    { priceMode: 'split' as const, targetAmount: 100, pricingSettledAt: new Date() },
    {
      priceMode: 'split' as const,
      targetAmount: 100,
      pricingSettledAt: new Date(),
      pricingParticipantCount: 0,
    },
  ])('rejects invalid persisted pricing metadata %#', async (pricing) => {
    const { org, owner } = await setup()
    await expect(
      db.insert(events).values({ ...baseEvent(org.id, owner.id), ...pricing }),
    ).rejects.toThrow()
  })

  it('sets venue to null when venue deleted', async () => {
    const { org, owner, venue } = await setup()
    const [ev] = await db
      .insert(events)
      .values({ ...baseEvent(org.id, owner.id), venueId: venue.id })
      .returning()
    await db.delete(venues).where(eq(venues.id, venue.id))
    const [refreshed] = await db.select().from(events).where(eq(events.id, ev!.id))
    expect(refreshed?.venueId).toBeNull()
  })

  it('restricts deleting creator user', async () => {
    const { org, owner } = await setup()
    await db.insert(events).values(baseEvent(org.id, owner.id))
    await expect(db.delete(users).where(eq(users.id, owner.id))).rejects.toThrow()
  })

  it('cascades on organization delete', async () => {
    const { org, owner } = await setup()
    await db.insert(events).values(baseEvent(org.id, owner.id))
    await db.delete(organizations).where(eq(organizations.id, org.id))
    const rows = await db.select().from(events).where(eq(events.organizationId, org.id))
    expect(rows).toHaveLength(0)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
