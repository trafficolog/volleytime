import { randomBytes } from 'node:crypto'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackFeatureEvents } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'

const TAG = '0045_feature_events'
const PREVIOUS = '0044_group_pages'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 23.1.2 (P-14, D-25): таблица `feature_events`. Миграция аддитивна, без сида и бэкфилла;
 * одно событие вида на игрока, функцию и сутки; откат отказывает, пока есть события.
 */
describe('migration 0045 feature events (integration)', { timeout: 90_000 }, () => {
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
      WHERE table_schema = 'public' AND table_name = 'feature_events'`
    return row!.n === 1
  }

  async function user(sql: postgres.Sql, tag: string): Promise<number> {
    const [u] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${tag}@example.com`}) RETURNING id`
    return u!.id
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
      expect(await tableExists(sql)).toBe(true)
      expect(await rollbackFeatureEvents(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('dedupes per user, feature, kind and day; checks values; rows go with the user', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await user(sql, 'fe-check')
      await sql`INSERT INTO feature_events (user_id, feature, kind, day)
        VALUES (${id}, 'cal', 'open', '2026-11-22')`
      await expect(
        sql`INSERT INTO feature_events (user_id, feature, kind, day)
          VALUES (${id}, 'cal', 'open', '2026-11-22')`,
      ).rejects.toThrow(/feature_events_user_feature_kind_day_uq/)
      await sql`INSERT INTO feature_events (user_id, feature, kind, day)
        VALUES (${id}, 'cal', 'use', '2026-11-22'), (${id}, 'cal', 'open', '2026-11-23')`
      await expect(
        sql`INSERT INTO feature_events (user_id, feature, kind, day)
          VALUES (${id}, 'booking', 'open', '2026-11-22')`,
      ).rejects.toThrow(/feature_events_feature_chk/)
      await expect(
        sql`INSERT INTO feature_events (user_id, feature, kind, day)
          VALUES (${id}, 'cal', 'click', '2026-11-22')`,
      ).rejects.toThrow(/feature_events_kind_chk/)
      await sql`DELETE FROM users WHERE id = ${id}`
      expect(await sql`SELECT 1 FROM feature_events`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while events exist and passes once they are gone', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await user(sql, 'fe-guard')
      await sql`INSERT INTO feature_events (user_id, feature, kind, day)
        VALUES (${id}, 'cal', 'open', '2026-11-22')`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0045 refused/)
      expect(await tableExists(sql)).toBe(true)
      await sql`DELETE FROM feature_events`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
      expect(await sql`SELECT 1 FROM users WHERE id = ${id}`).toHaveLength(1)
    } finally {
      await sql.end()
    }
  })
})
