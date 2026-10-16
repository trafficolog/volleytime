import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0027_event_series'
const TAG28 = '0028_event_jobs'
const TAG26 = '0026_event_join_mode_invites'
/** Дата серии через 3 недели от текущего дня: тест не зависит от календаря (ревью PR #145). */
const SERIES_DATE = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10)
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 20.2.2: миграция серий событий применяется и откатывается на пустой базе, на базе после
 * demo-сида и на базе, стоящей на 0026 с данными (ADR v3, «Правила совместимости»): колонки
 * `events.series_id`/`series_date` NULL, UNIQUE даты в серии, CHECK «дата у даты серии»,
 * идемпотентность создания по ключу, совместимость INSERT прежнего runtime, отказ отката при
 * существующих сериях. Каждый тест — во временной БД.
 */
describe('migration 0027 event series (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public' AND table_name = 'events'
            AND column_name IN ('series_id', 'series_date'))
        + (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'event_series')
        + (SELECT count(*) FROM pg_type WHERE typname = 'event_series_status')
        + (SELECT count(*) FROM pg_indexes WHERE indexname = 'events_series_date_uniq')
        + (SELECT count(*) FROM pg_constraint WHERE conname = 'events_series_date_required')
      )::int AS n`
    return row!.n
  }
  const ALL = 6

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
      expect(await objects(sql)).toBe(ALL)
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0026 data, enforces series constraints and guards the rollback', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0026
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('v026@example.com') RETURNING id`
      const u = user!.id
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('v026', 'V026', ${u}) RETURNING id`
      const o = org!.id
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
        VALUES (${o}, ${u}, 'E', now() + interval '1 day', now() + interval '2 day', 10, 'published')`

      await runMigrations(url)

      // существующие события — вне серий
      expect(await sql`SELECT series_id, series_date FROM events`).toEqual([
        { series_id: null, series_date: null },
      ])
      // прежний runtime вставляет события без новых колонок
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity)
        VALUES (${o}, ${u}, 'Old', now() + interval '3 day', now() + interval '4 day', 5)`

      const rule = { freq: 'weekly', weekdays: [3], startDate: SERIES_DATE, count: 2 }
      const [series] = await sql<{ id: number; status: string; exceptions: string[] }[]>`
        INSERT INTO event_series (organization_id, created_by_user_id, rule, template, timezone, idempotency_key)
        VALUES (${o}, ${u}, ${sql.json(rule)}, ${sql.json({ title: 'S' })}, 'Europe/Minsk', 'key-0001')
        RETURNING id, status, exceptions`
      const s = series!.id
      expect(series!.status).toBe('active')
      expect(series!.exceptions).toEqual([])

      const dated = (date: string) => sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status, series_id, series_date)
        VALUES (${o}, ${u}, 'S', ${`${date}T16:00:00Z`}, ${`${date}T18:00:00Z`}, 10, 'draft', ${s}, ${date})
        RETURNING id`
      await dated(SERIES_DATE)
      // одна дата серии — одно событие
      await expect(dated(SERIES_DATE)).rejects.toThrow(/events_series_date_uniq/)
      // событие серии обязано иметь дату
      await expect(
        sql`INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, series_id)
            VALUES (${o}, ${u}, 'X', now() + interval '1 day', now() + interval '2 day', 5, ${s})`,
      ).rejects.toThrow(/events_series_date_required/)
      // ключ идемпотентности уникален в группе
      await expect(
        sql`INSERT INTO event_series (organization_id, created_by_user_id, rule, template, timezone, idempotency_key)
            VALUES (${o}, ${u}, ${sql.json(rule)}, ${sql.json({})}, 'Europe/Minsk', 'key-0001')`,
      ).rejects.toThrow(/event_series_idempotency_uniq/)

      // откат запрещён, пока есть серии; транзакция ничего не меняет
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0027 refused/)
      expect(await objects(sql)).toBe(ALL)

      // удаление серии оставляет даты обычными событиями (FK ON DELETE SET NULL)
      await sql`DELETE FROM event_series WHERE id = ${s}`
      expect(await sql`SELECT series_id FROM events WHERE title = 'S'`).toEqual([
        { series_id: null },
      ])

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(3)

      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG26)
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
      const count = async (table: string) =>
        (await sql.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${table}`))[0]!.n
      // demo-сид содержит серию (20.2.2): откат требует её удаления оператором
      expect(await count('event_series')).toBeGreaterThan(0)
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0027 refused/)
      await sql`DELETE FROM event_series`
      const snapshot = async () => ({
        events: await count('events'),
        bookings: await count('bookings'),
        balance: await count('event_balance_entries'),
      })
      const before = await snapshot()
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await snapshot()).toEqual(before)
      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
      expect(await snapshot()).toEqual(before)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
