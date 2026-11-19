import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations } from './migrate'
import { rollbackEventBalancePackages } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'

const TAG = '0041_event_balance_packages'
const PREVIOUS = '0040_venue_hourly_price'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''
const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

/** Цены до 22.2.1 — константа `EVENT_BALANCE_PACKAGES` (владелец, 2026-10-14). */
const SEED = [
  { code: 'events_10', units: 10, amount: 5000, badge: null, sort_order: 10 },
  { code: 'events_30', units: 30, amount: 12000, badge: 'popular', sort_order: 20 },
  { code: 'events_100', units: 100, amount: 35000, badge: null, sort_order: 30 },
]

type Who = { org: number; user: number }

/**
 * Task 22.2.1 (ADR-22-2-1): каталог пакетов баланса событий. Миграция аддитивна: таблица, сид,
 * nullable `package_id` заявок и разовый бэкфилл `approved`/`pending` заявок по точному совпадению
 * со снимком. Откат отказывает, пока каталог не равен сиду или есть связи, созданные позже.
 */
describe('migration 0041 event balance packages (integration)', { timeout: 90_000 }, () => {
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

  async function org(sql: postgres.Sql, slug: string): Promise<Who> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    return { org: o!.id, user: user!.id }
  }

  async function request(
    sql: postgres.Sql,
    who: Who,
    snapshot: { units: number; amount: number; currency?: string },
    status: 'pending' | 'approved' | 'rejected' | 'cancelled',
  ): Promise<number> {
    const decided = status !== 'pending'
    const [r] = await sql<{ id: number }[]>`
      INSERT INTO event_balance_purchase_requests
        (organization_id, requested_by_user_id, units, amount, currency, status, decided_by_user_id, decided_at)
      VALUES (${who.org}, ${who.user}, ${snapshot.units}, ${snapshot.amount},
        ${snapshot.currency ?? 'BYN'}, ${status},
        ${decided ? who.user : null}, ${decided ? new Date() : null})
      RETURNING id`
    return r!.id
  }

  async function tableExists(sql: postgres.Sql): Promise<boolean> {
    const rows = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'event_balance_packages'`
    return rows.length === 1
  }

  async function columnExists(sql: postgres.Sql): Promise<boolean> {
    const rows = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'event_balance_purchase_requests'
        AND column_name = 'package_id'`
    return rows.length === 1
  }

  async function statement(marker: string): Promise<string> {
    const file = await readFile(path.join(MIGRATIONS, `${TAG}.sql`), 'utf8')
    return file.split('--> statement-breakpoint').find((s) => s.includes(marker))!
  }

  beforeAll(() => {
    expect(BASE_URL).not.toBe('')
  })

  afterAll(async () => {
    for (const name of created) await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await admin.end()
  })

  it('applies, rolls back and re-applies on an empty database with the old prices as seed', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const rows = await sql`
        SELECT code, units, amount, currency, badge, visible, archived_at, sort_order, version
        FROM event_balance_packages ORDER BY sort_order`
      expect(rows).toEqual(
        SEED.map((s) => ({
          ...s,
          currency: 'BYN',
          visible: true,
          archived_at: null,
          version: 1,
        })),
      )
      expect(await rollbackEventBalancePackages(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      expect(await columnExists(sql)).toBe(false)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
      expect(await columnExists(sql)).toBe(true)
      expect(await sql`SELECT 1 FROM event_balance_packages`).toHaveLength(3)
    } finally {
      await sql.end()
    }
  })

  it('seeds idempotently: replaying the seed insert changes nothing', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await sql`UPDATE event_balance_packages SET amount = 1 WHERE code = 'events_10'`
      await sql.unsafe(await statement('INSERT INTO'))
      const rows = await sql`SELECT code, amount FROM event_balance_packages ORDER BY sort_order`
      expect(rows).toHaveLength(3)
      expect(rows[0]).toEqual({ code: 'events_10', amount: 1 }) // ON CONFLICT DO NOTHING
    } finally {
      await sql.end()
    }
  })

  it('backfills package_id for approved and pending requests by exact snapshot match only', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await rollbackEventBalancePackages(url) // БД на 0040, как production
      const who = await org(sql, 'bf')
      const approved = await request(sql, who, { units: 10, amount: 5000 }, 'approved')
      const pending = await request(sql, who, { units: 30, amount: 12000 }, 'pending')
      const rejected = await request(sql, who, { units: 100, amount: 35000 }, 'rejected')
      const cancelled = await request(sql, who, { units: 100, amount: 35000 }, 'cancelled')
      const otherPrice = await request(sql, who, { units: 10, amount: 4500 }, 'approved')
      const otherUnits = await request(sql, who, { units: 50, amount: 20000 }, 'pending')
      const otherCurrency = await request(
        sql,
        who,
        { units: 10, amount: 5000, currency: 'USD' },
        'approved',
      )

      await runMigrations(url)
      const links = await sql<{ id: number; code: string | null }[]>`
        SELECT r.id, p.code FROM event_balance_purchase_requests r
        LEFT JOIN event_balance_packages p ON p.id = r.package_id ORDER BY r.id`
      const byId = new Map(links.map((l) => [l.id, l.code]))
      expect(byId.get(approved)).toBe('events_10')
      expect(byId.get(pending)).toBe('events_30')
      for (const id of [rejected, cancelled, otherPrice, otherUnits, otherCurrency]) {
        expect(byId.get(id)).toBeNull()
      }

      // повторный прогон бэкфилла ничего не меняет
      const result = await sql.unsafe(await statement('UPDATE "event_balance_purchase_requests"'))
      expect(result.count).toBe(0)
    } finally {
      await sql.end()
    }
  })

  it('stays compatible with the previous app: a request without package_id inserts and approves', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const who = await org(sql, 'old-app')
      // прежний код не перечисляет package_id
      const [row] = await sql<{ id: number; package_id: number | null }[]>`
        INSERT INTO event_balance_purchase_requests
          (organization_id, requested_by_user_id, units, amount, currency)
        VALUES (${who.org}, ${who.user}, 30, 12000, 'BYN') RETURNING id, package_id`
      expect(row!.package_id).toBeNull()
      await sql`UPDATE event_balance_purchase_requests
        SET status = 'approved', decided_by_user_id = ${who.user}, decided_at = now()
        WHERE id = ${row!.id}`
    } finally {
      await sql.end()
    }
  })

  it('enforces checks, the active (units, currency) index and the restrict foreign key', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const insert = (code: string, units: number, amount = 100, badge: string | null = null) =>
        sql`INSERT INTO event_balance_packages (code, units, amount, badge)
            VALUES (${code}, ${units}, ${amount}, ${badge})`
      await insert('events_5', 5)
      await expect(insert('events_5', 6)).rejects.toThrow(/event_balance_packages_code_unique/)
      for (const code of ['Events_6', 'events-6', '', 'a'.repeat(65)]) {
        await expect(insert(code, 6)).rejects.toThrow(/event_balance_packages_code_format/)
      }
      await expect(insert('events_0', 0)).rejects.toThrow(/event_balance_packages_units_positive/)
      await expect(insert('events_6', 6, -1)).rejects.toThrow(
        /event_balance_packages_amount_non_negative/,
      )
      await expect(insert('events_6', 6, 100, 'hot')).rejects.toThrow(
        /event_balance_packages_badge/,
      )
      await insert('events_7', 7, 0, 'best_price')
      await insert('events_8', 8, 100, 'discount')
      await expect(
        sql`INSERT INTO event_balance_packages (code, units, amount, visible, archived_at)
            VALUES ('events_9', 9, 1, true, now())`,
      ).rejects.toThrow(/event_balance_packages_archived_hidden/)

      // среди неархивных нет двух с одинаковым (units, currency), в т.ч. черновиков
      await expect(insert('events_5_2', 5)).rejects.toThrow(
        /event_balance_packages_units_currency_active/,
      )
      await sql`UPDATE event_balance_packages SET archived_at = now() WHERE code = 'events_5'`
      await insert('events_5_2', 5)
      await sql`INSERT INTO event_balance_packages (code, units, amount, archived_at)
                VALUES ('events_5_3', 5, 1, now())` // несколько архивных — можно

      const who = await org(sql, 'fk')
      const [pkg] = await sql<{ id: number }[]>`
        SELECT id FROM event_balance_packages WHERE code = 'events_10'`
      await sql`INSERT INTO event_balance_purchase_requests
        (organization_id, requested_by_user_id, units, amount, currency, package_id)
        VALUES (${who.org}, ${who.user}, 10, 5000, 'BYN', ${pkg!.id})`
      await expect(sql`DELETE FROM event_balance_packages WHERE id = ${pkg!.id}`).rejects.toThrow(
        /event_balance_requests_package_id_fk/,
      )
    } finally {
      await sql.end()
    }
  })

  describe('rollback guard', () => {
    async function fresh() {
      const db = await scratchDb()
      await runMigrations(db.url)
      return db
    }

    it('passes on the untouched seed with backfilled links and restores the previous schema', async () => {
      const { url, sql } = await scratchDb()
      try {
        await runMigrations(url)
        await rollbackEventBalancePackages(url)
        const who = await org(sql, 'g-ok')
        await request(sql, who, { units: 10, amount: 5000 }, 'approved')
        await request(sql, who, { units: 30, amount: 12000 }, 'pending')
        await runMigrations(url) // бэкфилл связал обе заявки
        expect(
          await sql`SELECT 1 FROM event_balance_purchase_requests WHERE package_id IS NOT NULL`,
        ).toHaveLength(2)
        expect(await rollbackEventBalancePackages(url)).toBe(TAG)
        expect(await sql`SELECT 1 FROM event_balance_purchase_requests`).toHaveLength(2)
        expect(await columnExists(sql)).toBe(false)
        expect(await rollbackLastMigration(url)).toBe(PREVIOUS)
      } finally {
        await sql.end()
      }
    })

    const refusals: [string, (sql: postgres.Sql) => Promise<unknown>][] = [
      [
        'an extra package row',
        (sql) =>
          sql`INSERT INTO event_balance_packages (code, units, amount) VALUES ('events_5', 5, 1)`,
      ],
      [
        'a changed price',
        (sql) => sql`UPDATE event_balance_packages SET amount = 5100 WHERE code = 'events_10'`,
      ],
      [
        'a changed currency',
        (sql) => sql`UPDATE event_balance_packages SET currency = 'USD' WHERE code = 'events_10'`,
      ],
      [
        'a badge set on a package that had none (NULL to value)',
        (sql) =>
          sql`UPDATE event_balance_packages SET badge = 'discount' WHERE code = 'events_100'`,
      ],
      [
        'a badge removed from a package that had one (value to NULL)',
        (sql) => sql`UPDATE event_balance_packages SET badge = NULL WHERE code = 'events_30'`,
      ],
      [
        'a changed visibility',
        (sql) => sql`UPDATE event_balance_packages SET visible = false WHERE code = 'events_10'`,
      ],
      [
        'an archived package',
        (sql) =>
          sql`UPDATE event_balance_packages SET visible = false, archived_at = now() WHERE code = 'events_100'`,
      ],
      [
        'a changed sort order',
        (sql) => sql`UPDATE event_balance_packages SET sort_order = 11 WHERE code = 'events_10'`,
      ],
      [
        'a bumped version',
        (sql) => sql`UPDATE event_balance_packages SET version = 2 WHERE code = 'events_10'`,
      ],
      [
        'a missing package row',
        (sql) => sql`DELETE FROM event_balance_packages WHERE code = 'events_100'`,
      ],
      [
        'a request linked to a package after the migration',
        async (sql) => {
          const who = await org(sql, 'g-late')
          await sql`INSERT INTO event_balance_purchase_requests
            (organization_id, requested_by_user_id, units, amount, currency, package_id)
            SELECT ${who.org}, ${who.user}, units, amount, currency, id
            FROM event_balance_packages WHERE code = 'events_10'`
        },
      ],
      [
        'a linked request whose snapshot differs from the package',
        async (sql) => {
          const who = await org(sql, 'g-snap')
          // создана «до миграции», но снимок не совпадает с пакетом
          await sql`INSERT INTO event_balance_purchase_requests
            (organization_id, requested_by_user_id, units, amount, currency, package_id, created_at)
            SELECT ${who.org}, ${who.user}, 10, 4000, 'BYN', id, now() - interval '1 day'
            FROM event_balance_packages WHERE code = 'events_10'`
        },
      ],
    ]

    it.each(refusals)('refuses with %s and leaves the schema intact', async (_name, mutate) => {
      const { url, sql } = await fresh()
      try {
        await mutate(sql)
        await expect(rollbackEventBalancePackages(url)).rejects.toThrow(/rollback 0041 refused/)
        expect(await tableExists(sql)).toBe(true)
        expect(await columnExists(sql)).toBe(true)
      } finally {
        await sql.end()
      }
    })

    it('passes again when the catalog is restored to the seed', async () => {
      const { url, sql } = await fresh()
      try {
        await sql`UPDATE event_balance_packages SET badge = NULL WHERE code = 'events_30'`
        await expect(rollbackEventBalancePackages(url)).rejects.toThrow(/refused/)
        await sql`UPDATE event_balance_packages SET badge = 'popular' WHERE code = 'events_30'`
        expect(await rollbackEventBalancePackages(url)).toBe(TAG)
      } finally {
        await sql.end()
      }
    })
  })
})
