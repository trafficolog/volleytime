import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'

describe('db client (integration)', () => {
  it('connects to Postgres and runs a query', async () => {
    const result = await db.execute(sql`SELECT 1 AS ok`)
    expect(result[0]).toEqual({ ok: 1 })
  })

  afterAll(async () => {
    await closeDb()
  })
})
