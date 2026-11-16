import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0040_venue_hourly_price'
const PREVIOUS = '0039_group_ownership_soft_delete'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.4.13 (DEF-23): цена за час зала. Миграция аддитивна (nullable `venues.hourly_price`
 * с CHECK 0…10 000 000): применяется и откатывается на пустой базе, после demo-сида и на базе на
 * 0039 с залами. Прежнее приложение колонку не знает. Откат отказывает, пока цена указана.
 */
describe('migration 0040 venue hourly price (integration)', { timeout: 60_000 }, () => {
  const admin = postgres(BASE_URL, { max: 1 })
  const created: string[] = []

  async function scratchDb(): Promise<{ url: string; sql: postgres.Sql }> {
    const name = `vt_mig_${randomBytes(4).toString('hex')}`
    await admin.unsafe(`CREATE DATABASE ${name}`)
    created.push(name)
    const url = new URL(BASE_URL)
    url.pathname = `/${name}`
    return { url: url.toString(), sql: postgres(url.toString(), { max: 2 }) }
  }

  async function objects(sql: postgres.Sql) {
    const [row] = await sql<{ n: number }[]>`
      SELECT (
        (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'hourly_price')
        + (SELECT count(*) FROM pg_constraint WHERE conname = 'venues_hourly_price_range')
      )::int AS n`
    return row!.n
  }

  async function venue(sql: postgres.Sql, slug: string): Promise<number> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    const [v] = await sql<{ id: number }[]>`
      INSERT INTO venues (organization_id, name, address) VALUES (${o!.id}, 'Зал', 'ул. Мира 1')
      RETURNING id`
    return v!.id
  }

  beforeAll(() => {
    expect(BASE_URL).not.toBe('')
  })

  afterAll(async () => {
    for (const name of created) await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await admin.end()
  })

  it('applies, rolls back and re-applies on an empty database', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0039 venues unchanged with an empty price and stays compatible with the previous app', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // БД на 0039, как production
      const id = await venue(sql, 'vh-compat')
      await runMigrations(url)
      const [row] = await sql`SELECT name, address, hourly_price FROM venues WHERE id = ${id}`
      expect(row).toEqual({ name: 'Зал', address: 'ул. Мира 1', hourly_price: null })

      // прежнее приложение колонку не перечисляет: INSERT даёт NULL, UPDATE цену не трогает
      const [orgRow] = await sql`SELECT organization_id FROM venues WHERE id = ${id}`
      const [fresh] = await sql<{ hourly_price: number | null }[]>`
        INSERT INTO venues (organization_id, name) VALUES (${orgRow!.organization_id}, 'Новый')
        RETURNING hourly_price`
      expect(fresh!.hourly_price).toBeNull()
      await sql`UPDATE venues SET hourly_price = 1500 WHERE id = ${id}`
      await sql`UPDATE venues SET name = 'Переименован', updated_at = now() WHERE id = ${id}`
      const [kept] = await sql`SELECT hourly_price FROM venues WHERE id = ${id}`
      expect(kept!.hourly_price).toBe(1500)
    } finally {
      await sql.end()
    }
  })

  it('accepts null, 0 and the maximum, rejects negative and above the maximum', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await venue(sql, 'vh-range')
      for (const value of [0, 1, 1550, 10_000_000, null]) {
        await sql`UPDATE venues SET hourly_price = ${value} WHERE id = ${id}`
      }
      for (const value of [-1, 10_000_001]) {
        await expect(
          sql`UPDATE venues SET hourly_price = ${value} WHERE id = ${id}`,
        ).rejects.toThrow(/venues_hourly_price_range/)
      }
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a price is set and passes once it is cleared', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await venue(sql, 'vh-guard')
      // 0 — тоже указанная цена («бесплатно»), потерять её нельзя
      await sql`UPDATE venues SET hourly_price = 0 WHERE id = ${id}`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0040 refused/)
      expect(await objects(sql)).toBe(2)
      const [kept] = await sql`SELECT hourly_price FROM venues WHERE id = ${id}`
      expect(kept!.hourly_price).toBe(0)

      await sql`UPDATE venues SET hourly_price = NULL`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM venues WHERE id = ${id}`).toHaveLength(1)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
    } finally {
      await sql.end()
    }
  })

  it('rolls back and re-applies on a database filled by db:seed:demo', async () => {
    const { url, sql } = await scratchDb()
    const client = postgres(url, { max: 4 })
    const database = drizzle(client, { schema }) as unknown as DB
    try {
      await runMigrations(url)
      await seedDemo(database)
      const [venues] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM venues`
      expect(await sql`SELECT 1 FROM venues WHERE hourly_price IS NOT NULL`).toHaveLength(0)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM venues`).toHaveLength(venues!.n)
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
