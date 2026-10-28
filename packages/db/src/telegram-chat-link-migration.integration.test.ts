import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackCollections } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG = '0031_telegram_chat_link'
const TAG30 = '0030_event_public_slug'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

/**
 * Task 20.3.4: привязка Telegram-чата к группе. Миграция аддитивна (две таблицы и enum): применяется и
 * откатывается на пустой базе, на базе после demo-сида и на базе на 0030 с данными (ADR v3,
 * «Правила совместимости»); уникальность «один чат — одна группа, у группы один чат» держит БД;
 * откат отказывает, пока есть не отвязанные чаты.
 */
describe('migration 0031 telegram chat link (integration)', { timeout: 60_000 }, () => {
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
          WHERE table_schema = 'public'
            AND table_name IN ('organization_telegram_chats', 'telegram_chat_link_codes'))
        + (SELECT count(*) FROM pg_type WHERE typname = 'telegram_chat_link_status')
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

  const link = (
    sql: postgres.Sql,
    orgId: number,
    chatId: number,
    status = 'active',
    reason: string | null = null,
    type = 'supergroup',
    unlinkReason: string | null = status === 'unlinked' ? 'organizer' : null,
  ) => sql`
    INSERT INTO organization_telegram_chats
      (organization_id, telegram_chat_id, chat_type, title, status, invalid_reason, unlink_reason,
       confirmed_by_telegram_id)
    VALUES (${orgId}, ${chatId}, ${type}, 'Чат', ${status}::telegram_chat_link_status, ${reason},
            ${unlinkReason}, 777)`

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
      expect(await objects(sql)).toBe(3)
      await rollbackCollections(url) // 21.2.4: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      await runMigrations(url)
      expect(await objects(sql)).toBe(3)
    } finally {
      await sql.end()
    }
  })

  it('keeps 0030 data untouched and enforces the uniqueness and check constraints', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await rollbackCollections(url) // 21.2.4: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0030
      const a = await org(sql, 'chat-a')
      const b = await org(sql, 'chat-b')
      await sql`
        INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, status)
        VALUES (${a.o}, ${a.u}, 'E', now() + interval '1 day', now() + interval '1 day 2 hours', 10, 'published')`

      await runMigrations(url)
      expect(await sql`SELECT 1 FROM events`).toHaveLength(1)

      await link(sql, a.o, -1001)
      // один чат — одна группа
      await expect(link(sql, b.o, -1001)).rejects.toThrow(/org_telegram_chats_chat_uniq/)
      // у группы не больше одного не отвязанного чата, в том числе недействительного
      await expect(link(sql, a.o, -1002)).rejects.toThrow(/org_telegram_chats_org_uniq/)
      await sql`UPDATE organization_telegram_chats SET status = 'invalid', invalid_reason = 'no_rights'`
      await expect(link(sql, a.o, -1002)).rejects.toThrow(/org_telegram_chats_org_uniq/)
      await expect(link(sql, b.o, -1001)).rejects.toThrow(/org_telegram_chats_chat_uniq/)

      // отвязанная строка — история: чат и группа свободны, историй может быть несколько
      await sql`UPDATE organization_telegram_chats
        SET status = 'unlinked', invalid_reason = NULL, unlink_reason = 'bot_removed'`
      await link(sql, b.o, -1001)
      await link(sql, a.o, -1002)
      await sql`UPDATE organization_telegram_chats
        SET status = 'unlinked', unlink_reason = 'organizer' WHERE organization_id = ${b.o}`
      await link(sql, b.o, -1003)

      // причина недействительности обязательна ровно у invalid и только из списка
      await expect(link(sql, b.o, -1004, 'invalid')).rejects.toThrow(/invalid_reason_chk/)
      await expect(link(sql, b.o, -1004, 'unlinked', 'bot_removed')).rejects.toThrow(
        /invalid_reason_chk/,
      )
      await sql`UPDATE organization_telegram_chats
        SET status = 'unlinked', unlink_reason = 'organizer' WHERE organization_id = ${b.o}`
      await expect(link(sql, b.o, -1004, 'invalid', 'whatever')).rejects.toThrow(
        /invalid_reason_chk/,
      )
      // бот исключён — не состояние `invalid`: привязка снимается (`unlinked`) и освобождает чат
      await expect(link(sql, b.o, -1004, 'invalid', 'bot_removed')).rejects.toThrow(
        /invalid_reason_chk/,
      )
      // причина снятия обязательна ровно у `unlinked` и только из списка
      await sql`UPDATE organization_telegram_chats
        SET status = 'unlinked', unlink_reason = 'organizer' WHERE organization_id = ${b.o}`
      await expect(link(sql, b.o, -1004, 'unlinked', null, 'supergroup', null)).rejects.toThrow(
        /unlink_reason_chk/,
      )
      await expect(
        link(sql, b.o, -1004, 'unlinked', null, 'supergroup', 'whatever'),
      ).rejects.toThrow(/unlink_reason_chk/)
      await expect(
        link(sql, b.o, -1004, 'active', null, 'supergroup', 'organizer'),
      ).rejects.toThrow(/unlink_reason_chk/)
      // только групповые чаты
      await expect(link(sql, b.o, -1004, 'active', null, 'private')).rejects.toThrow(
        /chat_type_chk/,
      )

      // код хранится хэшем, уникально
      await sql`
        INSERT INTO telegram_chat_link_codes (organization_id, created_by_user_id, code_hash, expires_at)
        VALUES (${a.o}, ${a.u}, 'h1', now() + interval '10 minutes')`
      await expect(
        sql`INSERT INTO telegram_chat_link_codes (organization_id, created_by_user_id, code_hash, expires_at)
            VALUES (${b.o}, ${b.u}, 'h1', now() + interval '10 minutes')`,
      ).rejects.toThrow(/telegram_chat_link_codes_hash_uniq/)

      // удаление группы убирает её привязки и коды
      await sql`DELETE FROM events`
      await sql`DELETE FROM organizations WHERE id = ${a.o}`
      expect(
        await sql`SELECT 1 FROM organization_telegram_chats WHERE organization_id = ${a.o}`,
      ).toHaveLength(0)
      expect(
        await sql`SELECT 1 FROM telegram_chat_link_codes WHERE organization_id = ${a.o}`,
      ).toHaveLength(0)
    } finally {
      await sql.end()
    }
  })

  it('refuses the rollback while chats are linked and allows it after unlinking', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await rollbackCollections(url) // 21.2.4: новая миграция откатывается первой
      const a = await org(sql, 'guard-a')
      await link(sql, a.o, -2001)
      await sql`
        INSERT INTO telegram_chat_link_codes (organization_id, created_by_user_id, code_hash, expires_at)
        VALUES (${a.o}, ${a.u}, 'h2', now() + interval '10 minutes')`

      // действующая привязка блокирует откат; транзакция ничего не меняет
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0031 refused/)
      expect(await objects(sql)).toBe(3)
      // недействительная привязка тоже ещё в обращении
      await sql`UPDATE organization_telegram_chats SET status = 'invalid', invalid_reason = 'no_rights'`
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0031 refused/)
      expect(await sql`SELECT 1 FROM organization_telegram_chats`).toHaveLength(1)

      // история отвязок и неиспользованные коды откат не блокируют
      await sql`UPDATE organization_telegram_chats
        SET status = 'unlinked', invalid_reason = NULL, unlink_reason = 'bot_removed'`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await objects(sql)).toBe(0)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(1)

      await runMigrations(url)
      expect(await objects(sql)).toBe(3)
      await rollbackCollections(url) // 21.2.4: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await rollbackLastMigration(url)).toBe(TAG30)
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
      expect(orgs!.n).toBeGreaterThan(0)
      expect(await sql`SELECT 1 FROM organization_telegram_chats`).toHaveLength(0)
      await rollbackCollections(url) // 21.2.4: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM organizations`).toHaveLength(orgs!.n)
      await runMigrations(url)
      expect(await objects(sql)).toBe(3)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
