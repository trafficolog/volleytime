import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackScheduleSlots } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0034_player_position'
const TAG33 = '0033_ledger_method_categories'
const CODES = ['setter', 'outside_hitter', 'opposite', 'middle_blocker', 'libero', 'utility']
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.22: амплуа игрока по членству в группе. Миграция аддитивна (enum `player_position`,
 * nullable `organization_members.position`): применяется и откатывается на пустой базе, после
 * demo-сида и на базе на 0033 с участниками. Откат отказывает, пока у кого-то амплуа задано;
 * повторное применение возвращает схему.
 */
describe('migration 0034 player position (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public' AND table_name = 'organization_members'
            AND column_name = 'position')
        + (SELECT count(*) FROM pg_type WHERE typname = 'player_position')
      )::int AS n`
    return row!.n
  }

  async function org(sql: postgres.Sql, slug: string): Promise<{ o: number; u: number }> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    await sql`INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (${o!.id}, ${user!.id}, 'owner')`
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
      const values = await sql<{ v: string }[]>`
        SELECT unnest(enum_range(NULL::player_position))::text AS v`
      expect(values.map((r) => r.v)).toEqual(CODES)

      await rollbackScheduleSlots(url) // 21.2.12: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)

      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0033 members unchanged, leaves the position empty and stays compatible with the previous app', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await rollbackScheduleSlots(url) // 21.2.12: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0033
      const a = await org(sql, 'pp-a')
      await sql`UPDATE organization_members SET level = 'v2' WHERE organization_id = ${a.o}`
      const [other] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('pp-b@example.com') RETURNING id`
      await sql`INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (${a.o}, ${other!.id}, 'player')`

      await runMigrations(url)
      const rows = await sql<{ position: string | null; level: string | null }[]>`
        SELECT position, level FROM organization_members WHERE organization_id = ${a.o}`
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.position === null)).toBe(true)
      expect(rows.some((r) => r.level === 'v2')).toBe(true)

      // прежнее приложение не знает колонки: его INSERT и UPDATE продолжают работать
      const [third] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('pp-c@example.com') RETURNING id`
      await sql`INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (${a.o}, ${third!.id}, 'player')`
      await sql`UPDATE organization_members SET status = 'active', level = 'v3'
        WHERE user_id = ${third!.id}`
    } finally {
      await sql.end()
    }
  })

  it('accepts the six codes and rejects anything else', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'pp-codes')
      for (const code of CODES) {
        await sql`UPDATE organization_members SET position = ${code}::player_position
          WHERE organization_id = ${a.o}`
      }
      await sql`UPDATE organization_members SET position = NULL WHERE organization_id = ${a.o}`
      await expect(
        sql`UPDATE organization_members SET position = 'goalkeeper' WHERE organization_id = ${a.o}`,
      ).rejects.toThrow(/player_position/)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while any position is set and passes once it is cleared', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'pp-guard')
      await sql`UPDATE organization_members SET position = 'libero' WHERE organization_id = ${a.o}`
      await rollbackScheduleSlots(url) // 21.2.12: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0034 refused/)
      expect(await objects(sql)).toBe(2)
      const [m] =
        await sql`SELECT position FROM organization_members WHERE organization_id = ${a.o}`
      expect(m!.position).toBe('libero')

      await sql`UPDATE organization_members SET position = NULL WHERE organization_id = ${a.o}`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM organization_members`).toHaveLength(1)
      expect(await rollbackLastMigration(url)).toBe(TAG33)
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
      const [members] = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM organization_members`
      // сид не раздаёт амплуа, поэтому откат проходит и не трогает участников
      expect(await sql`SELECT 1 FROM organization_members WHERE position IS NOT NULL`).toHaveLength(
        0,
      )
      await rollbackScheduleSlots(url) // 21.2.12: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organization_members`).toHaveLength(members!.n)
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
