import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackNotificationSettings } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0036_organization_payment_methods'
const PREVIOUS = '0035_schedule_slots'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.11: способы оплаты группы. Миграция аддитивна (таблица `organization_payment_methods`):
 * применяется и откатывается на пустой базе и после demo-сида; откат отказывает, пока есть
 * выключенные способы или реквизиты, и удаляет строки без отклонений от умолчания.
 */
describe('migration 0036 organization payment methods (integration)', { timeout: 60_000 }, () => {
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

  async function tableExists(sql: postgres.Sql) {
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'organization_payment_methods'`
    return row!.n === 1
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
      expect(await tableExists(sql)).toBe(true)
      await rollbackNotificationSettings(url) // 21.2.14: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('enforces the constraints: methods, last four digits, requisites only for transfer, one row per method', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const o = await org(sql, 'pm-constraints')
      await sql`INSERT INTO organization_payment_methods (organization_id, method, enabled)
        VALUES (${o}, 'cash', false)`
      await sql`INSERT INTO organization_payment_methods
        (organization_id, method, bank, card_last4, recipient)
        VALUES (${o}, 'transfer', 'Belarusbank', '3214', 'Иван П.')`
      await expect(
        sql`INSERT INTO organization_payment_methods (organization_id, method)
          VALUES (${o}, 'online')`,
      ).rejects.toThrow(/org_payment_methods_method_chk/)
      await expect(
        sql`UPDATE organization_payment_methods SET card_last4 = '4111111111111111'
          WHERE method = 'transfer'`,
      ).rejects.toThrow(/value too long|card_last4/)
      await expect(
        sql`UPDATE organization_payment_methods SET card_last4 = '12ab' WHERE method = 'transfer'`,
      ).rejects.toThrow(/org_payment_methods_card_last4_chk/)
      await expect(
        sql`UPDATE organization_payment_methods SET bank = 'X' WHERE method = 'cash'`,
      ).rejects.toThrow(/org_payment_methods_details_chk/)
      await expect(
        sql`INSERT INTO organization_payment_methods (organization_id, method)
          VALUES (${o}, 'cash')`,
      ).rejects.toThrow(/org_payment_methods_org_method_uniq/)
    } finally {
      await sql.end()
    }
  })

  it('cascades with the group and keeps the previous app compatible', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const o = await org(sql, 'pm-cascade')
      await sql`INSERT INTO organization_payment_methods (organization_id, method)
        VALUES (${o}, 'transfer')`
      // прежнее приложение таблицу не читает и не пишет: его запросы к группам работают
      await sql`UPDATE organizations SET name = 'renamed' WHERE id = ${o}`
      await sql`DELETE FROM organizations WHERE id = ${o}`
      expect(await sql`SELECT 1 FROM organization_payment_methods`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a method is off or has requisites, and passes once cleared', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const o = await org(sql, 'pm-guard')
      await sql`INSERT INTO organization_payment_methods (organization_id, method, enabled)
        VALUES (${o}, 'cash', false)`
      await rollbackNotificationSettings(url) // 21.2.14: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0036 refused/)
      expect(await tableExists(sql)).toBe(true)
      await sql`UPDATE organization_payment_methods SET enabled = true`

      await sql`INSERT INTO organization_payment_methods (organization_id, method, recipient)
        VALUES (${o}, 'transfer', 'Иван П.')`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0036 refused/)
      expect(await sql`SELECT 1 FROM organization_payment_methods`).toHaveLength(2)
      await sql`UPDATE organization_payment_methods SET recipient = NULL`

      // строки без отклонений от умолчания эквивалентны отсутствию строки
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
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
      // сид не создаёт способов оплаты: у групп действуют умолчания (оба включены)
      expect(await sql`SELECT 1 FROM organization_payment_methods`).toHaveLength(0)
      await rollbackNotificationSettings(url) // 21.2.14: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(orgs!.n)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
