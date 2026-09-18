import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db } from '../client'

import { accounts } from './accounts'
import { users } from './users'

describe('users/accounts schema (integration)', () => {
  beforeEach(async () => {
    // чистим перед каждым тестом (cascade удалит accounts/sessions)
    await db.delete(users)
  })

  it('inserts a user with defaults', async () => {
    const [u] = await db.insert(users).values({ email: 'a@test.by', name: 'Test' }).returning()
    expect(u?.id).toBeGreaterThan(0)
    expect(u?.emailVerified).toBe(false)
    expect(u?.isActive).toBe(true)
    expect(u?.isRootAdmin).toBe(false)
    expect(u?.createdAt).toBeInstanceOf(Date)
  })

  it('enforces unique email', async () => {
    await db.insert(users).values({ email: 'dup@test.by' })
    await expect(db.insert(users).values({ email: 'dup@test.by' })).rejects.toThrow()
  })

  it('stores telegram user id as bigint', async () => {
    const [u] = await db.insert(users).values({ telegramUserId: 123456789012345n }).returning()
    expect(u?.telegramUserId).toBe(123456789012345n)
  })

  it('cascades delete: removing user removes accounts', async () => {
    const [u] = await db.insert(users).values({ email: 'c@test.by' }).returning()
    await db.insert(accounts).values({
      userId: u!.id,
      providerId: 'telegram',
      accountId: '999',
    })
    await db.delete(users).where(eq(users.id, u!.id))
    const remaining = await db.select().from(accounts).where(eq(accounts.userId, u!.id))
    expect(remaining).toHaveLength(0)
  })

  it('enforces unique (providerId, accountId)', async () => {
    const [u] = await db.insert(users).values({ email: 'p@test.by' }).returning()
    await db.insert(accounts).values({ userId: u!.id, providerId: 'email', accountId: 'p@test.by' })
    await expect(
      db.insert(accounts).values({ userId: u!.id, providerId: 'email', accountId: 'p@test.by' }),
    ).rejects.toThrow()
  })

  afterAll(async () => {
    await db.delete(users)
    await closeDb()
  })
})
