import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'
import { runMigrations } from './migrate'

const TEST_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

describe('runMigrations (integration)', () => {
  it('is idempotent: applying again is a no-op, tables present', async () => {
    await runMigrations(TEST_URL) // повторно (БД уже мигрирована в 3.2.2)
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users','accounts','sessions')`,
    )
    expect(tables.length).toBe(3)
  })

  it('records migrations in drizzle tracking table', async () => {
    const rows = await db.execute(sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`)
    expect((rows[0] as { n: number }).n).toBeGreaterThanOrEqual(1)
  })

  afterAll(async () => {
    await closeDb()
  })
})
