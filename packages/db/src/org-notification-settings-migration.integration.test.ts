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

const TAG = '0037_org_notification_settings'
const TAG35 = '0035_schedule_slots'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.14: переключатели уведомлений группы. Миграция аддитивна (новая таблица, строки нет =
 * тип включён): применяется и откатывается на пустой базе, после demo-сида и на базе на 0035 с
 * группами. Откат отказывает, пока выключено хотя бы одно напоминание; CHECK пускает в таблицу
 * только переключаемые типы; строки уходят вместе с группой.
 */
describe('migration 0037 org notification settings (integration)', { timeout: 60_000 }, () => {
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
      WHERE table_schema = 'public' AND table_name = 'organization_notification_settings'`
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

  const setting = (sql: postgres.Sql, orgId: number, type: string, enabled: boolean) =>
    sql`INSERT INTO organization_notification_settings (organization_id, type, enabled)
      VALUES (${orgId}, ${type}, ${enabled})`

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
      expect(await rollbackNotificationSettings(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0035 groups unchanged and defaults every group to "nothing switched off"', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await rollbackNotificationSettings(url) // теперь БД на 0035
      const a = await org(sql, 'ns-a')
      await runMigrations(url)
      expect(await sql`SELECT 1 FROM organizations WHERE id = ${a}`).toHaveLength(1)
      expect(await sql`SELECT 1 FROM organization_notification_settings`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('accepts only switchable types, one row per group and type, and cascades with the group', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'ns-check')
      await setting(sql, a, 'reminder_24h', false)
      await setting(sql, a, 'reminder_2h', true)
      await expect(setting(sql, a, 'reminder_24h', true)).rejects.toThrow(/duplicate key/)
      for (const type of ['waitlist_offer', 'payment_confirmed', 'event_cancelled', 'weekly']) {
        await expect(setting(sql, a, type, false), type).rejects.toThrow(
          /org_notification_settings_type_chk/,
        )
      }
      await sql`DELETE FROM organizations WHERE id = ${a}`
      expect(await sql`SELECT 1 FROM organization_notification_settings`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while a type is switched off and passes once none is', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'ns-guard')
      await setting(sql, a, 'reminder_2h', false)
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0037 refused/)
      expect(await tableExists(sql)).toBe(true)
      expect(await sql`SELECT 1 FROM organization_notification_settings`).toHaveLength(1)

      // включённые строки совпадают с умолчанием и теряются без последствий
      await sql`UPDATE organization_notification_settings SET enabled = true`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await tableExists(sql)).toBe(false)
      expect(await rollbackLastMigration(url)).toBe(TAG35)
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
      const [groups] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM organizations`
      expect(await sql`SELECT 1 FROM organization_notification_settings`).toHaveLength(0)
      expect(await rollbackNotificationSettings(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(groups!.n)
      await runMigrations(url)
      expect(await tableExists(sql)).toBe(true)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
