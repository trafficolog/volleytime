import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db, eq } from '../index'

import { inviteLinks } from './invite-links'
import { organizations } from './organizations'
import { users } from './users'

async function setup() {
  const [owner] = await db
    .insert(users)
    .values({ email: `o-${Math.random()}@t.by` })
    .returning()
  const [org] = await db
    .insert(organizations)
    .values({ slug: `s-${Math.random()}`.slice(0, 40), name: 'Org', ownerUserId: owner!.id })
    .returning()
  return { owner: owner!, org: org! }
}

describe('invite_links schema (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('inserts invite with defaults', async () => {
    const { owner, org } = await setup()
    const [inv] = await db
      .insert(inviteLinks)
      .values({ token: 'tok123', organizationId: org.id, createdByUserId: owner.id })
      .returning()
    expect(inv?.type).toBe('organization_join')
    expect(inv?.roleToAssign).toBe('player')
    expect(inv?.usesCount).toBe(0)
    expect(inv?.isRevoked).toBe(false)
    expect(inv?.maxUses).toBeNull()
    expect(inv?.expiresAt).toBeNull()
  })

  it('enforces unique token', async () => {
    const { owner, org } = await setup()
    await db
      .insert(inviteLinks)
      .values({ token: 'dup', organizationId: org.id, createdByUserId: owner.id })
    await expect(
      db
        .insert(inviteLinks)
        .values({ token: 'dup', organizationId: org.id, createdByUserId: owner.id }),
    ).rejects.toThrow()
  })

  it('cascades on organization delete', async () => {
    const { owner, org } = await setup()
    await db
      .insert(inviteLinks)
      .values({ token: 't-c', organizationId: org.id, createdByUserId: owner.id })
    await db.delete(organizations).where(eq(organizations.id, org.id))
    const rows = await db.select().from(inviteLinks).where(eq(inviteLinks.organizationId, org.id))
    expect(rows).toHaveLength(0)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
