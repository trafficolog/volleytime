import { randomBytes } from 'node:crypto'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'

const TAG = '0043_user_features'
const PREVIOUS = '0042_platform_settings'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 23.1.1 (P-12): таблица `user_features`. Миграция аддитивна, без сида и бэкфилла (строки нет —
 * функция включена); откат отказывает, пока игрок выключил хоть одну функцию.
 */
describe('migration 0043 user features (integration)', { timeout: 90_000 }, () => {
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
      WHERE table_schema = 'public' AND table_name = 'user_features'`
    return row!.n === 1
  }

  async function user(sql: postgres.Sql, name: string): Promise<number> {
    const [u] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${name}@example.com`}) RETURNING id`
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
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('keeps the previous insert path working: a new user has no rows', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await user(sql, 'uf-compat')
      expect(await sql`SELECT 1 FROM user_features`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('accepts only the eight flags, one row per user and flag', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await user(sql, 'uf-check')
      for (const f of ['cal', 'coach', 'warmup', 'self', 'mvp', 'teams', 'streak', 'wrapped'])
        await sql`INSERT INTO user_features (user_id, feature, enabled) VALUES (${id}, ${f}, false)`
      await expect(
        sql`INSERT INTO user_features (user_id, feature, enabled) VALUES (${id}, 'schedule', false)`,
      ).rejects.toThrow(/user_features_feature_chk/)
      await expect(
        sql`INSERT INTO user_features (user_id, feature, enabled) VALUES (${id}, 'cal', true)`,
      ).rejects.toThrow(/user_features_user_id_feature_pk/)
    } finally {
      await sql.end()
    }
  })

  it('removes the rows together with the user', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await user(sql, 'uf-cascade')
      await sql`INSERT INTO user_features (user_id, feature, enabled) VALUES (${id}, 'cal', false)`
      await sql`DELETE FROM users WHERE id = ${id}`
      expect(await sql`SELECT 1 FROM user_features`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a feature is switched off and passes once it is not', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await user(sql, 'uf-guard')
      await sql`INSERT INTO user_features (user_id, feature, enabled) VALUES (${id}, 'mvp', false)`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0043 refused/)
      expect(await tableExists(sql)).toBe(true)
      await sql`UPDATE user_features SET enabled = true`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
      expect(await sql`SELECT 1 FROM users WHERE id = ${id}`).toHaveLength(1)
    } finally {
      await sql.end()
    }
  })
})
