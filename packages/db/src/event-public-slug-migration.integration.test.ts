import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0030_event_public_slug'
const TAG29 = '0029_notifications_feed'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''
const SLUG_RE = /^[0-9a-f]{12}$/

/**
 * Task 20.6.1: `events.public_slug` — непрозрачный идентификатор публичной страницы. Миграция
 * применяется и откатывается на пустой базе, на базе после demo-сида и на базе на 0029 с данными
 * (ADR v3, «Правила совместимости»): существующим событиям выдаются уникальные случайные значения,
 * INSERT прежнего runtime без колонки работает, откат отказывает при живых событиях.
 */
describe('migration 0030 event public slug (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'public_slug')
        + (SELECT count(*) FROM pg_indexes WHERE indexname = 'events_public_slug_uniq')
      )::int AS n`
    return row!.n
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

  it('backfills unique slugs on 0029 data, keeps the old runtime working and guards the rollback', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0029
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('v028@example.com') RETURNING id`
      const u = user!.id
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('v028', 'V028', ${u}) RETURNING id`
      const o = org!.id
      const ins = (title: string, status: string, days: number) => sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
        VALUES (${o}, ${u}, ${title}, now() + make_interval(days => ${days}),
                now() + make_interval(days => ${days}, hours => 2), 10, ${status}::event_status)
        RETURNING id`
      for (let i = 0; i < 25; i++) await ins(`E${i}`, 'published', 1 + i)

      await runMigrations(url)

      const rows = await sql<{ public_slug: string }[]>`SELECT public_slug FROM events`
      expect(rows).toHaveLength(25)
      for (const r of rows) expect(r.public_slug).toMatch(SLUG_RE)
      expect(new Set(rows.map((r) => r.public_slug)).size).toBe(25)

      // прежний runtime вставляет события без новой колонки — значение выдаёт БД
      const [oldRow] = await ins('Old', 'published', 40)
      const oldId = oldRow!.id
      const [old] = await sql<{ public_slug: string }[]>`
        SELECT public_slug FROM events WHERE id = ${oldId}`
      expect(old!.public_slug).toMatch(SLUG_RE)

      // значение уникально
      await expect(
        sql`UPDATE events SET public_slug = ${old!.public_slug} WHERE id <> ${oldId}`,
      ).rejects.toThrow(/events_public_slug_uniq/)

      // откат запрещён, пока есть живые события; транзакция ничего не меняет
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0030 refused/)
      expect(await objects(sql)).toBe(2)

      // прошедшие, отменённые и черновые события откат не блокируют
      await sql`UPDATE events SET status = 'cancelled' WHERE id % 3 = 0`
      await sql`UPDATE events SET status = 'draft' WHERE id % 3 = 1`
      await sql`UPDATE events SET status = 'finished' WHERE id % 3 = 2`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(26)

      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG29)
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
      const [nRow] = await sql<{ n: number }[]>`
        SELECT count(DISTINCT public_slug)::int AS n FROM events`
      const [totalRow] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM events`
      const n = nRow!.n
      const total = totalRow!.total
      expect(total).toBeGreaterThan(0)
      expect(n).toBe(total)
      // демо-сид содержит живые события: откат отказывает, события не затронуты
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0030 refused/)
      await sql`UPDATE events SET status = 'finished' WHERE status IN ('published', 'closed')`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(total)
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
