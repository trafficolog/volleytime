import { closeDb, db, eq, events, organizations, organizationMembers, users } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { eventService } from '../events/service'
import { organizationService } from '../organizations/service'

import { bookingService } from './service'

/**
 * Уровень игрока в составе события (20.4.10, решение владельца 2026-10-14):
 * только для участников группы (includeLevel), публичный состав уровней не содержит.
 */
describe('event roster player level (PostgreSQL)', () => {
  let ownerId: number
  let playerId: number
  let otherGroupPlayerId: number
  let orgId: number
  let otherOrgId: number
  let eventId: number

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { email: 'roster-owner@test.by' },
        { email: 'roster-player@test.by' },
        { email: 'roster-other@test.by' },
      ])
      .returning()
    ownerId = people[0]!.id
    playerId = people[1]!.id
    otherGroupPlayerId = people[2]!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Roster A' })).id
    otherOrgId = (
      await organizationService.create({ userId: otherGroupPlayerId }, { name: 'Roster B' })
    ).id
    await db
      .insert(organizationMembers)
      .values({ userId: playerId, organizationId: orgId, role: 'player', status: 'active' })
    eventId = (
      await eventService.create({ userId: ownerId }, orgId, {
        title: 'Roster',
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
      .set({ level: 'v2' })
      .where(eq(organizationMembers.userId, playerId))
  })

  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('member roster carries the level of the player in this group', async () => {
    const roster = await bookingService.publicRoster({ userId: playerId }, orgId, eventId, {
      includeLevel: true,
    })
    expect(roster).toHaveLength(1)
    expect(roster[0]).toMatchObject({ user: { id: playerId }, level: 'v2' })
  })

  it('member roster reports null for a player without a level', async () => {
    await db
      .update(organizationMembers)
      .set({ level: null })
      .where(eq(organizationMembers.userId, playerId))
    const roster = await bookingService.publicRoster({ userId: playerId }, orgId, eventId, {
      includeLevel: true,
    })
    expect(roster[0]).toHaveProperty('level', null)
  })

  it('public roster (default) has no level key and no level text in JSON', async () => {
    const roster = await bookingService.publicRoster({ userId: playerId }, orgId, eventId)
    expect(roster).toHaveLength(1)
    expect(roster[0]).not.toHaveProperty('level')
    expect(JSON.stringify(roster)).not.toContain('level')
    expect(JSON.stringify(roster)).not.toContain('v2')
  })

  it('level is taken from the event group only, not from another group membership', async () => {
    await db.insert(organizationMembers).values({
      userId: playerId,
      organizationId: otherOrgId,
      role: 'player',
      status: 'active',
      level: 'v1',
    })
    const roster = await bookingService.publicRoster({ userId: playerId }, orgId, eventId, {
      includeLevel: true,
    })
    expect(roster[0]).toMatchObject({ level: 'v2' })
  })

  it('a foreign group id returns no roster rows, so no levels leak', async () => {
    const roster = await bookingService.publicRoster(
      { userId: otherGroupPlayerId },
      otherOrgId,
      eventId,
      { includeLevel: true },
    )
    expect(roster).toEqual([])
    const [event] = await db.select().from(events).where(eq(events.id, eventId))
    expect(event?.organizationId).toBe(orgId)
  })
})
