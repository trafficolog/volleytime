import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0039_group_ownership_soft_delete'
const PREVIOUS = '0038_organization_logo_short_link'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.17: передача владения и мягкое удаление группы. Миграция аддитивна: таблица
 * `organization_ownership_transfers`, nullable-колонки `organizations.deleted_at`/`restore_until`
 * и частичный уникальный индекс «один owner на группу». Применяется и откатывается на пустой базе
 * и после demo-сида; откат отказывает, пока есть удалённая группа или ожидающая передача.
 */
describe(
  'migration 0039 group ownership transfer and soft delete (integration)',
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

    /** 1 таблица + 2 колонки + 1 индекс = 4 объекта схемы. */
    async function objects(sql: postgres.Sql) {
      const [row] = await sql<{ n: number }[]>`
      SELECT (
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'organization_ownership_transfers')
        + (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'organizations'
            AND column_name IN ('deleted_at', 'restore_until'))
        + (SELECT count(*) FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'org_members_one_owner_uniq')
      )::int AS n`
      return row!.n
    }

    async function user(sql: postgres.Sql, email: string): Promise<number> {
      const [u] = await sql<
        { id: number }[]
      >`INSERT INTO users (email) VALUES (${email}) RETURNING id`
      return u!.id
    }

    async function org(sql: postgres.Sql, slug: string): Promise<{ id: number; owner: number }> {
      const owner = await user(sql, `${slug}@example.com`)
      const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${owner})
      RETURNING id`
      await sql`INSERT INTO organization_members (organization_id, user_id, role, status)
      VALUES (${o!.id}, ${owner}, 'owner', 'active')`
      return { id: o!.id, owner }
    }

    const hash = (c: string) => c.repeat(64)

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
        expect(await objects(sql)).toBe(4)
        expect(await rollbackLastMigration(url)).toBe(TAG)
        expect(await objects(sql)).toBe(0)
        await runMigrations(url)
        expect(await objects(sql)).toBe(4)
      } finally {
        await sql.end()
      }
    })

    it('keeps existing groups valid: not deleted, and the previous app is unaffected', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const o = await org(sql, 'own-compat')
        const [row] = await sql<{ deleted_at: Date | null; restore_until: Date | null }[]>`
        SELECT deleted_at, restore_until FROM organizations WHERE id = ${o.id}`
        expect(row).toEqual({ deleted_at: null, restore_until: null })
        // прежнее приложение колонок и таблицы не знает: его запросы к группам работают
        await sql`UPDATE organizations SET name = 'renamed', status = 'archived' WHERE id = ${o.id}`
        // и роли участников меняет как раньше (не owner)
        const member = await user(sql, 'own-compat-p@example.com')
        await sql`INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (${o.id}, ${member}, 'player', 'active')`
        await sql`UPDATE organization_members SET role = 'organizer' WHERE user_id = ${member}`
      } finally {
        await sql.end()
      }
    })

    it('allows exactly one owner per group, any number of other roles', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const a = await org(sql, 'one-owner-a')
        const b = await org(sql, 'one-owner-b')
        const second = await user(sql, 'second-owner@example.com')
        await expect(
          sql`INSERT INTO organization_members (organization_id, user_id, role, status)
          VALUES (${a.id}, ${second}, 'owner', 'active')`,
        ).rejects.toThrow(/org_members_one_owner_uniq/)
        await sql`INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (${a.id}, ${second}, 'organizer', 'active')`
        // повышение второго участника до owner без понижения первого отклоняется
        await expect(
          sql`UPDATE organization_members SET role = 'owner' WHERE user_id = ${second}`,
        ).rejects.toThrow(/org_members_one_owner_uniq/)
        // порядок передачи: сначала понизить прежнего owner, затем повысить нового
        await sql.begin(async (tx) => {
          await tx`UPDATE organization_members SET role = 'organizer'
          WHERE organization_id = ${a.id} AND user_id = ${a.owner}`
          await tx`UPDATE organization_members SET role = 'owner'
          WHERE organization_id = ${a.id} AND user_id = ${second}`
        })
        // owner другой группы не мешает: уникальность внутри группы
        await sql`INSERT INTO organization_members (organization_id, user_id, role, status)
        VALUES (${b.id}, ${second}, 'player', 'active')`
        const owners = await sql`SELECT 1 FROM organization_members WHERE role = 'owner'`
        expect(owners).toHaveLength(2)
      } finally {
        await sql.end()
      }
    })

    it('enforces the soft-delete pair and the transfer constraints', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const o = await org(sql, 'own-chk')
        // deleted_at и restore_until задаются вместе, окно — после удаления
        await expect(
          sql`UPDATE organizations SET deleted_at = now() WHERE id = ${o.id}`,
        ).rejects.toThrow(/organizations_deleted_restore_chk/)
        await expect(
          sql`UPDATE organizations SET deleted_at = now(), restore_until = now() - interval '1 day'
          WHERE id = ${o.id}`,
        ).rejects.toThrow(/organizations_deleted_restore_chk/)
        await sql`UPDATE organizations SET deleted_at = now(), restore_until = now() + interval '30 days'
        WHERE id = ${o.id}`
        await sql`UPDATE organizations SET deleted_at = NULL, restore_until = NULL WHERE id = ${o.id}`

        const to = await user(sql, 'own-chk-to@example.com')
        const insert = (status: string, tokenHash: string, extra = sql``) =>
          sql`INSERT INTO organization_ownership_transfers
          (organization_id, from_user_id, to_user_id, token_hash, status, expires_at, resolved_at)
          VALUES (${o.id}, ${o.owner}, ${to}, ${tokenHash}, ${status}, now() + interval '3 days',
            ${status === 'pending' ? null : new Date()}) ${extra}`
        await insert('pending', hash('a'))
        // не больше одной ожидающей передачи на группу
        await expect(insert('pending', hash('b'))).rejects.toThrow(
          /org_ownership_transfers_pending_uniq/,
        )
        // закрытые передачи копятся как история
        await insert('cancelled', hash('c'))
        await insert('expired', hash('d'))
        // токен — только hex SHA-256 и уникален
        await expect(insert('accepted', 'plain-token')).rejects.toThrow(
          /org_ownership_transfers_token_chk/,
        )
        await expect(insert('accepted', hash('c'))).rejects.toThrow(
          /org_ownership_transfers_token_uniq/,
        )
        await expect(insert('unknown', hash('e'))).rejects.toThrow(
          /org_ownership_transfers_status_chk/,
        )
        // передача самому себе невозможна
        await expect(
          sql`INSERT INTO organization_ownership_transfers
          (organization_id, from_user_id, to_user_id, token_hash, expires_at)
          VALUES (${o.id}, ${o.owner}, ${o.owner}, ${hash('f')}, now() + interval '1 day')`,
        ).rejects.toThrow(/org_ownership_transfers_self_chk/)
        // ожидающая передача не закрыта; закрытая — с датой
        await expect(
          sql`UPDATE organization_ownership_transfers SET status = 'accepted'
          WHERE token_hash = ${hash('a')}`,
        ).rejects.toThrow(/org_ownership_transfers_resolved_chk/)
        await sql`DELETE FROM organizations WHERE id = ${o.id}`
        expect(await sql`SELECT 1 FROM organization_ownership_transfers`).toHaveLength(0)
      } finally {
        await sql.end()
      }
    })

    it('refuses the rollback while a group is deleted or a transfer is pending, passes once resolved', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        const o = await org(sql, 'own-guard')
        await sql`UPDATE organizations SET deleted_at = now(), restore_until = now() + interval '30 days'
        WHERE id = ${o.id}`
        await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0039 refused/)
        expect(await objects(sql)).toBe(4)
        await sql`UPDATE organizations SET deleted_at = NULL, restore_until = NULL`

        const to = await user(sql, 'own-guard-to@example.com')
        await sql`INSERT INTO organization_ownership_transfers
        (organization_id, from_user_id, to_user_id, token_hash, expires_at)
        VALUES (${o.id}, ${o.owner}, ${to}, ${hash('1')}, now() + interval '3 days')`
        await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0039 refused/)
        // закрытая передача — история, откат не блокирует
        await sql`UPDATE organization_ownership_transfers SET status = 'cancelled', resolved_at = now()`

        expect(await rollbackLastMigration(url)).toBe(TAG)
        expect(await objects(sql)).toBe(0)
        expect(await sql`SELECT 1 FROM organizations WHERE id = ${o.id}`).toHaveLength(1)
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
        // сид создаёт ровно одного owner на группу и ни одной удалённой группы
        const multi = await sql`SELECT organization_id FROM organization_members
        WHERE role = 'owner' GROUP BY organization_id HAVING count(*) > 1`
        expect(multi).toHaveLength(0)
        expect(await rollbackLastMigration(url)).toBe(TAG)
        expect(await sql`SELECT 1 FROM organizations`).toHaveLength(orgs!.n)
        await runMigrations(url)
        expect(await objects(sql)).toBe(4)
      } finally {
        await client.end()
        await sql.end()
      }
    })
  },
)
