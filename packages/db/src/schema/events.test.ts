import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db, eq } from '../index'

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
  })

  it('stores price as minor integer', async () => {
    const { org, owner } = await setup()
    const [ev] = await db
      .insert(events)
      .values({ ...baseEvent(org.id, owner.id), price: 1500 }) // 15.00 BYN
      .returning()
    expect(ev?.price).toBe(1500)
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
