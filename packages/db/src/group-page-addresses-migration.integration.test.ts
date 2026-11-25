import { randomBytes } from 'node:crypto'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackGroupPageAddresses } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'

const TAG = '0049_group_page_addresses'
const PREVIOUS = '0048_platform_staff'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 24.2.1 (D-26): история адресов страниц групп. Миграция аддитивна (прежний runtime таблицу
 * не читает), без бэкфилла; один прежний адрес — одна группа; откат отказывает, пока есть история.
 */
describe('migration 0049 group page addresses (integration)', { timeout: 90_000 }, () => {
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

  async function applied(sql: postgres.Sql): Promise<boolean> {
    const [row] = await sql<{ ok: boolean }[]>`
      SELECT to_regclass('public.group_page_addresses') IS NOT NULL AS ok`
    return row!.ok
  }

  async function org(sql: postgres.Sql, slug: string): Promise<number> {
    const [u] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${u!.id})
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
      expect(await applied(sql)).toBe(true)
      expect(await rollbackGroupPageAddresses(url)).toBe(TAG)
      expect(await applied(sql)).toBe(false)
      await runMigrations(url)
      expect(await applied(sql)).toBe(true)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
    } finally {
      await sql.end()
    }
  })

  it('keeps one group per old address, checks slugs, rows go with the group', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'gpa-a')
      const b = await org(sql, 'gpa-b')
      await sql`INSERT INTO group_page_addresses (city_slug, group_slug, organization_id)
        VALUES ('minsk', 'old', ${a}), ('', 'old', ${a})`
      await expect(
        sql`INSERT INTO group_page_addresses (city_slug, group_slug, organization_id)
          VALUES ('minsk', 'old', ${b})`,
      ).rejects.toThrow(/group_page_addresses_city_slug_group_slug_pk/)
      await expect(
        sql`INSERT INTO group_page_addresses (city_slug, group_slug, organization_id)
          VALUES ('Minsk', 'x', ${b})`,
      ).rejects.toThrow(/group_page_addresses_city_slug_chk/)
      await expect(
        sql`INSERT INTO group_page_addresses (city_slug, group_slug, organization_id)
          VALUES ('minsk', '-x', ${b})`,
      ).rejects.toThrow(/group_page_addresses_group_slug_chk/)
      await sql`DELETE FROM organizations WHERE id = ${a}`
      const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM group_page_addresses`
      expect(n!.n).toBe(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses rollback while history exists', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'gpa-r')
      await sql`INSERT INTO group_page_addresses (city_slug, group_slug, organization_id)
        VALUES ('pinsk', 'old', ${a})`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0049 refused/)
      expect(await applied(sql)).toBe(true)
      await sql`DELETE FROM group_page_addresses`
      expect(await rollbackLastMigration(url)).toBe(TAG)
    } finally {
      await sql.end()
    }
  })
})
