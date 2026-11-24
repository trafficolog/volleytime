import { randomBytes } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackPlatformStaff } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'

const TAG = '0048_platform_staff'
const PREVIOUS = '0047_membership_roles_coach'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''
const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

/**
 * Task 29.3.1 (R-15, D-28): команда платформы с ролями вместо флага `users.is_root_admin`. Текущие
 * root переходят в `owner`; флаг остаётся для прежнего runtime. Откат возвращает флаг по роли owner и
 * отказывает, пока в команде есть другие роли; повторное применение снова переносит root.
 */
describe('migration 0048 platform staff (integration)', { timeout: 90_000 }, () => {
  const admin = postgres(BASE_URL, { max: 1 })
  const created: string[] = []
  let upTo47: string

  async function scratchDb(): Promise<{ url: string; sql: postgres.Sql }> {
    const name = `vt_mig_${randomBytes(4).toString('hex')}`
    await admin.unsafe(`CREATE DATABASE ${name}`)
    created.push(name)
    const url = new URL(BASE_URL)
    url.pathname = `/${name}`
    return { url: url.toString(), sql: postgres(url.toString(), { max: 2 }) }
  }

  async function migrateTo47(url: string) {
    const client = postgres(url, { max: 1 })
    try {
      await migrate(drizzle(client), { migrationsFolder: upTo47 })
    } finally {
      await client.end()
    }
  }

  const applied = async (sql: postgres.Sql) =>
    (await sql<{ a: boolean }[]>`SELECT to_regclass('public.platform_staff') IS NOT NULL AS a`)[0]!
      .a

  const staff = (sql: postgres.Sql) =>
    sql<{ userId: number; role: string }[]>`
      SELECT user_id AS "userId", role::text AS role FROM platform_staff ORDER BY user_id`

  const flags = async (sql: postgres.Sql) =>
    (await sql<{ id: number }[]>`SELECT id FROM users WHERE is_root_admin ORDER BY id`).map(
      (r) => r.id,
    )

  beforeAll(async () => {
    expect(BASE_URL).not.toBe('')
    upTo47 = await mkdtemp(path.join(tmpdir(), 'vt-mig-47-'))
    await cp(MIGRATIONS, upTo47, { recursive: true })
    const journalPath = path.join(upTo47, 'meta/_journal.json')
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      entries: { tag: string }[]
    }
    journal.entries = journal.entries.slice(
      0,
      journal.entries.findIndex((e) => e.tag === TAG),
    )
    await writeFile(journalPath, JSON.stringify(journal))
  })

  afterAll(async () => {
    for (const name of created) await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await admin.end()
    await rm(upTo47, { recursive: true, force: true })
  })

  it('applies, rolls back and re-applies on an empty database', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await applied(sql)).toBe(true)
      expect(await rollbackPlatformStaff(url)).toBe(TAG)
      expect(await applied(sql)).toBe(false)
      await runMigrations(url)
      expect(await applied(sql)).toBe(true)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
    } finally {
      await sql.end()
    }
  })

  it('moves current root admins to owner and keeps one role per person', async () => {
    const { url, sql } = await scratchDb()
    try {
      await migrateTo47(url)
      const [root, plain] = await sql<{ id: number }[]>`
        INSERT INTO users (email, is_root_admin) VALUES ('ps-root@example.com', true),
          ('ps-plain@example.com', false) RETURNING id`
      const [session] = await sql<{ id: number }[]>`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (${root!.id}, 'ps-token', now() + interval '1 day') RETURNING id`
      await runMigrations(url)
      expect(await staff(sql)).toEqual([{ userId: root!.id, role: 'owner' }])
      // вход без повторной авторизации: сессия root не тронута
      expect(await sql`SELECT 1 FROM sessions WHERE id = ${session!.id}`).toHaveLength(1)
      await expect(
        sql`INSERT INTO platform_staff (user_id, role) VALUES (${root!.id}, 'support')`,
      ).rejects.toThrow(/platform_staff_pkey/)
      await expect(
        sql`INSERT INTO platform_staff (user_id, role) VALUES (${plain!.id}, 'root')`,
      ).rejects.toThrow(/invalid input value for enum/)
      // строка уходит вместе с пользователем
      await sql`INSERT INTO platform_staff (user_id, role, invited_by)
        VALUES (${plain!.id}, 'owner', ${root!.id})`
      await sql`DELETE FROM users WHERE id = ${root!.id}`
      expect(await staff(sql)).toEqual([{ userId: plain!.id, role: 'owner' }])
      const [row] = await sql<{ by: number | null }[]>`SELECT invited_by AS by FROM platform_staff`
      expect(row!.by).toBeNull()
    } finally {
      await sql.end()
    }
  })

  it('rollback mirrors owners into the flag and refuses while other roles exist', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const [a, b, c] = await sql<{ id: number }[]>`
        INSERT INTO users (email, is_root_admin) VALUES ('ps-a@example.com', false),
          ('ps-b@example.com', true), ('ps-c@example.com', false) RETURNING id`
      // a — новый owner без флага, b — флаг без роли (снят из команды), c — поддержка
      await sql`INSERT INTO platform_staff (user_id, role) VALUES (${a!.id}, 'owner'),
        (${c!.id}, 'support')`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0048 refused/)
      expect(await applied(sql)).toBe(true)
      await sql`DELETE FROM platform_staff WHERE user_id = ${c!.id}`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await flags(sql)).toEqual([a!.id])
      expect(b).toBeDefined()
      // повторное применение снова переносит root в owner
      await runMigrations(url)
      expect(await staff(sql)).toEqual([{ userId: a!.id, role: 'owner' }])
    } finally {
      await sql.end()
    }
  })
})
