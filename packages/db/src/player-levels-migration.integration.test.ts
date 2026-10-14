import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0023_player_levels'
const TAG22 = '0022_group_cancellation_default'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 19.2.3: миграция уровней В1–В4+ применяется и откатывается на пустой базе, на базе после
 * demo-сида и на базе, уже стоящей на 0022 с данными (ADR v3, «Правила совместимости», п. 6–7).
 * Каждый тест работает во временной БД, чтобы не мешать общей тестовой.
 */
describe('migration 0023 player levels (integration)', { timeout: 60_000 }, () => {
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

  async function exists(sql: postgres.Sql, kind: 'table' | 'type', name: string) {
    const rows =
      kind === 'table'
        ? await sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${name}`
        : await sql`SELECT 1 FROM pg_type WHERE typname = ${name}`
    return rows.length > 0
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
      expect(await exists(sql, 'table', 'player_levels')).toBe(true)
      expect(await columns(sql, 'organization_members')).toEqual(
        expect.arrayContaining(['level', 'rating_in_org']),
      )
      expect(await columns(sql, 'organizations')).toContain('levels')
      expect(await columns(sql, 'events')).toContain('level')

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await exists(sql, 'table', 'player_levels')).toBe(false)
      expect(await exists(sql, 'type', 'player_level')).toBe(false)
      expect(await columns(sql, 'organization_members')).not.toContain('level')
      expect(await columns(sql, 'organization_members')).toContain('rating_in_org')
      expect(await columns(sql, 'organizations')).not.toContain('levels')
      expect(await columns(sql, 'events')).not.toContain('level')

      await runMigrations(url)
      expect(await columns(sql, 'events')).toContain('level')
    } finally {
      await sql.end()
    }
  })

  it('fills the directory with five levels in scale order and keeps it idempotent', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const rows = await sql`SELECT * FROM player_levels ORDER BY sort_order`
      expect(rows.map((r) => [r.code, r.sort_order, r.title])).toEqual([
        ['v1', 1, 'В1'],
        ['v2', 2, 'В2'],
        ['v3', 3, 'В3'],
        ['v4', 4, 'В4'],
        ['v4_plus', 5, 'В4+'],
      ])
      for (const r of rows) expect(r.description.length).toBeGreaterThan(10)
      expect(rows[0]!.description).toMatch(/Полупрофи/)
      expect(rows[4]!.description).toMatch(/Начинающие/)

      // повторная вставка тех же кодов (ON CONFLICT DO NOTHING) ничего не ломает и не дублирует
      await sql`INSERT INTO player_levels VALUES ('v1', 9, 'x', 'y') ON CONFLICT (code) DO NOTHING`
      expect(await sql`SELECT 1 FROM player_levels`).toHaveLength(5)
      // порядок уникален
      await expect(sql`UPDATE player_levels SET sort_order = 1 WHERE code = 'v2'`).rejects.toThrow(
        /player_levels_sort_order_unique/,
      )
    } finally {
      await sql.end()
    }
  })

  it('keeps R0.7 data on a database already at 0022 and stays compatible with the previous app', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0022

      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('old@example.com') RETURNING id`
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id)
        VALUES ('old-org', 'Old', ${user!.id}) RETURNING id`
      await sql`
        INSERT INTO organization_members (organization_id, user_id, role, rating_in_org)
        VALUES (${org!.id}, ${user!.id}, 'owner', 7)`
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity)
        VALUES (${org!.id}, ${user!.id}, 'Old', now() + interval '1 day', now() + interval '2 day', 10)`

      await runMigrations(url)

      // данные на месте, новые поля пустые, rating_in_org не тронут
      const [m] = await sql`SELECT level, rating_in_org FROM organization_members`
      expect(m).toMatchObject({ level: null, rating_in_org: 7 })
      const [o] =
        await sql`SELECT cardinality(levels) AS n FROM organizations WHERE id = ${org!.id}`
      expect(o!.n).toBe(0)
      const [e] = await sql`SELECT level FROM events`
      expect(e!.level).toBeNull()

      // прежнее приложение не знает новых колонок: его INSERT-ы продолжают работать
      const [user2] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('old2@example.com') RETURNING id`
      await sql`
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (${org!.id}, ${user2!.id}, 'player')`
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity)
        VALUES (${org!.id}, ${user!.id}, 'Old 2', now() + interval '1 day', now() + interval '2 day', 10)`
      await sql`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('old-org-2', 'Old 2', ${user!.id})`

      // откат возвращает 0022 и не трогает остальные данные
      await sql`UPDATE organization_members SET level = 'v2' WHERE user_id = ${user!.id}`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT rating_in_org FROM organization_members ORDER BY id`).toEqual([
        expect.objectContaining({ rating_in_org: 7 }),
        expect.objectContaining({ rating_in_org: null }),
      ])
      expect(await sql`SELECT 1 FROM events`).toHaveLength(2)
      expect(await rollbackLastMigration(url)).toBe(TAG22) // следующая в стеке — 0022
    } finally {
      await sql.end()
    }
  })

  it('enforces the enum and the directory foreign keys on the new columns', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('c@example.com') RETURNING id`
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('c-org', 'C', ${user!.id}) RETURNING id`
      await expect(
        sql`INSERT INTO organization_members (organization_id, user_id, level)
            VALUES (${org!.id}, ${user!.id}, 'b2')`,
      ).rejects.toThrow(/player_level/)
      await expect(
        sql`UPDATE organizations SET levels = ARRAY['v1','zz']::text[]::player_level[] WHERE id = ${org!.id}`,
      ).rejects.toThrow(/player_level/)
      await sql`UPDATE organizations SET levels = ARRAY['v1','v4_plus']::player_level[] WHERE id = ${org!.id}`
      // уровень справочника нельзя удалить, пока он назначен
      await sql`INSERT INTO organization_members (organization_id, user_id, level)
                VALUES (${org!.id}, ${user!.id}, 'v3')`
      await expect(sql`DELETE FROM player_levels WHERE code = 'v3'`).rejects.toThrow(
        /organization_members_level_player_levels_code_fk/,
      )
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
        members: await count('organization_members'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
      }

      // сид раздаёт уровни: игрокам, группам (несколько) и событиям
      const memberLevels = await sql`SELECT DISTINCT level FROM organization_members`
      expect(memberLevels.length).toBeGreaterThan(2)
      expect(memberLevels.every((r) => r.level !== null)).toBe(true)
      const groups = await sql`SELECT cardinality(levels) AS n FROM organizations`
      expect(groups.every((g) => g.n >= 2)).toBe(true)
      expect(await sql`SELECT 1 FROM events WHERE level IS NOT NULL`).not.toHaveLength(0)

      // повторный сид идемпотентен и не меняет уже назначенные уровни
      await sql`UPDATE organization_members SET level = 'v4_plus' WHERE id = (SELECT min(id) FROM organization_members)`
      await seedDemo(database)
      expect(await count('organization_members')).toBe(before.members)
      expect(
        (await sql`SELECT level FROM organization_members ORDER BY id LIMIT 1`)[0]!.level,
      ).toBe('v4_plus')

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect({
        organizations: await count('organizations'),
        members: await count('organization_members'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
      }).toEqual(before)
      expect(await columns(sql, 'organization_members')).not.toContain('level')

      await runMigrations(url)
      expect(await count('events')).toBe(before.events)
      expect(await count('player_levels')).toBe(5)
      const [member] = await sql`SELECT level FROM organization_members LIMIT 1`
      expect(member!.level).toBeNull()
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
