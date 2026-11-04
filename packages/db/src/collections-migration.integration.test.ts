import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0032_collections'
const TAG31 = '0031_telegram_chat_link'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 21.2.4: сборы. Миграция аддитивна (enum, таблица `collections`, колонка
 * `payments.collection_id`, составной FK, CHECK «одна цель платежа», частичный UNIQUE «одно
 * ожидающее обещание»): применяется и откатывается на пустой базе, на базе после demo-сида и на
 * базе на 0031 с платежами R0.7 (ADR v3, «Правила совместимости»); откат отказывает, пока есть сборы.
 */
describe('migration 0032 collections (integration)', { timeout: 60_000 }, () => {
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

  async function objects(sql: postgres.Sql) {
    const [row] = await sql<{ n: number }[]>`
      SELECT (
        (SELECT count(*) FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'collections')
        + (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'collection_id')
        + (SELECT count(*) FROM pg_type WHERE typname = 'collection_status')
        + (SELECT count(*) FROM pg_constraint WHERE conname = 'payments_single_target')
      )::int AS n`
    return row!.n
  }

  async function org(sql: postgres.Sql, slug: string): Promise<{ o: number; u: number }> {
    const [user] = await sql<{ id: number }[]>`
      INSERT INTO users (email) VALUES (${`${slug}@example.com`}) RETURNING id`
    const [o] = await sql<{ id: number }[]>`
      INSERT INTO organizations (slug, name, owner_user_id) VALUES (${slug}, ${slug}, ${user!.id})
      RETURNING id`
    return { o: o!.id, u: user!.id }
  }

  const collection = async (sql: postgres.Sql, orgId: number, userId: number) => {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO collections (organization_id, title, created_by_user_id, status, target_amount)
      VALUES (${orgId}, 'Мячи', ${userId}, 'active', 25000) RETURNING id`
    return row!.id
  }

  const contribution = (
    sql: postgres.Sql,
    orgId: number,
    userId: number,
    collectionId: number,
    status = 'pending',
  ) => sql`
    INSERT INTO payments (organization_id, user_id, collection_id, amount, method, status)
    VALUES (${orgId}, ${userId}, ${collectionId}, 1500, 'cash', ${status}::payment_status)`

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

  it('keeps 0031 payments untouched and enforces the collection constraints', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0031
      const a = await org(sql, 'col-a')
      const b = await org(sql, 'col-b')
      // платёж R0.7 без цели (как ручной платёж) переживает миграцию
      await sql`INSERT INTO payments (organization_id, user_id, amount, method)
        VALUES (${a.o}, ${a.u}, 1000, 'cash')`

      await runMigrations(url)
      const [legacy] = await sql<{ collection_id: number | null }[]>`
        SELECT collection_id FROM payments`
      expect(legacy!.collection_id).toBeNull()

      const ca = await collection(sql, a.o, a.u)
      await contribution(sql, a.o, a.u, ca)
      // взнос — только в сбор своей группы (составной FK)
      await expect(contribution(sql, b.o, b.u, ca)).rejects.toThrow(/payments_collection_org_fk/)
      // одно ожидающее обещание игрока в сборе; подтверждённые не ограничены
      await expect(contribution(sql, a.o, a.u, ca)).rejects.toThrow(
        /payments_collection_pending_uniq/,
      )
      await contribution(sql, a.o, a.u, ca, 'succeeded')
      await contribution(sql, a.o, a.u, ca, 'succeeded')
      // у платежа одна цель
      await expect(
        sql`INSERT INTO payments (organization_id, user_id, subscription_id, collection_id, amount, method)
            VALUES (${a.o}, ${a.u}, 1, ${ca}, 100, 'cash')`,
      ).rejects.toThrow(/payments_single_target/)
      // цель > 0, иконка из списка, название непустое, closed_at ровно у закрытых
      await expect(
        sql`INSERT INTO collections (organization_id, title, created_by_user_id, target_amount)
            VALUES (${a.o}, 'X', ${a.u}, 0)`,
      ).rejects.toThrow(/collections_target_positive/)
      await expect(
        sql`INSERT INTO collections (organization_id, title, created_by_user_id, icon)
            VALUES (${a.o}, 'X', ${a.u}, 'rocket')`,
      ).rejects.toThrow(/collections_icon_chk/)
      await expect(
        sql`INSERT INTO collections (organization_id, title, created_by_user_id)
            VALUES (${a.o}, '   ', ${a.u})`,
      ).rejects.toThrow(/collections_title_chk/)
      await expect(
        sql`UPDATE collections SET status = 'completed' WHERE id = ${ca}`,
      ).rejects.toThrow(/collections_closed_at_chk/)
      await sql`UPDATE collections SET status = 'completed', closed_at = now() WHERE id = ${ca}`
      // сбор с взносами не удаляется сам по себе
      await expect(sql`DELETE FROM collections WHERE id = ${ca}`).rejects.toThrow(
        /payments_collection_org_fk/,
      )
      // удаление группы снимает её сборы и взносы одной командой
      await sql`DELETE FROM organizations WHERE id = ${a.o}`
      expect(await sql`SELECT 1 FROM collections`).toHaveLength(0)
      expect(await sql`SELECT 1 FROM payments WHERE organization_id = ${a.o}`).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while collections exist and allows it afterwards', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      const a = await org(sql, 'guard-a')
      const ca = await collection(sql, a.o, a.u)
      await contribution(sql, a.o, a.u, ca, 'succeeded')

      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0032 refused/)
      expect(await objects(sql)).toBe(4)
      expect(await sql`SELECT 1 FROM payments WHERE collection_id = ${ca}`).toHaveLength(1)

      // путь оператора из rollback/0032_collections.sql: платёж остаётся платежом без цели
      await sql`UPDATE payments SET collection_id = NULL WHERE collection_id IS NOT NULL`
      await sql`DELETE FROM collections`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM payments`).toHaveLength(1)

      await runMigrations(url)
      expect(await objects(sql)).toBe(4)
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG31)
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
      const [pays] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM payments`
      // demo-сид создаёт сборы со взносами (ADR v3 «Демо-данные»): откат отказывает
      expect(await sql`SELECT 1 FROM collections`).not.toHaveLength(0)
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0032 refused/)
      await sql`UPDATE payments SET collection_id = NULL WHERE collection_id IS NOT NULL`
      await sql`DELETE FROM collections`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(orgs!.n)
      expect(await sql`SELECT 1 FROM payments`).toHaveLength(pays!.n)
      await runMigrations(url)
      expect(await objects(sql)).toBe(4)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
