import { randomBytes } from 'node:crypto'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackGroupPageModeration, rollbackMembershipRolesCoach } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'

const TAG = '0046_group_page_moderation'
const PREVIOUS = '0045_feature_events'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''
const HASH = 'a'.repeat(64)

/**
 * Task 24.1.3 (R-06, D-08): решения root по страницам групп, жалобы и счётчик лимита. Миграция
 * аддитивна, без сида; откат отказывает, пока есть решения или жалобы.
 */
describe('migration 0046 group page moderation (integration)', { timeout: 90_000 }, () => {
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

  async function tables(sql: postgres.Sql): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN
        ('group_page_moderation', 'group_page_complaints', 'group_page_complaint_throttle')`
    return row!.n
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
      expect(await tables(sql)).toBe(3)
      expect(await rollbackGroupPageModeration(url)).toBe(TAG)
      expect(await tables(sql)).toBe(0)
      await runMigrations(url)
      expect(await tables(sql)).toBe(3)
    } finally {
      await sql.end()
    }
  })

  it('checks states, reasons and complaint resolution; rows go with the group', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await org(sql, 'gpm-check')
      await expect(
        sql`INSERT INTO group_page_moderation (organization_id, state, reason_code)
          VALUES (${id}, 'banned', 'price')`,
      ).rejects.toThrow(/group_page_moderation_state_chk/)
      await expect(
        sql`INSERT INTO group_page_moderation (organization_id, state, reason_code)
          VALUES (${id}, 'hidden', 'rude')`,
      ).rejects.toThrow(/group_page_moderation_reason_chk/)
      await sql`INSERT INTO group_page_moderation (organization_id, state, reason_code)
        VALUES (${id}, 'hidden', 'price')`
      await expect(
        sql`INSERT INTO group_page_complaints (organization_id, reason_code, reporter_hash)
          VALUES (${id}, 'spam', ${HASH})`,
      ).rejects.toThrow(/group_page_complaints_reason_chk/)
      await expect(
        sql`INSERT INTO group_page_complaints (organization_id, reason_code, reporter_hash, status)
          VALUES (${id}, 'price', ${HASH}, 'rejected')`,
      ).rejects.toThrow(/group_page_complaints_resolution_chk/)
      await expect(
        sql`INSERT INTO group_page_complaints
            (organization_id, reason_code, reporter_hash, status, resolution, resolved_at)
          VALUES (${id}, 'price', ${HASH}, 'resolved', 'no_violation', now())`,
      ).rejects.toThrow(/group_page_complaints_resolution_chk/)
      await sql`INSERT INTO group_page_complaints (organization_id, reason_code, reporter_hash)
        VALUES (${id}, 'price', ${HASH})`
      await sql`DELETE FROM organizations WHERE id = ${id}`
      expect(await sql`SELECT 1 FROM group_page_moderation`).toHaveLength(0)
      expect(await sql`SELECT 1 FROM group_page_complaints`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while decisions or complaints exist', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const id = await org(sql, 'gpm-guard')
      await sql`INSERT INTO group_page_moderation (organization_id, state, reason_code)
        VALUES (${id}, 'noindex', 'spam')`
      await rollbackMembershipRolesCoach(url) // 30.1.1: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0046 refused/)
      await sql`DELETE FROM group_page_moderation`
      await sql`INSERT INTO group_page_complaints (organization_id, reason_code, reporter_hash)
        VALUES (${id}, 'other', ${HASH})`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0046 refused/)
      expect(await tables(sql)).toBe(3)
      await sql`DELETE FROM group_page_complaints`
      await sql`INSERT INTO group_page_complaint_throttle (day, limited) VALUES ('2026-11-23', 2)`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
      expect(await sql`SELECT 1 FROM organizations WHERE id = ${id}`).toHaveLength(1)
    } finally {
      await sql.end()
    }
  })
})
