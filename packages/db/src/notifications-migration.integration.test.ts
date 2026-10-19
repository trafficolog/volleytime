import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackPublicSlug } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG30 = '0030_event_public_slug'
const TAG = '0029_notifications_feed'
const TAG28 = '0028_event_jobs'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 20.3.2: миграция ленты уведомлений применяется и откатывается на пустой базе, на базе после
 * demo-сида и на базе, стоящей на 0028 с данными (ADR v3, «Правила совместимости»): `notifications`
 * (UNIQUE `(recipient_user_id, dedup_key)`), тихие часы и признак недоступности бота у `users`,
 * совместимость INSERT прежнего runtime и отказ отката, пока есть уведомления или тихие часы.
 */
describe('migration 0029 notifications feed (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public' AND table_name = 'users'
            AND column_name IN ('quiet_hours_start', 'quiet_hours_end', 'bot_blocked_at'))
        + (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'notifications')
        + (SELECT count(*) FROM pg_type
          WHERE typname IN ('notification_type', 'notification_delivery_status'))
        + (SELECT count(*) FROM pg_constraint WHERE conname = 'users_quiet_hours_range')
      )::int AS n`
    return row!.n
  }
  const ALL = 7

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
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0028 data, enforces feed constraints and guards the rollback', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0028
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('v028@example.com') RETURNING id`
      const u = user!.id
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('v028', 'V028', ${u}) RETURNING id`
      const o = org!.id

      await runMigrations(url)

      // существующий пользователь: тихие часы не заданы, бот доступен
      expect(
        await sql`SELECT quiet_hours_start, quiet_hours_end, bot_blocked_at FROM users`,
      ).toEqual([{ quiet_hours_start: null, quiet_hours_end: null, bot_blocked_at: null }])
      // прежний runtime вставляет пользователей без новых колонок
      await sql`INSERT INTO users (email) VALUES ('old@example.com')`

      // тихие часы: обе границы вместе, 0..1439
      await expect(
        sql`UPDATE users SET quiet_hours_start = 1440, quiet_hours_end = 0`,
      ).rejects.toThrow(/users_quiet_hours_range/)
      await expect(sql`UPDATE users SET quiet_hours_start = 60 WHERE id = ${u}`).rejects.toThrow(
        /users_quiet_hours_range/,
      )

      const feed = (key: string, recipient = u) => sql`
        INSERT INTO notifications (recipient_user_id, organization_id, type, dedup_key)
        VALUES (${recipient}, ${o}, 'booking_opened', ${key}) RETURNING id`
      await feed('booking_opened:event:1')
      // не больше одного уведомления одного типа на событие и получателя
      await expect(feed('booking_opened:event:1')).rejects.toThrow(
        /notifications_recipient_dedup_uniq/,
      )
      await feed('booking_opened:event:2')
      const [other] = await sql<
        { id: number }[]
      >`SELECT id FROM users WHERE email = 'old@example.com'`
      await feed('booking_opened:event:1', other!.id) // другой получатель — отдельная строка
      expect(
        await sql`SELECT delivery_status, attempts, read_at FROM notifications LIMIT 1`,
      ).toEqual([{ delivery_status: 'pending', attempts: 0, read_at: null }])

      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      // откат запрещён, пока есть уведомления; транзакция ничего не меняет
      await expect(rollbackLastMigration(url)).rejects.toThrow(
        /rollback 0029 refused: notifications/,
      )
      expect(await objects(sql)).toBe(ALL)
      await sql`DELETE FROM notifications`

      // ... и пока заданы тихие часы
      await sql`UPDATE users SET quiet_hours_start = 1320, quiet_hours_end = 420 WHERE id = ${u}`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0029 refused: quiet/)
      await sql`UPDATE users SET quiet_hours_start = NULL, quiet_hours_end = NULL`
      // признак недоступности бота откат не блокирует
      await sql`UPDATE users SET bot_blocked_at = now() WHERE id = ${u}`

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM users`).toHaveLength(2)

      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG28)
    } finally {
      await sql.end()
    }
  })

  it('deletes the feed with its recipient', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('del@example.com') RETURNING id`
      await sql`INSERT INTO notifications (recipient_user_id, type, dedup_key)
        VALUES (${user!.id}, 'event_cancelled', 'event_cancelled:event:1')`
      await sql`DELETE FROM users WHERE id = ${user!.id}`
      expect(await sql`SELECT 1 FROM notifications`).toHaveLength(0)
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
        users: await count('users'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
      })
      const before = await snapshot()
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
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
