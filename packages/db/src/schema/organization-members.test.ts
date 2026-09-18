import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db, eq } from '../index'

import { organizationMembers } from './organization-members'
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
  return { owner: owner!, player: player!, org: org! }
}

describe('organization_members schema (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('inserts member with default role/status', async () => {
    const { player, org } = await setup()
    const [m] = await db
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId: player.id })
      .returning()
    expect(m?.role).toBe('player')
    expect(m?.status).toBe('active')
  })

  it('enforces unique (org, user)', async () => {
    const { player, org } = await setup()
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: player.id })
    await expect(
      db.insert(organizationMembers).values({ organizationId: org.id, userId: player.id }),
    ).rejects.toThrow()
  })

  it('cascades on organization delete', async () => {
    const { player, org } = await setup()
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: player.id })
    await db.delete(organizations).where(eq(organizations.id, org.id))
    const rows = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, org.id))
    expect(rows).toHaveLength(0)
  })

  it('cascades on user delete', async () => {
    const { player, org } = await setup()
    await db.insert(organizationMembers).values({ organizationId: org.id, userId: player.id })
    await db.delete(users).where(eq(users.id, player.id))
    const rows = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, player.id))
    expect(rows).toHaveLength(0)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
