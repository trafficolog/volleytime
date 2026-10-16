import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG27 = '0027_event_series'
const TAG28 = '0028_event_jobs'
const TAG26 = '0026_event_join_mode_invites'
const TAG = '0021_group_settings_v3'
const TAG22 = '0022_group_cancellation_default'
const TAG23 = '0023_player_levels'
const TAG24 = '0024_event_balance'
const TAG25 = '0025_multi_seat_booking'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

const ORG_COLUMNS = [
  'max_seats_per_booking',
  'default_price_mode',
  'default_join_mode',
  'cancellation_allowed',
  'cancellation_deadline_hours',
  'seo_index',
  'district',
]

/**
 * Task 19.2.2: миграция настроек группы применяется и откатывается на пустой и на заполненной базе
 * (ADR v3, «Правила совместимости», п. 6–7). Каждый тест работает в собственной временной БД,
 * чтобы не мешать общей тестовой.
 */
describe('migrations 0021 group settings and 0022 cancellation default (integration)', () => {
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

  async function columns(sql: postgres.Sql, table: string): Promise<string[]> {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}`
    return rows.map((r) => r.column_name)
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
      expect(await columns(sql, 'organizations')).toEqual(expect.arrayContaining(ORG_COLUMNS))
      expect(await columns(sql, 'events')).toContain('cancellation_allowed')

      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG25)

      expect(await rollbackLastMigration(url)).toBe(TAG24)
      expect(await rollbackLastMigration(url)).toBe(TAG23)
      expect(await rollbackLastMigration(url)).toBe(TAG22)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      const orgCols = await columns(sql, 'organizations')
      for (const c of ORG_COLUMNS) expect(orgCols).not.toContain(c)
      expect(await columns(sql, 'events')).not.toContain('cancellation_allowed')
      const types = await sql`SELECT 1 FROM pg_type WHERE typname = 'event_join_mode'`
      expect(types).toHaveLength(0)

      await runMigrations(url)
      expect(await columns(sql, 'organizations')).toEqual(expect.arrayContaining(ORG_COLUMNS))
    } finally {
      await sql.end()
    }
  })

  it('0021 gives existing rows the defaults; 0022 backfills only NULL deadlines (R0.7)', async () => {
    const { url, sql } = await scratchDb()
    try {
      // БД, где уже применена прежняя 0021 (до 0022)
      await runMigrations(url)
      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      await rollbackLastMigration(url) // 0025
      await rollbackLastMigration(url) // 0024
      await rollbackLastMigration(url) // 0023
      await rollbackLastMigration(url) // 0022

      // данные R0.7
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('old@example.com') RETURNING id`
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id)
        VALUES ('old-org', 'Old', ${user!.id}) RETURNING id`
      // самый частый срок: 5 (два события), 8 (одно), событие без срока не считается
      for (const [title, hours] of [
        ['a', 5],
        ['b', 5],
        ['c', 8],
        ['d', null],
      ] as const) {
        await sql`
          INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity,
                              cancellation_deadline_hours)
          VALUES (${org!.id}, ${user!.id}, ${title}, now() + interval '1 day', now() + interval '2 day', 10, ${hours})`
      }
      const [empty] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id)
        VALUES ('empty-org', 'Empty', ${user!.id}) RETURNING id`

      const [manual] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id, cancellation_deadline_hours)
        VALUES ('manual-org', 'Manual', ${user!.id}, 12) RETURNING id`
      const [fresh] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id)
        VALUES ('fresh-org', 'Fresh', ${user!.id}) RETURNING id`
      expect(
        (
          await sql`SELECT cancellation_deadline_hours FROM organizations WHERE id = ${fresh!.id}`
        )[0]!.cancellation_deadline_hours,
      ).toBeNull() // до 0022 default NULL

      await runMigrations(url)

      const [o] = await sql`SELECT * FROM organizations WHERE id = ${org!.id}`
      expect(o).toMatchObject({
        max_seats_per_booking: 3,
        default_price_mode: 'fixed',
        default_join_mode: 'open',
        cancellation_allowed: true,
        cancellation_deadline_hours: 5,
        seo_index: false,
        district: null,
      })
      const [o2] =
        await sql`SELECT cancellation_deadline_hours FROM organizations WHERE id = ${empty!.id}`
      expect(o2!.cancellation_deadline_hours).toBe(6)
      // явно заданное значение не перезаписывается
      const [o3] =
        await sql`SELECT cancellation_deadline_hours FROM organizations WHERE id = ${manual!.id}`
      expect(o3!.cancellation_deadline_hours).toBe(12)
      // новая группа получает DEFAULT 6
      const [o4] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id)
        VALUES ('new-org', 'New', ${user!.id}) RETURNING cancellation_deadline_hours`
      expect(o4).toMatchObject({ cancellation_deadline_hours: 6 })
      const evs =
        await sql`SELECT cancellation_allowed, cancellation_deadline_hours FROM events WHERE title = 'c'`
      expect(evs[0]).toMatchObject({ cancellation_allowed: true, cancellation_deadline_hours: 8 })
    } finally {
      await sql.end()
    }
  })

  it('enforces CHECK constraints on the new columns', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('c@example.com') RETURNING id`
      const insert = (seats: number, hours: number | null) => sql`
        INSERT INTO organizations (slug, name, owner_user_id, max_seats_per_booking,
                                   cancellation_deadline_hours)
        VALUES (${`o-${seats}-${hours}`}, 'X', ${user!.id}, ${seats}, ${hours})`
      await expect(insert(0, null)).rejects.toThrow(/organizations_max_seats_range/)
      await expect(insert(11, null)).rejects.toThrow(/organizations_max_seats_range/)
      await expect(insert(3, -1)).rejects.toThrow(/organizations_cancellation_deadline/)
      await expect(insert(1, 0)).resolves.toBeDefined()
      await expect(insert(10, null)).resolves.toBeDefined()
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
      const before = {
        organizations: await count('organizations'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
      }
      expect(before.events).toBeGreaterThan(0)

      // сид отражает настройки: группы различаются, события хранят снимок политики
      const settings = await sql`
        SELECT slug, max_seats_per_booking, cancellation_deadline_hours, default_join_mode
        FROM organizations ORDER BY slug`
      expect(new Set(settings.map((s) => s.max_seats_per_booking)).size).toBeGreaterThan(1)
      const mismatched = await sql`
        SELECT e.id FROM events e JOIN organizations o ON o.id = e.organization_id
        WHERE e.cancellation_deadline_hours IS DISTINCT FROM o.cancellation_deadline_hours`
      expect(mismatched).toHaveLength(0)

      // откат 0025 требует отсутствия данных нескольких мест (precondition rollback-скрипта)
      await sql`UPDATE bookings SET seats = 1, waitlist_seats = 0 WHERE seats > 1 OR waitlist_seats > 0`
      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG25)

      expect(await rollbackLastMigration(url)).toBe(TAG24)
      expect(await rollbackLastMigration(url)).toBe(TAG23)
      expect(await rollbackLastMigration(url)).toBe(TAG22)
      expect(await columns(sql, 'organizations')).toContain('max_seats_per_booking')
      const [d] = await sql`
        SELECT column_default FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'cancellation_deadline_hours'`
      expect(d!.column_default).toBeNull()
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect({
        organizations: await count('organizations'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
      }).toEqual(before)
      expect(await columns(sql, 'organizations')).not.toContain('max_seats_per_booking')

      await runMigrations(url)
      expect(await count('events')).toBe(before.events)
      const [o] = await sql`SELECT max_seats_per_booking FROM organizations LIMIT 1`
      expect(o!.max_seats_per_booking).toBe(3)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
