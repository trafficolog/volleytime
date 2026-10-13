import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'
import { DEMO_ORGANIZATIONS, assertDemoSeedAllowed, seedDemo } from './seed-demo'
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

/** Task 19.2.1: демо-сид по макетам v3 на текущей схеме, идемпотентный. */
describe('seed-demo (integration)', () => {
  beforeAll(async () => {
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

  it('creates the three reference groups with fixed and split events', async () => {
    const orgs = await db.execute<{ name: string; slug: string }>(
      sql`SELECT name, slug FROM organizations ORDER BY id`,
    )
    expect([...orgs].map((o) => o.name)).toEqual(DEMO_ORGANIZATIONS.map((o) => o.name))

    const modes = await db.execute<{ price_mode: string; status: string }>(
      sql`SELECT DISTINCT price_mode, status FROM events`,
    )
    const pairs = [...modes].map((m) => `${m.price_mode}:${m.status}`)
    expect(pairs).toEqual(
      expect.arrayContaining([
        'fixed:published',
        'split:published',
        'split:closed',
        'fixed:finished',
        'fixed:cancelled',
      ]),
    )
    const waitlisted = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM bookings WHERE status = 'waitlisted'`,
    )
    expect(waitlisted[0]!.n).toBeGreaterThan(0)
  })

  it('keeps money invariants of R0.7: settled split shares sum to the target', async () => {
    const rows = await db.execute<{ target_amount: number; allocated: number; count: number }>(sql`
      SELECT e.target_amount, sum(b.allocated_amount)::int AS allocated,
             e.pricing_participant_count AS count
      FROM events e JOIN bookings b ON b.event_id = e.id
      WHERE e.price_mode = 'split' AND e.pricing_settled_at IS NOT NULL
        AND b.status IN ('pending_payment', 'confirmed', 'attended')
      GROUP BY e.id`)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(row.allocated).toBe(row.target_amount)

    const income = await db.execute<{ bad: number }>(sql`
      SELECT count(*)::int AS bad FROM payments p
      LEFT JOIN ledger_entries l ON l.payment_id = p.id AND l.type = 'income'
      WHERE (p.status = 'succeeded') <> (l.id IS NOT NULL)`)
    expect(income[0]!.bad).toBe(0)

    const subs = await db.execute<{ bad: number }>(sql`
      SELECT count(*)::int AS bad FROM subscriptions s
      WHERE s.used_sessions <> (SELECT count(*) FROM bookings b
        WHERE b.subscription_id = s.id AND b.status <> 'cancelled')`)
    expect(subs[0]!.bad).toBe(0)
  })
})
