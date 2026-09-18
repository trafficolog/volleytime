import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, db, sql } from './index'

describe('db health check (integration)', () => {
  it('SELECT 1 succeeds on live database', async () => {
    const result = await db.execute(sql`SELECT 1 AS ok`)
    expect(result[0]).toEqual({ ok: 1 })
  })

  afterAll(async () => {
    await closeDb()
  })
})
