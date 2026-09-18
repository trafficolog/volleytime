import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'

/** Task 5.13.13: CHECK/FK для денег и слотов — вторая линия защиты. */
describe('money & slot constraints (integration)', () => {
  it('declares all constraints', async () => {
    const names = [
      'events_capacity_positive',
      'events_price_non_negative',
      'events_ends_after_start',
      'subscriptions_used_within_total',
      'subscriptions_total_positive',
      'subscription_plans_sessions_positive',
      'subscription_plans_price_non_negative',
      'payments_amount_positive',
      'ledger_entries_amount_positive',
      'bookings_subscription_id_subscriptions_id_fk',
      'bookings_payment_id_payments_id_fk',
    ]
    const found = await db.execute<{ conname: string }>(
      sql`SELECT conname FROM pg_constraint WHERE conname = ANY(${sql.raw(`ARRAY['${names.join("','")}']`)})`,
    )
    expect([...found].map((r) => r.conname).sort()).toEqual([...names].sort())
  })

  afterAll(async () => {
    await closeDb()
  })
})
