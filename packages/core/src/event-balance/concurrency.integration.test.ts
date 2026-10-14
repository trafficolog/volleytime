import {
  appendEventBalanceEntry,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  organizationEventBalances,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

const future = (h = 24) => new Date(Date.now() + h * 3600_000)
const eventInput = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  startsAt: future(),
  endsAt: future(26),
  capacity: 10,
  price: 0,
  ...extra,
})

let ownerId: number
let orgId: number
const previousFlag = process.env.EVENT_BALANCE_ENFORCED

async function balance() {
  const [row] = await db
    .select()
    .from(organizationEventBalances)
    .where(eq(organizationEventBalances.organizationId, orgId))
  return row!.balance
}

async function reasons() {
  const rows = await db
    .select({ reason: eventBalanceEntries.reason })
    .from(eventBalanceEntries)
    .where(eq(eventBalanceEntries.organizationId, orgId))
  return rows.map((r) => r.reason)
}

async function drift() {
  return db.execute(sql`
    SELECT o.id FROM organizations o
    LEFT JOIN organization_event_balances b ON b.organization_id = o.id
    LEFT JOIN (SELECT organization_id, sum(delta)::int AS s FROM event_balance_entries GROUP BY 1) e
      ON e.organization_id = o.id
    WHERE coalesce(b.balance, 0) <> coalesce(e.s, 0)`)
}

async function setBalance(n: number) {
  const delta = n - (await balance())
  if (delta === 0) return
  await db.transaction((tx) =>
    appendEventBalanceEntry(tx, {
      organizationId: orgId,
      delta,
      reason: 'correction',
      actor: { kind: 'user', userId: ownerId },
      comment: 'test setup',
    }),
  )
}

const codeOf = (r: PromiseSettledResult<unknown>) =>
  r.status === 'rejected' ? (r.reason as { code?: string }).code : 'ok'

describe('event balance races (integration, 20.2.1)', () => {
  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `race-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Race' })).id
  })

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('parallel publications with 2 events left: exactly 2 succeed, the rest are refused', async () => {
    await setBalance(2)
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        eventService.create({ userId: ownerId }, orgId, eventInput(`Race ${i}`)),
      ),
    )
    const codes = results.map(codeOf)
    expect(codes.filter((c) => c === 'ok')).toHaveLength(2)
    expect(codes.filter((c) => c === 'event_balance.insufficient')).toHaveLength(6)
    expect(await balance()).toBe(0)
    expect((await reasons()).filter((r) => r === 'spend')).toHaveLength(2)
    expect((await drift()).length).toBe(0)
  })

  it('parallel draft → published updates never overspend', async () => {
    const drafts = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        eventService.create({ userId: ownerId }, orgId, eventInput(`D${i}`, { status: 'draft' })),
      ),
    )
    await setBalance(3)
    const results = await Promise.allSettled(
      drafts.map((d) => eventService.update({ userId: ownerId }, d.id, { status: 'published' })),
    )
    expect(results.map(codeOf).filter((c) => c === 'ok')).toHaveLength(3)
    expect(await balance()).toBe(0)
    expect((await drift()).length).toBe(0)
  })

  it('the same draft published in parallel is charged once', async () => {
    const draft = await eventService.create(
      { userId: ownerId },
      orgId,
      eventInput('Once', { status: 'draft' }),
    )
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        eventService.update({ userId: ownerId }, draft.id, { status: 'published' }),
      ),
    )
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    expect((await reasons()).filter((r) => r === 'spend')).toHaveLength(1)
    expect(await balance()).toBe(4)
  })

  it('parallel cancels of one event refund it once', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, eventInput('Cancel'))
    await Promise.all(
      Array.from({ length: 5 }, () => eventService.cancel({ userId: ownerId }, ev.id)),
    )
    expect((await reasons()).filter((r) => r === 'refund')).toHaveLength(1)
    expect(await balance()).toBe(5)
    expect((await drift()).length).toBe(0)
  })

  it('booking vs cancel race: refund happens only if no booking was active at cancel time', async () => {
    const [p] = await db
      .insert(users)
      .values({ email: `p-${Math.random()}@t.by` })
      .returning()
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: p!.id })
    for (let i = 0; i < 6; i++) {
      await setBalance(5)
      const ev = await eventService.create({ userId: ownerId }, orgId, eventInput(`BvC ${i}`))
      const [booked] = await Promise.allSettled([
        bookingService.book({ userId: p!.id }, orgId, ev.id, { method: 'free' }),
        eventService.cancel({ userId: ownerId }, ev.id),
      ])
      const refunded = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.eventId, ev.id))
      const gotRefund = refunded.some((r) => r.reason === 'refund')
      // запись прошла раньше отмены → возврата нет; отмена раньше записи → запись отклонена, возврат есть
      expect(gotRefund).toBe(booked.status === 'rejected')
    }
    expect((await drift()).length).toBe(0)
  })
})
