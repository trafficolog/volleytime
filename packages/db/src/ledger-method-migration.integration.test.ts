import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0033_ledger_method_categories'
const TAG32 = '0032_collections'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.19: способ оплаты ручной записи кассы и категории «Мячи» / «Судья» / «Тренер».
 * Миграция аддитивна (nullable-колонка `ledger_entries.method`, CHECK cash|transfer, три значения
 * enum): применяется и откатывается на пустой базе, после demo-сида и на базе с записями кассы на
 * 0032. Откат отказывает, пока есть запись со способом или новой категорией; значения enum после
 * отката остаются, повторная миграция их не дублирует.
 */
describe('migration 0033 ledger method and categories (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public' AND table_name = 'ledger_entries' AND column_name = 'method')
        + (SELECT count(*) FROM pg_constraint WHERE conname = 'ledger_entries_method_chk')
      )::int AS n`
    return row!.n
  }

  async function enumValues(sql: postgres.Sql) {
    const rows = await sql<{ v: string }[]>`
      SELECT unnest(enum_range(NULL::ledger_category))::text AS v`
    return rows.map((r) => r.v)
  }

  async function org(sql: postgres.Sql, slug: string): Promise<{ o: number; u: number }> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    return { o: o!.id, u: user!.id }
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
      expect(await enumValues(sql)).toEqual(expect.arrayContaining(['balls', 'referee', 'coach']))
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      // значения enum PostgreSQL не удаляются: повторная миграция не должна на них падать
      expect(await enumValues(sql)).toEqual(expect.arrayContaining(['balls', 'referee', 'coach']))
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
      expect(
        (await enumValues(sql)).filter((v) => ['balls', 'referee', 'coach'].includes(v)),
      ).toHaveLength(3)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0032 ledger entries unchanged and enforces the method constraint', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0032
      const a = await org(sql, 'lm-a')
      await sql`INSERT INTO ledger_entries (organization_id, type, category, amount, description)
        VALUES (${a.o}, 'expense', 'rent', 1000, 'аренда')`
      await sql`INSERT INTO ledger_entries (organization_id, type, category, amount)
        VALUES (${a.o}, 'income', 'payment_income', 1500)`

      await runMigrations(url)
      const rows = await sql<{ method: string | null }[]>`SELECT method FROM ledger_entries`
      expect(rows).toHaveLength(2)
      expect(rows.every((r) => r.method === null)).toBe(true)

      for (const method of ['cash', 'transfer']) {
        await sql`INSERT INTO ledger_entries (organization_id, type, category, amount, method)
          VALUES (${a.o}, 'expense', 'balls', 500, ${method}::payment_method)`
      }
      await sql`INSERT INTO ledger_entries (organization_id, type, category, amount)
        VALUES (${a.o}, 'expense', 'referee', 700), (${a.o}, 'expense', 'coach', 900)`
      // платный способ «онлайн» ручной записи недопустим
      await expect(
        sql`INSERT INTO ledger_entries (organization_id, type, category, amount, method)
          VALUES (${a.o}, 'expense', 'other', 100, 'online')`,
      ).rejects.toThrow(/ledger_entries_method_chk/)
      // суммы кассы не зависят от способа
      const [sum] = await sql<{ income: number; expense: number }[]>`
        SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int AS income,
               COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int AS expense
        FROM ledger_entries`
      expect(sum).toEqual({ income: 1500, expense: 1000 + 500 + 500 + 700 + 900 })
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while entries with a method or new category exist', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'lm-guard')

      // способ без новой категории
      const [withMethod] = await sql<{ id: number }[]>`
        INSERT INTO ledger_entries (organization_id, type, category, amount, method)
        VALUES (${a.o}, 'expense', 'rent', 1000, 'cash') RETURNING id`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0033 refused/)
      expect(await objects(sql)).toBe(2)
      expect(await sql`SELECT 1 FROM ledger_entries`).toHaveLength(1)

      // способ снят оператором, но осталась новая категория
      await sql`UPDATE ledger_entries SET method = NULL, category = 'coach'
        WHERE id = ${withMethod!.id}`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0033 refused/)
      expect(await objects(sql)).toBe(2)

      // без записей с новыми данными откат проходит; прежние записи остаются
      await sql`DELETE FROM ledger_entries`
      await sql`INSERT INTO ledger_entries (organization_id, type, category, amount)
        VALUES (${a.o}, 'expense', 'rent', 1000)`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM ledger_entries`).toHaveLength(1)
      expect(await rollbackLastMigration(url)).toBe(TAG32)
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
      const [entries] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM ledger_entries`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM ledger_entries`).toHaveLength(entries!.n)
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
