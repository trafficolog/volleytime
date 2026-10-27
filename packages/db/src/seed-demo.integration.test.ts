import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'
import { organizations, users } from './schema'
import { DEMO_ORGANIZATIONS, allocate, assertDemoSeedAllowed, seedDemo } from './seed-demo'
import { truncateAll } from './test-utils'

const TABLES = [
  'users',
  'organizations',
  'organization_members',
  'venues',
  'events',
  'bookings',
  'subscription_plans',
  'subscriptions',
  'payments',
  'ledger_entries',
  'event_series',
  'collections',
] as const

async function counts(): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const table of TABLES) {
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)}`,
    )
    result[table] = row!.n
  }
  return result
}

async function one<T>(query: ReturnType<typeof sql>): Promise<T> {
  const rows = await db.execute<T & Record<string, unknown>>(query)
  return rows[0] as T
}

/** Task 19.2.1: демо-сид по макетам v3 на текущей схеме, идемпотентный. Каждый тест сидит сам. */
describe('seed-demo (integration)', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await truncateAll()
    await closeDb()
  })

  it('refuses to run in production', () => {
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'production' })).toThrow(/production/)
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'development' })).not.toThrow()
    expect(() => assertDemoSeedAllowed({})).not.toThrow()
  })

  it('creates reference data and keeps counts stable on a second run', async () => {
    await seedDemo(db)
    const first = await counts()
    for (const table of TABLES) expect(first[table], table).toBeGreaterThan(0)

    await seedDemo(db)
    expect(await counts()).toEqual(first)
  })

  it('serializes concurrent runs without duplicates', async () => {
    await Promise.all([seedDemo(db), seedDemo(db)])
    const concurrent = await counts()

    await truncateAll()
    await seedDemo(db)
    expect(concurrent).toEqual(await counts())
  })

  it('refuses to seed into a non-demo organization that holds a demo slug', async () => {
    const [stranger] = await db
      .insert(users)
      .values({ email: 'stranger@example.com', name: 'Чужой' })
      .returning()
    await db.insert(organizations).values({
      slug: DEMO_ORGANIZATIONS[0]!.slug,
      name: 'Чужая группа',
      ownerUserId: stranger!.id,
    })

    await expect(seedDemo(db)).rejects.toThrow(/non-demo owner/)
    const { n } = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM events`)
    expect(n).toBe(0)
  })

  it('creates the three reference groups with fixed and split events', async () => {
    await seedDemo(db)
    const orgs = await db.execute<{ name: string }>(sql`SELECT name FROM organizations ORDER BY id`)
    expect([...orgs].map((o) => o.name)).toEqual(DEMO_ORGANIZATIONS.map((o) => o.name))

    const modes = await db.execute<{ price_mode: string; status: string }>(
      sql`SELECT DISTINCT price_mode, status FROM events`,
    )
    expect([...modes].map((m) => `${m.price_mode}:${m.status}`)).toEqual(
      expect.arrayContaining([
        'fixed:published',
        'split:published',
        'split:closed',
        'fixed:finished',
        'fixed:cancelled',
      ]),
    )
    const { n } = await one<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM bookings WHERE status = 'waitlisted'`,
    )
    expect(n).toBeGreaterThan(0)
  })

  it('keeps R0.7 money invariants: split shares, payment linkage, ledger, sessions', async () => {
    await seedDemo(db)

    // доли зафиксированного split = цель до копейки (D-01), число участников = pricing_participant_count
    const splits = await db.execute<{
      target: number
      allocated: number
      n: number
      pc: number
    }>(sql`
      SELECT e.target_amount AS target, sum(b.allocated_amount)::int AS allocated,
             count(b.id)::int AS n, e.pricing_participant_count AS pc
      FROM events e JOIN bookings b ON b.event_id = e.id
      WHERE e.price_mode = 'split' AND e.pricing_settled_at IS NOT NULL
        AND b.status IN ('pending_payment', 'confirmed', 'attended')
      GROUP BY e.id`)
    expect(splits.length).toBeGreaterThan(0)
    for (const s of splits) {
      expect(s.allocated).toBe(s.target)
      expect(s.n).toBe(s.pc)
    }

    // платёж записи: ссылка в обе стороны, сумма = доля (split) или цена (fixed)
    const badLinks = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM bookings b
      JOIN events e ON e.id = b.event_id
      LEFT JOIN payments p ON p.id = b.payment_id
      WHERE b.method IN ('cash', 'transfer') AND b.status <> 'waitlisted'
        AND (e.price_mode = 'fixed' OR e.pricing_settled_at IS NOT NULL)
        AND (p.id IS NULL OR p.booking_id <> b.id OR p.user_id <> b.user_id
             OR p.amount <> CASE WHEN e.price_mode = 'split' THEN b.allocated_amount ELSE e.price END)`)
    expect(badLinks.n).toBe(0)

    // каждый платёж записи — живой платёж её текущего воплощения (20.1.2), их число = seats
    const strayPayments = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM payments p
      LEFT JOIN bookings b ON b.id = p.booking_id
      WHERE p.booking_id IS NOT NULL
        AND (b.id IS NULL OR p.booking_incarnation <> b.incarnation OR p.seat_released_at IS NOT NULL)`)
    expect(strayPayments.n).toBe(0)
    const seatPayments = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM bookings b
      WHERE b.payment_id IS NOT NULL
        AND b.seats <> (SELECT count(*) FROM payments p WHERE p.booking_id = b.id)`)
    expect(seatPayments.n).toBe(0)

    // нет платежа у незафиксированного split и у листа ожидания
    const unexpected = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM bookings b JOIN events e ON e.id = b.event_id
      WHERE b.payment_id IS NOT NULL
        AND (b.status = 'waitlisted' OR (e.price_mode = 'split' AND e.pricing_settled_at IS NULL))`)
    expect(unexpected.n).toBe(0)

    const income = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM payments p
      LEFT JOIN ledger_entries l ON l.payment_id = p.id AND l.type = 'income'
      WHERE (p.status = 'succeeded') <> (l.id IS NOT NULL) OR l.amount <> p.amount`)
    expect(income.n).toBe(0)

    // сборы (21.2.4): подтверждённый взнос — доход кассы `contribution`, сумма сбора = касса по сбору
    const contributions = await one<{ n: number; bad: number }>(sql`
      SELECT count(*)::int AS n,
             count(*) FILTER (WHERE p.status = 'succeeded' AND l.category <> 'contribution')::int AS bad
      FROM payments p LEFT JOIN ledger_entries l ON l.payment_id = p.id AND l.type = 'income'
      WHERE p.collection_id IS NOT NULL`)
    expect(contributions.n).toBeGreaterThan(0)
    expect(contributions.bad).toBe(0)

    const sessions = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM subscriptions s
      WHERE s.used_sessions <> (SELECT count(*) FROM bookings b
        WHERE b.subscription_id = s.id AND b.status <> 'cancelled')`)
    expect(sessions.n).toBe(0)
  })

  it('allocates split shares exactly like R0.7 allocateSplitAmount', async () => {
    // копия allocate сверяется с оригиналом из packages/shared. Путь не литерал: db не зависит
    // от shared, и tsc пакета db (rootDir) не должен включать чужие исходники; vitest грузит файл.
    const sharedPricing = ['..', '..', 'shared', 'src', 'events', 'pricing'].join('/')
    const { allocateSplitAmount } = (await import(/* @vite-ignore */ sharedPricing)) as {
      allocateSplitAmount: (
        total: number,
        participants: { bookingId: number; bookedAt: Date }[],
      ) => { bookingId: number; amount: number }[]
    }
    for (const [total, count] of [
      [18000, 12],
      [24000, 7],
      [100, 3],
      [5, 5],
    ] as const) {
      const participants = Array.from({ length: count }, (_, i) => ({
        bookingId: i + 1,
        bookedAt: new Date(1_000 + i),
      }))
      expect(allocate(total, count)).toEqual(
        allocateSplitAmount(total, participants).map((s) => s.amount),
      )
    }
  })
})
