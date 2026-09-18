import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db, eq } from '../index'

import { bookings } from './bookings'
import { events } from './events'
import { organizations } from './organizations'
import { users } from './users'

async function setup() {
  const [owner] = await db
    .insert(users)
    .values({ email: `o-${Math.random()}@t.by` })
    .returning()
  const [player] = await db
    .insert(users)
    .values({ email: `p-${Math.random()}@t.by` })
    .returning()
  const [org] = await db
    .insert(organizations)
    .values({ slug: `s-${Math.random()}`.slice(0, 40), name: 'Org', ownerUserId: owner!.id })
    .returning()
  const [ev] = await db
    .insert(events)
    .values({
      organizationId: org!.id,
      createdByUserId: owner!.id,
      title: 'E',
      startsAt: new Date('2026-06-01T18:00:00Z'),
      endsAt: new Date('2026-06-01T20:00:00Z'),
      capacity: 10,
    })
    .returning()
  return { owner: owner!, player: player!, org: org!, ev: ev! }
}

function bk(evId: number, uId: number, orgId: number) {
  return {
    eventId: evId,
    userId: uId,
    organizationId: orgId,
    status: 'confirmed' as const,
    method: 'free' as const,
  }
}

describe('bookings schema (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('inserts booking', async () => {
    const { ev, player, org } = await setup()
    const [b] = await db
      .insert(bookings)
      .values(bk(ev.id, player.id, org.id))
      .returning()
    expect(b?.status).toBe('confirmed')
    expect(b?.method).toBe('free')
    expect(b?.bookedAt).toBeInstanceOf(Date)
  })

  it('enforces unique (event, user)', async () => {
    const { ev, player, org } = await setup()
    await db.insert(bookings).values(bk(ev.id, player.id, org.id))
    await expect(db.insert(bookings).values(bk(ev.id, player.id, org.id))).rejects.toThrow()
  })

  it('cascades on event delete', async () => {
    const { ev, player, org } = await setup()
    await db.insert(bookings).values(bk(ev.id, player.id, org.id))
    await db.delete(events).where(eq(events.id, ev.id))
    const rows = await db.select().from(bookings).where(eq(bookings.eventId, ev.id))
    expect(rows).toHaveLength(0)
  })

  it('cascades on user delete', async () => {
    const { ev, player, org } = await setup()
    await db.insert(bookings).values(bk(ev.id, player.id, org.id))
    await db.delete(users).where(eq(users.id, player.id))
    const rows = await db.select().from(bookings).where(eq(bookings.userId, player.id))
    expect(rows).toHaveLength(0)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
