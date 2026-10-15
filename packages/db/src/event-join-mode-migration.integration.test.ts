import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0026_event_join_mode_invites'
const TAG25 = '0025_multi_seat_booking'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 20.1.3: миграция режима записи и приглашений на событие применяется и откатывается на
 * пустой базе, на базе после demo-сида и на базе, стоящей на 0025 с данными (ADR v3, «Правила
 * совместимости»): constant DEFAULT, FK и CHECK на существующих приглашениях, совместимость INSERT
 * прежнего runtime, отказ отката при действующих событиях «по приглашению». Каждый тест — во
 * временной БД.
 */
describe('migration 0026 event join mode and invites (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public' AND ((table_name = 'events' AND column_name = 'join_mode')
            OR (table_name = 'bookings' AND column_name = 'invite_id')))
        + (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'event_invite_requests')
        + (SELECT count(*) FROM pg_type WHERE typname = 'invite_request_status')
        + (SELECT count(*) FROM pg_constraint
          WHERE conname IN ('invite_links_event_join_event', 'invite_links_event_id_events_id_fk'))
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
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0025 data, enforces invite constraints and guards the rollback', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0025
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('v025@example.com') RETURNING id`
      const u = user!.id
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id, default_join_mode)
        VALUES ('v025', 'V025', ${u}, 'invite') RETURNING id`
      const o = org!.id
      const [ev] = await sql<{ id: number }[]>`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
        VALUES (${o}, ${u}, 'E', now() + interval '1 day', now() + interval '2 day', 10, 'published')
        RETURNING id`
      const e = ev!.id
      await sql`
        INSERT INTO bookings (event_id, user_id, organization_id, status, method)
        VALUES (${e}, ${u}, ${o}, 'confirmed', 'free')`
      await sql`
        INSERT INTO invite_links (token, organization_id, created_by_user_id)
        VALUES ('orgtoken0000001', ${o}, ${u})`

      await runMigrations(url)

      // существующие события — свободная запись, независимо от умолчания группы
      expect(await sql`SELECT join_mode FROM events`).toEqual([{ join_mode: 'open' }])
      expect(await sql`SELECT invite_id FROM bookings`).toEqual([{ invite_id: null }])
      expect(await sql`SELECT type, event_id FROM invite_links`).toEqual([
        { type: 'organization_join', event_id: null },
      ])

      // прежний runtime вставляет события и записи без новых колонок
      const [old] = await sql<{ id: number; join_mode: string }[]>`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity)
        VALUES (${o}, ${u}, 'Old', now() + interval '3 day', now() + interval '4 day', 5)
        RETURNING id, join_mode`
      expect(old!.join_mode).toBe('open')

      // CHECK: event_join ⇔ event_id
      await expect(
        sql`INSERT INTO invite_links (token, organization_id, created_by_user_id, type)
            VALUES ('evtoken00000001', ${o}, ${u}, 'event_join')`,
      ).rejects.toThrow(/invite_links_event_join_event/)
      await expect(
        sql`INSERT INTO invite_links (token, organization_id, created_by_user_id, event_id)
            VALUES ('evtoken00000002', ${o}, ${u}, ${e})`,
      ).rejects.toThrow(/invite_links_event_join_event/)
      // FK на событие
      await expect(
        sql`INSERT INTO invite_links (token, organization_id, created_by_user_id, type, event_id)
            VALUES ('evtoken00000003', ${o}, ${u}, 'event_join', 999999)`,
      ).rejects.toThrow(/invite_links_event_id_events_id_fk/)

      // приглашение на событие и запрос; один pending-запрос на игрока и событие
      await sql`UPDATE events SET join_mode = 'invite' WHERE id = ${e}`
      const [inv] = await sql<{ id: number }[]>`
        INSERT INTO invite_links (token, organization_id, created_by_user_id, type, event_id, max_uses)
        VALUES ('evtoken00000004', ${o}, ${u}, 'event_join', ${e}, 1) RETURNING id`
      await sql`UPDATE bookings SET invite_id = ${inv!.id}`
      await sql`
        INSERT INTO event_invite_requests (organization_id, event_id, user_id) VALUES (${o}, ${e}, ${u})`
      await expect(
        sql`INSERT INTO event_invite_requests (organization_id, event_id, user_id)
            VALUES (${o}, ${e}, ${u})`,
      ).rejects.toThrow(/event_invite_requests_pending_unique/)
      await sql`UPDATE event_invite_requests SET status = 'declined'`
      await sql`
        INSERT INTO event_invite_requests (organization_id, event_id, user_id) VALUES (${o}, ${e}, ${u})`

      // откат запрещён, пока есть действующее событие «по приглашению»; транзакция не меняет ничего
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0026 refused/)
      expect(await objects(sql)).toBe(ALL)
      await sql`UPDATE events SET status = 'cancelled' WHERE id = ${e}`

      // живой токен приглашения на событие тоже блокирует откат (прежний redeem не различает тип);
      // использованные, истёкшие и отозванные — нет
      await sql`
        INSERT INTO invite_links (token, organization_id, created_by_user_id, type, event_id, max_uses, uses_count)
        VALUES ('evtoken00000005', ${o}, ${u}, 'event_join', ${e}, 1, 1)`
      await sql`
        INSERT INTO invite_links (token, organization_id, created_by_user_id, type, event_id, max_uses, expires_at)
        VALUES ('evtoken00000006', ${o}, ${u}, 'event_join', ${e}, 1, now() - interval '1 minute')`
      await expect(rollbackLastMigration(url)).rejects.toThrow(
        /rollback 0026 refused: live event_join invite tokens exist/,
      )
      expect(await objects(sql)).toBe(ALL)
      await sql`UPDATE invite_links SET is_revoked = true WHERE token = 'evtoken00000004'`

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      // приглашения на событие удалены (прежний redeem принял бы их как вступление в группу),
      // приглашения в группу, события и записи сохранены
      expect(await sql`SELECT token FROM invite_links`).toEqual([{ token: 'orgtoken0000001' }])
      expect(await sql`SELECT 1 FROM events`).toHaveLength(2)
      expect(await sql`SELECT 1 FROM bookings`).toHaveLength(1)

      await runMigrations(url)
      expect(await objects(sql)).toBe(ALL)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG25)
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
        invites: await count('invite_links'),
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
