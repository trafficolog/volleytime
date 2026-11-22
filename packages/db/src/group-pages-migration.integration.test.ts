import { randomBytes } from 'node:crypto'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackGroupPages } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'

const TAG = '0044_group_pages'
const PREVIOUS = '0043_user_features'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 24.1.1 (W-13, D-24): таблица `organization_group_pages`. Миграция аддитивна, без сида и
 * бэкфилла (строки нет — страница по умолчанию); откат отказывает, пока есть сохранённая страница.
 */
describe('migration 0044 group pages (integration)', { timeout: 90_000 }, () => {
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
      WHERE table_schema = 'public' AND table_name = 'organization_group_pages'`
    return row!.n === 1
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
      expect(await tableExists(sql)).toBe(true)
      expect(await rollbackGroupPages(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('keeps the previous insert path working: a new group has no page row', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await org(sql, 'gp-compat')
      expect(await sql`SELECT 1 FROM organization_group_pages`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('one row per group, sections must be an array, rows go with the group', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await org(sql, 'gp-check')
      await sql`INSERT INTO organization_group_pages (organization_id, sections)
        VALUES (${id}, '[]'::jsonb)`
      await expect(
        sql`INSERT INTO organization_group_pages (organization_id, sections)
          VALUES (${id}, '[]'::jsonb)`,
      ).rejects.toThrow(/organization_group_pages_pkey/)
      const other = await org(sql, 'gp-check-2')
      await expect(
        sql`INSERT INTO organization_group_pages (organization_id, sections)
          VALUES (${other}, '{}'::jsonb)`,
      ).rejects.toThrow(/organization_group_pages_sections_chk/)
      await sql`DELETE FROM organizations WHERE id = ${id}`
      expect(await sql`SELECT 1 FROM organization_group_pages`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a page is saved and passes once it is not', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await org(sql, 'gp-guard')
      await sql`INSERT INTO organization_group_pages (organization_id, sections)
        VALUES (${id}, '[]'::jsonb)`
      await expect(rollbackGroupPages(url)).rejects.toThrow(/rollback 0044 refused/)
      expect(await tableExists(sql)).toBe(true)
      await sql`DELETE FROM organization_group_pages`
      expect(await rollbackGroupPages(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
      expect(await sql`SELECT 1 FROM organizations WHERE id = ${id}`).toHaveLength(1)
    } finally {
      await sql.end()
    }
  })
})
