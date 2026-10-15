import { bookingService, eventService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** 20.4.10: уровень игрока в составе события только для участников группы (HTTP, IDOR). */
describe('event roster level (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let outsiderId: number
  let orgId: number
  let eventId: number

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `roster-${tag}-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    playerId = await newUser('player')
    outsiderId = await newUser('outsider')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Roster HTTP' })).id
    await db
      .insert(organizationMembers)
      .values({ userId: playerId, organizationId: orgId, role: 'player', status: 'active' })
    eventId = (
      await eventService.create({ userId: ownerId }, orgId, {
        title: 'Roster HTTP',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        capacity: 5,
        priceMode: 'fixed',
        price: 1000,
      })
    ).id
    await bookingService.book({ userId: playerId }, orgId, eventId, { method: 'cash' })
    await db
      .update(organizationMembers)
      .set({ level: 'v3' })
      .where(eq(organizationMembers.userId, playerId))
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('member sees the level of a roster player in the event response', async () => {
    const res = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
      user: playerId,
    })
    expect(res.status).toBe(200)
    const roster = (res.body as { roster: { user: { id: number }; level?: string | null }[] })
      .roster
    expect(roster).toEqual([
      expect.objectContaining({ user: expect.objectContaining({ id: playerId }), level: 'v3' }),
    ])
  })

  it('a user outside the group gets no event payload and so no levels', async () => {
    const res = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
      user: outsiderId,
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(JSON.stringify(res.body ?? {})).not.toContain('v3')
    expect(JSON.stringify(res.body ?? {})).not.toContain('"level"')
  })
})
