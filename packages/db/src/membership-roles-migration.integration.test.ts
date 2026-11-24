import { randomBytes } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackMembershipRolesCoach } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0047_membership_roles_coach'
const PREVIOUS = '0046_group_page_moderation'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''
const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

/**
 * Task 30.1.1 (P-18, D-31): `assistant` → `coach` переименованием значения enum, флаг приёма оплаты
 * на членстве и тренеры события. Помощники становятся тренерами без приёма оплаты; прежний runtime
 * ещё может записать `assistant` (значение возвращено в конец enum). Откат отказывает, пока есть
 * флаги или тренеры событий; повторное применение после отката снова переводит помощников.
 */
describe('migration 0047 membership roles coach (integration)', { timeout: 90_000 }, () => {
  const admin = postgres(BASE_URL, { max: 1 })
  const created: string[] = []
  let upTo46: string

  async function scratchDb(): Promise<{ url: string; sql: postgres.Sql }> {
    const name = `vt_mig_${randomBytes(4).toString('hex')}`
    await admin.unsafe(`CREATE DATABASE ${name}`)
    created.push(name)
    const url = new URL(BASE_URL)
    url.pathname = `/${name}`
    return { url: url.toString(), sql: postgres(url.toString(), { max: 2 }) }
  }

  /** Схема до 0047: та же папка миграций без последней записи журнала. */
  async function migrateTo46(url: string) {
    const client = postgres(url, { max: 1 })
    try {
      await migrate(drizzle(client), { migrationsFolder: upTo46 })
    } finally {
      await client.end()
    }
  }

  async function labels(sql: postgres.Sql): Promise<string[]> {
    const rows = await sql<{ l: string }[]>`
      SELECT e.enumlabel AS l FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'member_role' ORDER BY e.enumsortorder`
    return rows.map((r) => r.l)
  }

  async function columns(sql: postgres.Sql): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND
        ((table_name = 'organization_members' AND column_name = 'can_accept_payment') OR
         (table_name = 'events' AND column_name = 'coach_user_ids'))`
    return row!.n
  }

  async function orgWithAssistant(sql: postgres.Sql, slug: string) {
    const [owner, helper] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}-o@example.com`}), (${`${slug}-a@example.com`})
      RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${owner!.id})
      RETURNING id`
    await sql`INSERT INTO organization_members (organization_id, user_id, role)
      VALUES (${o!.id}, ${owner!.id}, 'owner'), (${o!.id}, ${helper!.id}, 'assistant')`
    await sql`INSERT INTO invite_links (organization_id, created_by_user_id, token, role_to_assign)
      VALUES (${o!.id}, ${owner!.id}, ${`tok-${slug}`}, 'assistant')`
    return { orgId: o!.id, ownerId: owner!.id, helperId: helper!.id }
  }

  const roleOf = async (sql: postgres.Sql, userId: number) =>
    (
      await sql<{ role: string; flag: boolean }[]>`
        SELECT role::text AS role, can_accept_payment AS flag FROM organization_members
        WHERE user_id = ${userId}`
    )[0]

  beforeAll(async () => {
    expect(BASE_URL).not.toBe('')
    upTo46 = await mkdtemp(path.join(tmpdir(), 'vt-mig-46-'))
    await cp(MIGRATIONS, upTo46, { recursive: true })
    const journalPath = path.join(upTo46, 'meta/_journal.json')
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      entries: { tag: string }[]
    }
    journal.entries = journal.entries.filter((e) => e.tag !== TAG)
    await writeFile(journalPath, JSON.stringify(journal))
  })

  afterAll(async () => {
    for (const name of created) await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await admin.end()
    await rm(upTo46, { recursive: true, force: true })
  })

  it('applies, rolls back and re-applies on an empty database', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await labels(sql)).toEqual(['owner', 'organizer', 'coach', 'player', 'assistant'])
      expect(await columns(sql)).toBe(2)
      expect(await rollbackMembershipRolesCoach(url)).toBe(TAG)
      expect(await columns(sql)).toBe(0)
      await runMigrations(url)
      expect(await columns(sql)).toBe(2)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
    } finally {
      await sql.end()
    }
  })

  it('turns assistants and assistant invites into coaches without payment access', async () => {
    const { url, sql } = await scratchDb()
    try {
      await migrateTo46(url)
      const { ownerId, helperId } = await orgWithAssistant(sql, 'mrc-data')
      await runMigrations(url)
      expect(await roleOf(sql, helperId)).toEqual({ role: 'coach', flag: false })
      expect(await roleOf(sql, ownerId)).toEqual({ role: 'owner', flag: false })
      const [invite] = await sql<
        { r: string }[]
      >`SELECT role_to_assign::text AS r FROM invite_links`
      expect(invite!.r).toBe('coach')
      // прежний runtime в окне отката ещё пишет `assistant`: значение принимается
      await sql`UPDATE organization_members SET role = 'assistant' WHERE user_id = ${helperId}`
      expect((await roleOf(sql, helperId))!.role).toBe('assistant')

      // откат возвращает тренеров в помощников; повторное применение снова переводит их
      await sql`UPDATE organization_members SET role = 'coach' WHERE user_id = ${helperId}`
      expect(await rollbackMembershipRolesCoach(url)).toBe(TAG)
      const [back] = await sql<{ role: string }[]>`
        SELECT role::text AS role FROM organization_members WHERE user_id = ${helperId}`
      expect(back!.role).toBe('assistant')
      await runMigrations(url)
      expect(await roleOf(sql, helperId)).toEqual({ role: 'coach', flag: false })
      const [again] = await sql<{ r: string }[]>`SELECT role_to_assign::text AS r FROM invite_links`
      expect(again!.r).toBe('coach')
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a coach accepts payments or an event has coaches', async () => {
    const { url, sql } = await scratchDb()
    try {
      await migrateTo46(url)
      const { orgId, ownerId, helperId } = await orgWithAssistant(sql, 'mrc-guard')
      await runMigrations(url)
      await sql`UPDATE organization_members SET can_accept_payment = true WHERE user_id = ${helperId}`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0047 refused/)
      await sql`UPDATE organization_members SET can_accept_payment = false`
      await sql`INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at,
          capacity, coach_user_ids)
        VALUES (${orgId}, ${ownerId}, 'T', now() + interval '1 day', now() + interval '25 hours', 10,
          ARRAY[${helperId}]::integer[])`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0047 refused/)
      expect(await columns(sql)).toBe(2)
      await sql`UPDATE events SET coach_user_ids = '{}'`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(1)
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
      const [coaches] = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM organization_members WHERE role = 'coach'`
      expect(coaches!.n).toBeGreaterThan(0)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organization_members`).toHaveLength(members!.n)
      await runMigrations(url)
      const [after] = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM organization_members WHERE role = 'coach'`
      expect(after!.n).toBe(coaches!.n)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
