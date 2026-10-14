import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0024_event_balance'
const TAG23 = '0023_player_levels'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''
const MIGRATION_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  `../migrations/${TAG}.sql`,
)

const NEW_TABLES = [
  'organization_event_balances',
  'event_balance_entries',
  'event_balance_purchase_requests',
]
const NEW_TYPES = ['event_balance_reason', 'event_balance_actor', 'purchase_request_status']

/**
 * Task 20.2.1: миграция баланса событий применяется и откатывается на пустой базе, на базе после
 * demo-сида и на базе, уже стоящей на 0023 с данными (ADR v3, «Правила совместимости», п. 5–7).
 * Каждый тест работает во временной БД, чтобы не мешать общей тестовой.
 */
describe('migration 0024 event balance (integration)', { timeout: 60_000 }, () => {
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

  async function exists(sql: postgres.Sql, kind: 'table' | 'type', name: string) {
    const rows =
      kind === 'table'
        ? await sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${name}`
        : await sql`SELECT 1 FROM pg_type WHERE typname = ${name}`
    return rows.length > 0
  }

  /** Проекция совпадает с суммой журнала у каждой организации (ADR: «баланс как сумма»). */
  async function drift(sql: postgres.Sql) {
    return sql`
      SELECT o.id FROM organizations o
      LEFT JOIN organization_event_balances b ON b.organization_id = o.id
      LEFT JOIN (SELECT organization_id, sum(delta)::int AS s FROM event_balance_entries GROUP BY 1) e
        ON e.organization_id = o.id
      WHERE coalesce(b.balance, 0) <> coalesce(e.s, 0)`
  }

  async function seedR07(sql: postgres.Sql) {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES ('old@example.com') RETURNING id`
    const orgs = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id, status) VALUES
        ('pilot-a', 'Pilot A', ${user!.id}, 'active'),
        ('pilot-b', 'Pilot B', ${user!.id}, 'archived')
      RETURNING id`
    const [event] = await sql<{ id: number }[]>`
      INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
      VALUES (${orgs[0]!.id}, ${user!.id}, 'Old', now() + interval '1 day', now() + interval '2 day', 10, 'published')
      RETURNING id`
    await sql`
      INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
      VALUES (${orgs[0]!.id}, ${user!.id}, 'Old cancelled', now() + interval '1 day', now() + interval '2 day', 10, 'cancelled')`
    await sql`
      INSERT INTO bookings (event_id, user_id, organization_id, status, method)
      VALUES (${event!.id}, ${user!.id}, ${orgs[0]!.id}, 'confirmed', 'cash')`
    return { userId: user!.id, orgIds: orgs.map((o) => o.id), eventId: event!.id }
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
      for (const t of NEW_TABLES) expect(await exists(sql, 'table', t), t).toBe(true)
      for (const t of NEW_TYPES) expect(await exists(sql, 'type', t), t).toBe(true)
      expect(await sql`SELECT 1 FROM event_balance_entries`).toHaveLength(0)

      expect(await rollbackLastMigration(url)).toBe(TAG)
      for (const t of NEW_TABLES) expect(await exists(sql, 'table', t), t).toBe(false)
      for (const t of NEW_TYPES) expect(await exists(sql, 'type', t), t).toBe(false)

      await runMigrations(url)
      for (const t of NEW_TABLES) expect(await exists(sql, 'table', t), t).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('gives every existing organization one pilot_grant of 48 and keeps R0.7 data (D-12)', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0023
      const r07 = await seedR07(sql)

      await runMigrations(url)

      const balances = await sql`
        SELECT organization_id, balance FROM organization_event_balances ORDER BY organization_id`
      expect(balances.map((b) => [b.organization_id, b.balance])).toEqual(
        r07.orgIds.map((id) => [id, 48]),
      )
      const entries = await sql`SELECT * FROM event_balance_entries ORDER BY organization_id`
      expect(entries).toHaveLength(2)
      for (const e of entries) {
        expect(e).toMatchObject({
          delta: 48,
          reason: 'pilot_grant',
          balance_after: 48,
          actor_kind: 'system',
          created_by_user_id: null,
          source: 'pilot_grant',
          event_id: null,
        })
        expect(e.comment).toMatch(/D-12/)
      }
      // прошлые события не списываются и не получают возврата; demo-квоты у пилота нет
      expect(
        await sql`SELECT 1 FROM event_balance_entries WHERE reason <> 'pilot_grant'`,
      ).toHaveLength(0)
      expect(await drift(sql)).toHaveLength(0)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(2)
      expect(await sql`SELECT 1 FROM bookings`).toHaveLength(1)

      // backfill идемпотентен: повторный запуск того же запроса ничего не добавляет
      const tail = (await readFile(MIGRATION_FILE, 'utf8')).split('-- backfill (D-12)')[1]
      expect(tail).toBeDefined()
      const backfill = tail!.slice(tail!.indexOf('\n'))
      for (const statement of backfill.split('--> statement-breakpoint')) {
        if (statement.trim()) await sql.unsafe(statement)
      }
      expect(await sql`SELECT 1 FROM event_balance_entries`).toHaveLength(2)
      expect(await drift(sql)).toHaveLength(0)

      // прежнее приложение не знает баланса: его INSERT-ы продолжают работать
      await sql`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('new-old-app', 'N', ${r07.userId})`
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
        VALUES (${r07.orgIds[0]!}, ${r07.userId}, 'Old 2', now() + interval '1 day', now() + interval '2 day', 10, 'published')`

      // откат возвращает 0023 и не трогает данные R0.7
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(3)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(3)
      expect(await sql`SELECT 1 FROM bookings`).toHaveLength(1)
      expect(await rollbackLastMigration(url)).toBe(TAG23)
    } finally {
      await sql.end()
    }
  })

  it('enforces the journal and projection invariants in the database', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('c@example.com') RETURNING id`
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('c-org', 'C', ${user!.id}) RETURNING id`
      const [ev] = await sql<{ id: number }[]>`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity)
        VALUES (${org!.id}, ${user!.id}, 'E', now() + interval '1 day', now() + interval '2 day', 10) RETURNING id`
      const o = org!.id
      const u = user!.id
      const e = ev!.id

      await expect(
        sql`INSERT INTO organization_event_balances (organization_id, balance) VALUES (${o}, -1)`,
      ).rejects.toThrow(/organization_event_balances_non_negative/)
      await sql`INSERT INTO organization_event_balances (organization_id, balance) VALUES (${o}, 5)`

      const entry = (cols: string) => sql.unsafe(`INSERT INTO event_balance_entries ${cols}`)
      // ok: пользовательское списание и системная квота
      await entry(
        `(organization_id, delta, reason, balance_after, event_id, actor_kind, created_by_user_id)
         VALUES (${o}, -1, 'spend', 4, ${e}, 'user', ${u})`,
      )
      await entry(
        `(organization_id, delta, reason, balance_after, actor_kind, source, comment)
         VALUES (${o}, 5, 'demo_grant', 9, 'system', 'org-create', 'demo')`,
      )
      const rejects = async (cols: string, constraint: RegExp) =>
        expect(entry(cols)).rejects.toThrow(constraint)
      await rejects(
        `(organization_id, delta, reason, balance_after, event_id, actor_kind, created_by_user_id)
         VALUES (${o}, -1, 'spend', 3, ${e}, 'user', ${u})`,
        /event_balance_spend_event_uniq/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, source, comment)
         VALUES (${o}, 5, 'demo_grant', 9, 'system', 'org-create', 'demo')`,
        /event_balance_demo_grant_org_uniq/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, created_by_user_id, comment)
         VALUES (${o}, 0, 'correction', 9, 'user', ${u}, 'fix')`,
        /event_balance_entries_delta_non_zero/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, created_by_user_id, comment)
         VALUES (${o}, -1, 'correction', -1, 'user', ${u}, 'fix')`,
        /event_balance_entries_balance_after_non_negative/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, event_id, actor_kind, created_by_user_id)
         VALUES (${o}, 1, 'spend', 3, ${e}, 'user', ${u})`,
        /event_balance_entries_delta_sign/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind)
         VALUES (${o}, 1, 'refund', 3, 'user')`,
        /event_balance_entries_actor_user/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, comment)
         VALUES (${o}, 1, 'refund', 3, 'system', 'x')`,
        /event_balance_entries_system_source/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, created_by_user_id)
         VALUES (${o}, 3, 'grant', 3, 'user', ${u})`,
        /event_balance_entries_comment_required/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, source)
         VALUES (${o}, 3, 'pilot_grant', 3, 'system', 'pilot_grant')`,
        /event_balance_entries_comment_required/,
      )
      await rejects(
        `(organization_id, delta, reason, balance_after, actor_kind, created_by_user_id)
         VALUES (${o}, 3, 'purchase', 3, 'user', ${u})`,
        /event_balance_entries_purchase_request/,
      )

      await expect(
        sql`INSERT INTO event_balance_purchase_requests
              (organization_id, requested_by_user_id, units, amount, currency)
            VALUES (${o}, ${u}, 0, 100, 'BYN')`,
      ).rejects.toThrow(/event_balance_purchase_requests_units_positive/)
      await expect(
        sql`INSERT INTO event_balance_purchase_requests
              (organization_id, requested_by_user_id, units, amount, currency, status)
            VALUES (${o}, ${u}, 10, 5000, 'BYN', 'approved')`,
      ).rejects.toThrow(/event_balance_purchase_requests_decision/)

      // удаление события сохраняет историю: event_id → NULL
      await sql`DELETE FROM events WHERE id = ${e}`
      expect(
        (await sql`SELECT event_id FROM event_balance_entries WHERE reason = 'spend'`)[0],
      ).toMatchObject({ event_id: null })
      // удаление организации удаляет её баланс целиком
      await sql`DELETE FROM organizations WHERE id = ${o}`
      expect(await sql`SELECT 1 FROM event_balance_entries`).toHaveLength(0)
      expect(await sql`SELECT 1 FROM organization_event_balances`).toHaveLength(0)
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

      const count = async (table: string) =>
        (await sql.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${table}`))[0]!.n
      const before = {
        organizations: await count('organizations'),
        members: await count('organization_members'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
        ledger: await count('ledger_entries'),
      }
      const balance = {
        entries: await count('event_balance_entries'),
        requests: await count('event_balance_purchase_requests'),
      }

      // сид даёт каждой группе баланс, списания за неснятые с публикации события и заявку
      expect(await count('organization_event_balances')).toBe(before.organizations)
      expect(await drift(sql)).toHaveLength(0)
      const unspent = await sql`
        SELECT e.id FROM events e WHERE e.status <> 'draft' AND NOT EXISTS (
          SELECT 1 FROM event_balance_entries s WHERE s.event_id = e.id AND s.reason = 'spend')`
      expect(unspent).toHaveLength(0)
      expect(balance.requests).toBeGreaterThan(0)
      expect(await sql`SELECT 1 FROM organization_event_balances WHERE balance <= 0`).toHaveLength(
        0,
      )

      // повторный сид идемпотентен
      await seedDemo(database)
      expect(await count('event_balance_entries')).toBe(balance.entries)
      expect(await count('event_balance_purchase_requests')).toBe(balance.requests)

      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect({
        organizations: await count('organizations'),
        members: await count('organization_members'),
        events: await count('events'),
        bookings: await count('bookings'),
        payments: await count('payments'),
        ledger: await count('ledger_entries'),
      }).toEqual(before)

      // повторное применение: группы, существующие на момент миграции, — пилотные (D-12)
      await runMigrations(url)
      expect(await count('event_balance_entries')).toBe(before.organizations)
      expect(await sql`SELECT 1 FROM organization_event_balances WHERE balance = 48`).toHaveLength(
        before.organizations,
      )
      expect(await drift(sql)).toHaveLength(0)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
