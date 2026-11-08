import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0037_organization_logo_short_link'
const PREVIOUS = '0036_organization_payment_methods'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.16: логотип и короткая ссылка группы. Миграция аддитивна: таблица
 * `organization_logos` и две nullable-колонки `organizations` (`short_link`, `logo_updated_at`).
 * Применяется и откатывается на пустой базе и после demo-сида; откат отказывает, пока задан
 * логотип или короткая ссылка.
 */
describe(
  'migration 0037 organization logo and short link (integration)',
  { timeout: 60_000 },
  () => {
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

    /** 1 таблица + 2 колонки = 3 объекта схемы. */
    async function objects(sql: postgres.Sql) {
      const [row] = await sql<{ n: number }[]>`
      SELECT (
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organization_logos')
        + (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'organizations'
            AND column_name IN ('short_link', 'logo_updated_at'))
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

    const png = Buffer.from('89504e470d0a1a0a0000000d', 'hex')

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
        expect(await objects(sql)).toBe(3)
        expect(await rollbackLastMigration(url)).toBe(TAG)
        expect(await objects(sql)).toBe(0)
        await runMigrations(url)
        expect(await objects(sql)).toBe(3)
      } finally {
        await sql.end()
      }
    })

    it('keeps existing groups valid: both columns default to NULL and the previous app is unaffected', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const o = await org(sql, 'logo-compat')
        const [row] = await sql<{ short_link: string | null; logo_updated_at: Date | null }[]>`
        SELECT short_link, logo_updated_at FROM organizations WHERE id = ${o}`
        expect(row).toEqual({ short_link: null, logo_updated_at: null })
        // прежнее приложение колонок не знает: его запросы к группам работают
        await sql`UPDATE organizations SET name = 'renamed', slug = 'logo-compat-2' WHERE id = ${o}`
      } finally {
        await sql.end()
      }
    })

    it('enforces the short link: format, uniqueness, many NULLs, independent of slug', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const a = await org(sql, 'sl-a')
        const b = await org(sql, 'sl-b')
        const c = await org(sql, 'sl-c')
        await sql`UPDATE organizations SET short_link = 'vt-minsk' WHERE id = ${a}`
        // уникальность по платформе (хранится строчными, регистр не создаёт второго значения)
        await expect(
          sql`UPDATE organizations SET short_link = 'vt-minsk' WHERE id = ${b}`,
        ).rejects.toThrow(/organizations_short_link_uniq/)
        await expect(
          sql`UPDATE organizations SET short_link = 'VT-Minsk' WHERE id = ${b}`,
        ).rejects.toThrow(/organizations_short_link_format/)
        // формат: 3-32 знака, строчные латинские, цифры и дефис, дефис не по краям и не двойной
        for (const bad of ['ab', '-abc', 'abc-', 'a--b', 'a_b', 'абв', 'a b', 'x'.repeat(33)]) {
          await expect(
            sql`UPDATE organizations SET short_link = ${bad} WHERE id = ${b}`,
          ).rejects.toThrow(/organizations_short_link_format|value too long/)
        }
        await sql`UPDATE organizations SET short_link = 'abc' WHERE id = ${b}`
        await sql`UPDATE organizations SET short_link = ${'a' + 'b'.repeat(30) + 'c'} WHERE id = ${c}`
        // несколько групп без ссылки допустимы
        await sql`UPDATE organizations SET short_link = NULL WHERE id IN (${b}, ${c})`
        const [slug] = await sql<{ slug: string }[]>`SELECT slug FROM organizations WHERE id = ${a}`
        expect(slug!.slug).toBe('sl-a')
      } finally {
        await sql.end()
      }
    })

    it('enforces the logo table: one per group, png/jpeg only, size limit, cascade', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const o = await org(sql, 'logo-table')
        await sql`INSERT INTO organization_logos (organization_id, data, mime_type, size_bytes)
        VALUES (${o}, ${png}, 'image/png', ${png.length})`
        await expect(
          sql`INSERT INTO organization_logos (organization_id, data, mime_type, size_bytes)
          VALUES (${o}, ${png}, 'image/png', ${png.length})`,
        ).rejects.toThrow(/organization_logos_pkey/)
        await sql`UPDATE organization_logos SET mime_type = 'image/jpeg'`
        await expect(
          sql`UPDATE organization_logos SET mime_type = 'image/svg+xml'`,
        ).rejects.toThrow(/organization_logos_mime_chk/)
        await expect(sql`UPDATE organization_logos SET mime_type = 'image/gif'`).rejects.toThrow(
          /organization_logos_mime_chk/,
        )
        // size_bytes обязан совпадать с байтами и не превышать 512 КБ
        await expect(sql`UPDATE organization_logos SET size_bytes = 1`).rejects.toThrow(
          /organization_logos_data_size_chk/,
        )
        const big = Buffer.alloc(524_289)
        await expect(
          sql`UPDATE organization_logos SET data = ${big}, size_bytes = ${big.length}`,
        ).rejects.toThrow(/organization_logos_size_chk/)
        await sql`DELETE FROM organizations WHERE id = ${o}`
        expect(await sql`SELECT 1 FROM organization_logos`).toHaveLength(0)
      } finally {
        await sql.end()
      }
    })

    it('refuses the rollback while a logo or short link is set, and passes once cleared', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const o = await org(sql, 'guard-a')
        await sql`UPDATE organizations SET short_link = 'guard-link' WHERE id = ${o}`
        await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0037 refused/)
        expect(await objects(sql)).toBe(3)
        await sql`UPDATE organizations SET short_link = NULL`

        await sql`UPDATE organizations SET logo_updated_at = now() WHERE id = ${o}`
        await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0037 refused/)
        await sql`UPDATE organizations SET logo_updated_at = NULL`

        await sql`INSERT INTO organization_logos (organization_id, data, mime_type, size_bytes)
        VALUES (${o}, ${png}, 'image/png', ${png.length})`
        await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0037 refused/)
        expect(await sql`SELECT 1 FROM organization_logos`).toHaveLength(1)
        await sql`DELETE FROM organization_logos`

        expect(await rollbackLastMigration(url)).toBe(TAG)
        expect(await objects(sql)).toBe(0)
        expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
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
        const [orgs] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM organizations`
        // сид не создаёт логотипов и ссылок, поэтому откат проходит и не трогает группы
        expect(await sql`SELECT 1 FROM organization_logos`).toHaveLength(0)
        expect(await sql`SELECT 1 FROM organizations WHERE short_link IS NOT NULL`).toHaveLength(0)
        expect(await rollbackLastMigration(url)).toBe(TAG)
        expect(await sql`SELECT 1 FROM organizations`).toHaveLength(orgs!.n)
        await runMigrations(url)
        expect(await objects(sql)).toBe(3)
      } finally {
        await client.end()
        await sql.end()
      }
    })
  },
)
