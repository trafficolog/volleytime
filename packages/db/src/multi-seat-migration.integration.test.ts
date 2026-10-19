import { randomBytes } from 'node:crypto'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DB } from './client'
import { runMigrations } from './migrate'
import { rollbackPublicSlug } from './migration-test-helpers'
import { rollbackLastMigration } from './rollback'
import * as schema from './schema'
import { seedDemo } from './seed-demo'

const TAG30 = '0030_event_public_slug'
const TAG27 = '0027_event_series'
const TAG29 = '0029_notifications_feed'
const TAG28 = '0028_event_jobs'
const TAG26 = '0026_event_join_mode_invites'
const TAG = '0025_multi_seat_booking'
const TAG24 = '0024_event_balance'
const BASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''

const NEW_COLUMNS: [string, string][] = [
  ['bookings', 'seats'],
  ['bookings', 'waitlist_seats'],
  ['bookings', 'incarnation'],
  ['payments', 'booking_incarnation'],
  ['payments', 'seat_released_at'],
]

/**
 * Task 20.1.2: миграция мест в записи применяется и откатывается на пустой базе, на базе после
 * demo-сида и на базе, стоящей на 0024 с данными R0.7 (ADR v3, «Правила совместимости», п. 1–7):
 * backfill воплощений и освобождённых мест (D-14), совместимость INSERT/UPDATE прежнего runtime.
 * Каждый тест работает во временной БД.
 */
describe('migration 0025 multi-seat booking (integration)', { timeout: 60_000 }, () => {
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

  async function columns(sql: postgres.Sql) {
    const rows = await sql<{ t: string; c: string }[]>`
      SELECT table_name AS t, column_name AS c FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('bookings', 'payments')`
    const present = new Set(rows.map((r) => `${r.t}.${r.c}`))
    return NEW_COLUMNS.filter(([t, c]) => present.has(`${t}.${c}`)).length
  }

  async function triggers(sql: postgres.Sql) {
    return (
      await sql<{ tgname: string }[]>`
        SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`
    ).map((r) => r.tgname)
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
      expect(await columns(sql)).toBe(NEW_COLUMNS.length)
      expect(await triggers(sql)).toEqual([
        'bookings_bump_incarnation',
        'payments_fill_booking_incarnation',
      ])

      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await columns(sql)).toBe(0)
      expect(await triggers(sql)).toEqual([])
      expect(
        await sql`SELECT 1 FROM pg_proc WHERE proname IN ('bookings_bump_incarnation', 'payments_fill_booking_incarnation')`,
      ).toHaveLength(0)

      await runMigrations(url)
      expect(await columns(sql)).toBe(NEW_COLUMNS.length)
    } finally {
      await sql.end()
    }
  })

  it('backfills incarnations and released paid seats on R0.7 data and keeps the old runtime working', async () => {
    const { url, sql } = await scratchDb()
    try {
      await runMigrations(url)
      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG) // теперь БД на 0024
      const [user] = await sql<{ id: number }[]>`
        INSERT INTO users (email) VALUES ('r07@example.com') RETURNING id`
      const u = user!.id
      const [org] = await sql<{ id: number }[]>`
        INSERT INTO organizations (slug, name, owner_user_id) VALUES ('r07', 'R07', ${u}) RETURNING id`
      const o = org!.id
      const event = async (title: string) =>
        (
          await sql<{ id: number }[]>`
            INSERT INTO events (organization_id, created_by_user_id, title, starts_at, ends_at, capacity, price, status)
            VALUES (${o}, ${u}, ${title}, now() + interval '1 day', now() + interval '2 day', 10, 1500, 'published')
            RETURNING id`
        )[0]!.id
      const booking = async (eventId: number, status: string, extra = '') =>
        (
          await sql.unsafe<{ id: number }[]>(
            `INSERT INTO bookings (event_id, user_id, organization_id, status, method${extra ? ', cancelled_at' : ''})
             VALUES (${eventId}, ${u}, ${o}, '${status}', 'cash'${extra ? `, ${extra}` : ''}) RETURNING id`,
          )
        )[0]!.id
      const payment = async (bookingId: number | null, status: string, confirmed = false) =>
        (
          await sql.unsafe<{ id: number }[]>(
            `INSERT INTO payments (organization_id, user_id, booking_id, amount, method, status, confirmed_at)
             VALUES (${o}, ${u}, ${bookingId ?? 'NULL'}, 1500, 'cash', '${status}', ${confirmed ? "'2026-10-01T10:00:00Z'" : 'NULL'})
             RETURNING id`,
          )
        )[0]!.id

      // A: активная запись с текущим pending-платежом
      const a = await booking(await event('A'), 'pending_payment')
      const pa = await payment(a, 'pending')
      // B: реактивированная запись — прошлые платежи (cancelled, зависший pending, succeeded) и текущий
      const b = await booking(await event('B'), 'confirmed')
      const pbOldCancelled = await payment(b, 'cancelled')
      const pbOldPending = await payment(b, 'pending')
      const pbOldPaid = await payment(b, 'succeeded', true)
      const pb = await payment(b, 'succeeded', true)
      // C: отменённая игроком запись с оплатой без возврата (6.8.6)
      const c = await booking(await event('C'), 'cancelled', `'2026-10-05T12:00:00Z'`)
      const pc = await payment(c, 'succeeded', true)
      const ps = await payment(null, 'pending') // абонемент (без записи)
      await sql`UPDATE bookings SET payment_id = ${pa} WHERE id = ${a}`
      await sql`UPDATE bookings SET payment_id = ${pb} WHERE id = ${b}`
      await sql`UPDATE bookings SET payment_id = ${pc} WHERE id = ${c}`

      await runMigrations(url)

      expect(
        await sql`SELECT id, seats, waitlist_seats, incarnation FROM bookings ORDER BY id`,
      ).toEqual([
        { id: a, seats: 1, waitlist_seats: 0, incarnation: 1 },
        { id: b, seats: 1, waitlist_seats: 0, incarnation: 1 },
        { id: c, seats: 1, waitlist_seats: 0, incarnation: 1 },
      ])
      const pays = await sql<
        { id: number; status: string; booking_incarnation: number | null; released: boolean }[]
      >`SELECT id, status, booking_incarnation, seat_released_at IS NOT NULL AS released
        FROM payments ORDER BY id`
      expect(pays).toEqual([
        { id: pa, status: 'pending', booking_incarnation: 1, released: false },
        { id: pbOldCancelled, status: 'cancelled', booking_incarnation: 0, released: false },
        { id: pbOldPending, status: 'cancelled', booking_incarnation: 0, released: false },
        { id: pbOldPaid, status: 'succeeded', booking_incarnation: 0, released: true },
        { id: pb, status: 'succeeded', booking_incarnation: 1, released: false },
        { id: pc, status: 'succeeded', booking_incarnation: 1, released: true },
        { id: ps, status: 'pending', booking_incarnation: null, released: false },
      ])
      expect(
        (await sql`SELECT seat_released_at FROM payments WHERE id = ${pc}`)[0]!.seat_released_at,
      ).toEqual(new Date('2026-10-05T12:00:00Z'))
      expect(
        (await sql`SELECT seat_released_at FROM payments WHERE id = ${pbOldPaid}`)[0]!
          .seat_released_at,
      ).toEqual(new Date('2026-10-01T10:00:00Z'))
      // зависший pending прошлого воплощения отменён с записью аудита (ADR)
      expect(
        await sql`SELECT entity_id, user_id, old_value, new_value FROM audit_log
                  WHERE action = 'payment.cancelled_stale_incarnation'`,
      ).toEqual([
        {
          entity_id: pbOldPending,
          user_id: null,
          old_value: { status: 'pending' },
          new_value: { status: 'cancelled', source: 'migration:0025_multi_seat_booking' },
        },
      ])
      // у каждой записи R0.7 — не больше одного живого платежа, и это bookings.payment_id
      expect(
        await sql`
          SELECT b.id FROM bookings b
          WHERE b.status <> 'cancelled' AND (
            SELECT count(*) FROM payments p
            WHERE p.booking_id = b.id AND p.booking_incarnation = b.incarnation
              AND p.seat_released_at IS NULL AND p.status IN ('pending', 'succeeded')
          ) <> 1`,
      ).toHaveLength(0)

      // прежний runtime: платёж без воплощения получает текущее, реактивация увеличивает воплощение
      await sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${a}`
      await sql`UPDATE bookings SET status = 'pending_payment', payment_id = NULL WHERE id = ${a}`
      const [old] = await sql<{ booking_incarnation: number }[]>`
        INSERT INTO payments (organization_id, user_id, booking_id, amount, method)
        VALUES (${o}, ${u}, ${a}, 1500, 'cash') RETURNING booking_incarnation`
      expect(old!.booking_incarnation).toBe(2)
      expect((await sql`SELECT incarnation FROM bookings WHERE id = ${a}`)[0]).toEqual({
        incarnation: 2,
      })

      // ограничения
      await expect(sql`UPDATE bookings SET seats = 0 WHERE id = ${a}`).rejects.toThrow(
        /bookings_seats_positive/,
      )
      await expect(sql`UPDATE bookings SET waitlist_seats = -1 WHERE id = ${a}`).rejects.toThrow(
        /bookings_waitlist_seats_non_negative/,
      )
      await expect(sql`UPDATE bookings SET waitlist_seats = 1 WHERE id = ${c}`).rejects.toThrow(
        /bookings_waitlist_seats_status/,
      )
      await expect(
        sql`UPDATE payments SET seat_released_at = now() WHERE id = ${pa}`,
      ).rejects.toThrow(/payments_seat_released_status/)
      await expect(
        sql`UPDATE payments SET booking_incarnation = NULL WHERE id = ${pa}`,
      ).rejects.toThrow(/payments_booking_incarnation_required/)

      // очередная часть мест тоже блокирует откат
      await sql`UPDATE bookings SET seats = 2, waitlist_seats = 1 WHERE id = ${a}`
      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0025 refused/)
      await sql`UPDATE bookings SET seats = 1, waitlist_seats = 0 WHERE id = ${a}`

      // откат возвращает 0024 и не трогает данные R0.7
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await sql`SELECT 1 FROM bookings`).toHaveLength(3)
      expect(await sql`SELECT 1 FROM payments`).toHaveLength(8)
      expect(await columns(sql)).toBe(0)
      expect(await rollbackLastMigration(url)).toBe(TAG24)
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
      const snapshot = async () => ({
        bookings: await count('bookings'),
        payments: await count('payments'),
        ledger: await count('ledger_entries'),
      })
      const before = await snapshot()

      // сид содержит запись на несколько мест: один платёж на место, все живые
      const multi = await sql<{ id: number; seats: number; live: number }[]>`
        SELECT b.id, b.seats, (
          SELECT count(*)::int FROM payments p
          WHERE p.booking_id = b.id AND p.booking_incarnation = b.incarnation
            AND p.seat_released_at IS NULL AND p.status IN ('pending', 'succeeded')) AS live
        FROM bookings b WHERE b.seats > 1`
      expect(multi.length).toBeGreaterThan(0)
      for (const row of multi) expect(row.live).toBe(row.seats)
      // занятость по местам не превышает вместимость ни у одного события
      expect(
        await sql`
          SELECT e.id FROM events e JOIN bookings b ON b.event_id = e.id
          WHERE b.status IN ('confirmed', 'pending_payment', 'attended', 'no_show')
          GROUP BY e.id, e.capacity HAVING sum(b.seats) > e.capacity`,
      ).toHaveLength(0)

      await seedDemo(database)
      expect(await snapshot()).toEqual(before)

      // откат отказывает, пока есть данные нескольких мест (прежний runtime считает count(*)),
      // и ничего не меняет: транзакция отката откатывается целиком
      await sql`DELETE FROM event_series` // 20.2.2: откат 0027 требует отсутствия серий
      expect(await rollbackPublicSlug(url, sql)).toBe(TAG30) // 20.6.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG29) // 20.3.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG28) // 20.3.1: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG27) // 20.2.2: новая миграция откатывается первой
      expect(await rollbackLastMigration(url)).toBe(TAG26) // 20.1.3: новая миграция откатывается первой
      await expect(rollbackLastMigration(url)).rejects.toThrow(/rollback 0025 refused/)
      expect(await columns(sql)).toBe(NEW_COLUMNS.length)
      await sql`UPDATE bookings SET seats = 1, waitlist_seats = 0 WHERE seats > 1`
      expect(await rollbackLastMigration(url)).toBe(TAG)
      expect(await snapshot()).toEqual(before)
      await runMigrations(url)
      expect(await columns(sql)).toBe(NEW_COLUMNS.length)
      expect(await snapshot()).toEqual(before)
    } finally {
      await client.end()
      await sql.end()
    }
  })
})
