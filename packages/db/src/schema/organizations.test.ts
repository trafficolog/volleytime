import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db, eq } from '../index'

import { organizations } from './organizations'
import { users } from './users'

async function makeUser() {
  const [u] = await db
    .insert(users)
    .values({ email: `own-${Date.now()}-${Math.random()}@t.by` })
    .returning()
  return u!
}

describe('organizations schema (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
  })

  it('inserts org with defaults', async () => {
    const owner = await makeUser()
    const [org] = await db
      .insert(organizations)
      .values({ slug: 'vt-minsk', name: 'VT Minsk', ownerUserId: owner.id })
      .returning()
    expect(org?.status).toBe('active')
    expect(org?.sportType).toBe('volleyball')
    expect(org?.defaultCurrency).toBe('BYN')
    expect(org?.defaultTimezone).toBe('Europe/Minsk')
    expect(org?.defaultMemberStatus).toBe('active')
    expect(org?.publicPageEnabled).toBe(false)
    expect(org?.subscriptionsEnabled).toBe(true)
  })

  it('enforces unique slug', async () => {
    const owner = await makeUser()
    await db.insert(organizations).values({ slug: 'dup', name: 'A', ownerUserId: owner.id })
    await expect(
      db.insert(organizations).values({ slug: 'dup', name: 'B', ownerUserId: owner.id }),
    ).rejects.toThrow()
  })

  it('restricts deleting a user who owns an org', async () => {
    const owner = await makeUser()
    await db.insert(organizations).values({ slug: 'r', name: 'R', ownerUserId: owner.id })
    await expect(db.delete(users).where(eq(users.id, owner.id))).rejects.toThrow()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
