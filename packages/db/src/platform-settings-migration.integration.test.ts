import { randomBytes } from 'node:crypto'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'

const TAG = '0042_platform_settings'
const PREVIOUS = '0041_event_balance_packages'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 22.3.1 (ADR-22-3-1, D-20): таблица `platform_settings` и колонка безлимита событий группы.
 * Миграция аддитивна, без сида и бэкфилла; откат отказывает при любой строке настроек и при любой
 * заданной дате безлимита (даже истёкшей).
 */
describe('migration 0042 platform settings (integration)', { timeout: 90_000 }, () => {
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

  async function objects(sql: postgres.Sql): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      SELECT (
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'platform_settings')
        + (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'organizations'
            AND column_name = 'event_balance_unlimited_until')
      )::int AS n`
    return row!.n
  }

  async function org(sql: postgres.Sql, slug: string): Promise<number> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    return o!.id
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
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(2)
    } finally {
      await sql.end()
    }
  })

  it('keeps the previous insert path working: new organization has no unlimited date', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await org(sql, 'ps-compat')
      const [row] =
        await sql`SELECT event_balance_unlimited_until FROM organizations WHERE id = ${id}`
      expect(row!.event_balance_unlimited_until).toBeNull()
      // старое приложение таблицу не читает: стартовое поведение без строк не зависит от неё
      expect(await sql`SELECT 1 FROM platform_settings`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('enforces the key format, unique key and version >= 1', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await sql`INSERT INTO platform_settings (key, value) VALUES ('general.platformName', '"X"')`
      await expect(
        sql`INSERT INTO platform_settings (key, value) VALUES ('general.platformName', '"Y"')`,
      ).rejects.toThrow(/platform_settings_key_unique/)
      for (const bad of ['nodot', 'General.name', 'a.b.c', 'a.1b', 'a.b-c', '']) {
        await expect(
          sql`INSERT INTO platform_settings (key, value) VALUES (${bad}, '1')`,
        ).rejects.toThrow(/platform_settings_key_format/)
      }
      await expect(
        sql`INSERT INTO platform_settings (key, value, version) VALUES ('a.b', '1', 0)`,
      ).rejects.toThrow(/platform_settings_version_positive/)
    } finally {
      await sql.end()
    }
  })

  it('nulls updated_by when the user is deleted', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const [u] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('root@example.com') RETURNING id`
      await sql`INSERT INTO platform_settings (key, value, updated_by)
        VALUES ('a.b', '1', ${u!.id})`
      await sql`DELETE FROM users WHERE id = ${u!.id}`
      const [row] = await sql`SELECT updated_by FROM platform_settings WHERE key = 'a.b'`
      expect(row!.updated_by).toBeNull()
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a settings row exists and passes once it is removed', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await sql`INSERT INTO platform_settings (key, value) VALUES ('bot.callbackLimit', '8')`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0042 refused/)
      expect(await objects(sql)).toBe(2)
      await sql`DELETE FROM platform_settings`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while any unlimited date is set, even an expired one', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await org(sql, 'ps-guard')
      await sql`UPDATE organizations SET event_balance_unlimited_until = now() - interval '1 day'
        WHERE id = ${id}`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0042 refused/)
      expect(await objects(sql)).toBe(2)
      await sql`UPDATE organizations SET event_balance_unlimited_until = NULL`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations WHERE id = ${id}`).toHaveLength(1)
    } finally {
      await sql.end()
    }
  })
})
