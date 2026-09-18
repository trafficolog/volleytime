import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'
import { users } from './schema'
import { truncateAll } from './test-utils'

import * as dbEntry from './index'

describe('truncateAll (integration)', () => {
  it('removes all users and resets identity', async () => {
    await db.insert(users).values({ email: 'trunc@test.by' })
    await truncateAll()
    const remaining = await db.select().from(users)
    expect(remaining).toHaveLength(0)
  })

  it('is not exported from the main entry (3.9.9)', () => {
    expect('truncateAll' in dbEntry).toBe(false)
  })

  it('refuses to run in production', async () => {
    const orig = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    await expect(truncateAll()).rejects.toThrow(/forbidden in production/)
    process.env.NODE_ENV = orig
  })

  afterAll(async () => {
    await closeDb()
  })
})
