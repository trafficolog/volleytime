import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG29 = '0029_notifications_feed'
const TAG = '0028_event_jobs'
const TAG27 = '0027_event_series'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 20.3.1: миграция фоновых задач события применяется и откатывается на пустой базе, на базе
 * после demo-сида и на базе, стоящей на 0027 с данными (ADR v3, «Правила совместимости»):
 * `events.booking_opens_at` NULL + CHECK «раньше начала», `waitlist_offers` (одно активное
 * предложение на запись, CHECK мест и срока), журнал `scheduled_jobs` (UNIQUE ключа), совместимость
 * INSERT прежнего runtime и отказ отката при активных предложениях и живых событиях со временем
 * открытия. Каждый тест — во временной БД.
 */
describe('migration 0028 event jobs (integration)', { timeout: 60_000 }, () => {
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
            AND column_name IN ('booking_opens_at', 'close_before_minutes'))
        + (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name IN ('waitlist_offers', 'scheduled_jobs'))
        + (SELECT count(*) FROM pg_type
          WHERE typname IN ('waitlist_offer_status', 'scheduled_job_status'))
        + (SELECT count(*) FROM pg_constraint
          WHERE conname IN ('events_booking_opens_before_start', 'events_close_before_minutes_allowed'))
      )::int AS n`
    return row!.n
  }
  const ALL = 8

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
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0027 data, enforces offer/journal constraints and guards the rollback', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0027
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('v027@example.com') RETURNING id`
      const u = user!.id
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('v027', 'V027', ${u}) RETURNING id`
      const o = org!.id
      const [ev] = await sql<{ id: number }[]>`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
        VALUES (${o}, ${u}, 'E', now() + interval '1 day', now() + interval '2 day', 10, 'published')
        RETURNING id`
      const e = ev!.id
      const [bk] = await sql<{ id: number }[]>`
        INSERT INTO bookings (event_id, user_id, organization_id, status, method)
        VALUES (${e}, ${u}, ${o}, 'waitlisted', 'cash') RETURNING id`
      const b = bk!.id

      await runMigrations(url)

      // существующие события открыты с публикации
      // и закрываются планировщиком за 2 ч (умолчание, решение владельца 2026-10-16)
      expect(await sql`SELECT booking_opens_at, close_before_minutes FROM events`).toEqual([
        { booking_opens_at: null, close_before_minutes: 120 },
      ])
      await expect(
        sql`UPDATE events SET close_before_minutes = 90 WHERE id = ${e}`,
      ).rejects.toThrow(/events_close_before_minutes_allowed/)
      await sql`UPDATE events SET close_before_minutes = 1440 WHERE id = ${e}`
      // прежний runtime вставляет события без новых колонок
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity)
        VALUES (${o}, ${u}, 'Old', now() + interval '3 day', now() + interval '4 day', 5)`
      // время открытия — строго раньше начала
      await expect(
        sql`UPDATE events SET booking_opens_at = starts_at WHERE id = ${e}`,
      ).rejects.toThrow(/events_booking_opens_before_start/)

      const offer = (status = 'offered') => sql`
        INSERT INTO waitlist_offers (organization_id, event_id, booking_id, seats, status, expires_at)
        VALUES (${o}, ${e}, ${b}, 1, ${status}, now() + interval '30 minutes') RETURNING id`
      await offer()
      // одно активное предложение на запись; закрытые не ограничены
      await expect(offer()).rejects.toThrow(/waitlist_offers_active_booking_uniq/)
      await offer('expired')
      await offer('expired')
      await expect(
        sql`INSERT INTO waitlist_offers (organization_id, event_id, booking_id, seats, status, expires_at)
            VALUES (${o}, ${e}, ${b}, 0, 'expired', now() + interval '30 minutes')`,
      ).rejects.toThrow(/waitlist_offers_seats_positive/)
      await expect(
        sql`INSERT INTO waitlist_offers (organization_id, event_id, booking_id, seats, status, offered_at, expires_at)
            VALUES (${o}, ${e}, ${b}, 1, 'expired', now(), now())`,
      ).rejects.toThrow(/waitlist_offers_expires_after_offer/)

      // журнал: одна задача на ключ
      await sql`INSERT INTO scheduled_jobs (kind, dedup_key, event_id) VALUES ('notify', 'k:1', ${e})`
      await expect(
        sql`INSERT INTO scheduled_jobs (kind, dedup_key) VALUES ('notify', 'k:1')`,
      ).rejects.toThrow(/scheduled_jobs_dedup_uniq/)

      // откат запрещён, пока есть активное предложение; транзакция ничего не меняет
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0028 refused: active/)
      expect(await objects(sql)).toBe(ALL)
      await sql`UPDATE waitlist_offers SET status = 'revoked' WHERE status = 'offered'`

      // ... и пока у живого события задано время открытия
      await sql`UPDATE events SET booking_opens_at = now() + interval '1 hour' WHERE id = ${e}`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/booking_opens_at/)
      expect(await objects(sql)).toBe(ALL)
      // прошедшее время открытия (запись уже открыта) откат не блокирует ...
      await sql`UPDATE events SET booking_opens_at = now() - interval '1 hour' WHERE id = ${e}`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      await runMigrations(url)
      // ... как и будущее время у отменённого события
      await sql`UPDATE events SET booking_opens_at = now() + interval '1 hour', status = 'cancelled' WHERE id = ${e}`

      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(2)
      expect(await sql`SELECT status FROM bookings`).toEqual([{ status: 'waitlisted' }])

      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG27)
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
      const snapshot = async () => ({
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
        balance: await count('event_balance_entries'),
      })
      const before = await snapshot()
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2
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
