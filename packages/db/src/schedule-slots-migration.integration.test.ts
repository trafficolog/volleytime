import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0035_schedule_slots'
const TAG34 = '0034_player_position'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.12: шаблоны слотов расписания группы. Миграция аддитивна (новая таблица
 * `schedule_slots`, никто её не читает, кроме нового runtime): применяется и откатывается на пустой
 * базе, после demo-сида и на базе на 0034 с группами. Откат отказывает, пока есть слоты; CHECK
 * держат границы дня, времени, длительности и мест; удаление зала оставляет слот без зала.
 */
describe('migration 0035 schedule slots (integration)', { timeout: 60_000 }, () => {
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

  async function tableExists(sql: postgres.Sql): Promise<boolean> {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schedule_slots'`
    return row!.n === 1
  }

  async function org(sql: postgres.Sql, slug: string): Promise<number> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    return o!.id
  }

  const insertSlot = (
    sql: postgres.Sql,
    orgId: number,
    over: Partial<{
      weekday: number
      startTime: string
      duration: number
      title: string
      capacity: number
      type: string
    }> = {},
  ) => sql`
    INSERT INTO schedule_slots (organization_id, weekday, start_time, duration_minutes, title, type, capacity)
    VALUES (${orgId}, ${over.weekday ?? 1}, ${over.startTime ?? '20:00'}, ${over.duration ?? 120},
      ${over.title ?? 'Основа'}, ${over.type ?? 'training'}::event_type, ${over.capacity ?? 12})
    RETURNING id`

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
      expect(await tableExists(sql)).toBe(true)

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)

      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0034 groups, events and venues unchanged', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0034
      const a = await org(sql, 'ss-a')
      await sql`INSERT INTO venues (organization_id, name) VALUES (${a}, 'Школа №24')`

      await runMigrations(url)
      expect(await sql`SELECT 1 FROM organizations WHERE id = ${a}`).toHaveLength(1)
      expect(await sql`SELECT 1 FROM venues WHERE organization_id = ${a}`).toHaveLength(1)
      expect(await sql`SELECT 1 FROM schedule_slots`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('enforces the weekday, time, duration, capacity, title and type bounds', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'ss-bounds')
      // границы допустимы
      await insertSlot(sql, a, { weekday: 1, startTime: '00:00', duration: 15, capacity: 1 })
      await insertSlot(sql, a, { weekday: 7, startTime: '23:59', duration: 1440, capacity: 500 })
      await insertSlot(sql, a, { type: 'open_game', title: 'Ab' })
      // вне границ
      const bad: Array<[string, Parameters<typeof insertSlot>[2]]> = [
        ['weekday_chk', { weekday: 0 }],
        ['weekday_chk', { weekday: 8 }],
        ['start_time_chk', { startTime: '24:00' }],
        ['start_time_chk', { startTime: '9:00' }],
        ['start_time_chk', { startTime: '20:60' }],
        ['duration_chk', { duration: 14 }],
        ['duration_chk', { duration: 1441 }],
        ['capacity_chk', { capacity: 0 }],
        ['capacity_chk', { capacity: 501 }],
        ['title_chk', { title: ' a ' }],
        ['title_chk', { title: 'x'.repeat(201) }],
        ['type_chk', { type: 'tournament_match' }],
      ]
      for (const [name, over] of bad) {
        await expect(insertSlot(sql, a, over), name).rejects.toThrow(
          new RegExp(`schedule_slots_${name}`),
        )
      }
    } finally {
      await sql.end()
    }
  })

  it('drops the venue link when the venue is deleted and cascades with the group', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'ss-venue')
      const [venue] = await sql<{ id: number }[]>`
        INSERT INTO venues (organization_id, name) VALUES (${a}, 'Зал') RETURNING id`
      const [slot] = await insertSlot(sql, a)
      await sql`UPDATE schedule_slots SET venue_id = ${venue!.id} WHERE id = ${slot!.id}`
      await sql`DELETE FROM venues WHERE id = ${venue!.id}`
      const [row] = await sql`SELECT venue_id FROM schedule_slots WHERE id = ${slot!.id}`
      expect(row!.venue_id).toBeNull()

      await sql`DELETE FROM organizations WHERE id = ${a}`
      expect(await sql`SELECT 1 FROM schedule_slots`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while any slot exists and passes once they are removed', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'ss-guard')
      await insertSlot(sql, a)
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0035 refused/)
      expect(await tableExists(sql)).toBe(true)
      expect(await sql`SELECT 1 FROM schedule_slots`).toHaveLength(1)

      await sql`DELETE FROM schedule_slots`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      expect(await rollbackLastMigration(url)).toBe(TAG34)
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
      const [groups] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM organizations`
      // сид слотов не создаёт, поэтому откат проходит и не трогает группы
      expect(await sql`SELECT 1 FROM schedule_slots`).toHaveLength(0)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(groups!.n)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
