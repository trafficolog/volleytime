import {
  appendEventBalanceEntry,
  asc,
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  events,
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

import { EVENT_BALANCE_LOW_THRESHOLD, EVENT_BALANCE_PACKAGES } from './config'
import { eventBalanceService } from './service'

const future = (h = 24) => new Date(Date.now() + h * 3600_000)
const eventInput = (title = 'Игра', extra: Record<string, unknown> = {}) => ({
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

async function newUser(name = 'u') {
  const [u] = await db
    .insert(users)
    .values({ email: `eb-${Math.random()}@t.by`, name })
    .returning()
  return u!.id
}

async function entriesOf(org = orgId) {
  return db
    .select()
    .from(eventBalanceEntries)
    .where(eq(eventBalanceEntries.organizationId, org))
    .orderBy(asc(eventBalanceEntries.id))
}

async function balanceOf(org = orgId) {
  const [row] = await db
    .select()
    .from(organizationEventBalances)
    .where(eq(organizationEventBalances.organizationId, org))
  return row?.balance ?? null
}

/** Проекция = сумма журнала у каждой организации (ADR «баланс как сумма»). */
async function drift() {
  return db.execute(sql`
    SELECT o.id FROM organizations o
    LEFT JOIN organization_event_balances b ON b.organization_id = o.id
    LEFT JOIN (SELECT organization_id, sum(delta)::int AS s FROM event_balance_entries GROUP BY 1) e
      ON e.organization_id = o.id
    WHERE coalesce(b.balance, 0) <> coalesce(e.s, 0)`)
}

/** Оставить у группы ровно n событий баланса (операторское исправление в тесте). */
async function setBalance(n: number, org = orgId) {
  const current = (await balanceOf(org)) ?? 0
  if (current === n) return
  await db.transaction((tx) =>
    appendEventBalanceEntry(tx, {
      organizationId: org,
      delta: n - current,
      reason: 'correction',
      actor: { kind: 'user', userId: ownerId },
      comment: 'test setup',
    }),
  )
}

describe('event balance (integration, 20.2.1)', () => {
  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('Owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Balance Org' })).id
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

  it('a new group gets the demo quota of 5 events atomically with its creation', async () => {
    const [entry] = await entriesOf()
    expect(await entriesOf()).toHaveLength(1)
    expect(entry).toMatchObject({
      delta: 5,
      reason: 'demo_grant',
      balanceAfter: 5,
      actorKind: 'system',
      source: 'org-create',
      createdByUserId: null,
    })
    expect(entry!.comment).toBeTruthy()
    expect(await balanceOf()).toBe(5)

    const view = await eventBalanceService.get({ userId: ownerId }, orgId)
    expect(view).toMatchObject({
      balance: 5,
      lowThreshold: EVENT_BALANCE_LOW_THRESHOLD,
      low: true,
    })
    expect(view.packages).toEqual(EVENT_BALANCE_PACKAGES)
    expect(view.pendingRequests).toEqual([])
  })

  it('low-balance threshold: low at or below the threshold, not above', async () => {
    await setBalance(EVENT_BALANCE_LOW_THRESHOLD + 1)
    expect((await eventBalanceService.get({ userId: ownerId }, orgId)).low).toBe(false)
    await setBalance(EVENT_BALANCE_LOW_THRESHOLD)
    expect((await eventBalanceService.get({ userId: ownerId }, orgId)).low).toBe(true)
    await setBalance(0)
    expect((await eventBalanceService.get({ userId: ownerId }, orgId)).low).toBe(true)
  })

  it('publishing spends one event with author and link; drafts are free (D-04)', async () => {
    const draft = await eventService.create(
      { userId: ownerId },
      orgId,
      eventInput('Draft', { status: 'draft' }),
    )
    expect(await balanceOf()).toBe(5)

    const published = await eventService.create({ userId: ownerId }, orgId, eventInput('Pub'))
    expect(await balanceOf()).toBe(4)
    const spend = (await entriesOf()).at(-1)!
    expect(spend).toMatchObject({
      delta: -1,
      reason: 'spend',
      eventId: published.id,
      balanceAfter: 4,
      actorKind: 'user',
      createdByUserId: ownerId,
    })

    // draft → published списывает; снятие с публикации и повторная публикация — не второй раз
    await eventService.update({ userId: ownerId }, draft.id, { status: 'published' })
    expect(await balanceOf()).toBe(3)
    await eventService.update({ userId: ownerId }, draft.id, { status: 'draft' })
    await eventService.update({ userId: ownerId }, draft.id, { status: 'published' })
    expect(await balanceOf()).toBe(3)
    expect((await entriesOf()).filter((e) => e.reason === 'spend')).toHaveLength(2)
    // правка опубликованного события баланс не трогает
    await eventService.update({ userId: ownerId }, published.id, { title: 'Pub 2' })
    expect(await balanceOf()).toBe(3)
    expect((await drift()).length).toBe(0)
  })

  it('only a transition into published spends: draft → closed/finished is free', async () => {
    for (const status of ['closed', 'finished'] as const) {
      const draft = await eventService.create(
        { userId: ownerId },
        orgId,
        eventInput(`Draft ${status}`, { status: 'draft' }),
      )
      await eventService.update({ userId: ownerId }, draft.id, { status })
    }
    expect(await balanceOf()).toBe(5)
    expect((await entriesOf()).filter((e) => e.reason === 'spend')).toHaveLength(0)
  })

  it('never goes negative: publishing at zero fails and creates nothing', async () => {
    await setBalance(0)
    const before = await db.select().from(events).where(eq(events.organizationId, orgId))
    await expect(
      eventService.create({ userId: ownerId }, orgId, eventInput('No balance')),
    ).rejects.toMatchObject({ code: 'event_balance.insufficient' })
    expect(await db.select().from(events).where(eq(events.organizationId, orgId))).toHaveLength(
      before.length,
    )

    // черновик создаётся, но не публикуется
    const draft = await eventService.create(
      { userId: ownerId },
      orgId,
      eventInput('Draft', { status: 'draft' }),
    )
    await expect(
      eventService.update({ userId: ownerId }, draft.id, {
        status: 'published',
        title: 'Опубликовать',
      }),
    ).rejects.toMatchObject({ code: 'event_balance.insufficient' })
    const [still] = await db.select().from(events).where(eq(events.id, draft.id))
    expect(still).toMatchObject({ status: 'draft', title: 'Draft' })
    expect(await balanceOf()).toBe(0)
    expect((await entriesOf()).filter((e) => e.reason === 'spend')).toHaveLength(0)
  })

  it('refunds on cancel when the event has no active bookings, once (D-09)', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, eventInput())
    expect(await balanceOf()).toBe(4)
    await eventService.cancel({ userId: ownerId }, ev.id)
    expect(await balanceOf()).toBe(5)
    const refund = (await entriesOf()).at(-1)!
    expect(refund).toMatchObject({
      delta: 1,
      reason: 'refund',
      eventId: ev.id,
      actorKind: 'user',
      createdByUserId: ownerId,
    })
    // повторная отмена идемпотентна
    await eventService.cancel({ userId: ownerId }, ev.id)
    expect(await balanceOf()).toBe(5)
    expect((await entriesOf()).filter((e) => e.reason === 'refund')).toHaveLength(1)
  })

  it('any non-cancelled booking, including the waitlist, blocks the refund (D-13)', async () => {
    const player = await newUser('Player')
    const other = await newUser('Other')
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: player })
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: other })

    // подтверждённая запись
    const confirmed = await eventService.create({ userId: ownerId }, orgId, eventInput('Игра A'))
    await bookingService.book({ userId: player }, orgId, confirmed.id, { method: 'free' })
    await eventService.cancel({ userId: ownerId }, confirmed.id)

    // только лист ожидания
    const full = await eventService.create(
      { userId: ownerId },
      orgId,
      eventInput('Игра B', { capacity: 1 }),
    )
    const first = await bookingService.book({ userId: player }, orgId, full.id, {
      method: 'free',
    })
    const queued = await bookingService.book({ userId: other }, orgId, full.id, { method: 'free' })
    expect(queued.status).toBe('waitlisted')
    await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, first.id))
    await eventService.cancel({ userId: ownerId }, full.id)

    // только отменённые записи не блокируют возврат
    const cancelledOnly = await eventService.create(
      { userId: ownerId },
      orgId,
      eventInput('Игра C'),
    )
    const b = await bookingService.book({ userId: player }, orgId, cancelledOnly.id, {
      method: 'free',
    })
    await bookingService.cancel({ userId: player }, b.id)
    await eventService.cancel({ userId: ownerId }, cancelledOnly.id)

    const refunds = (await entriesOf()).filter((e) => e.reason === 'refund')
    expect(refunds.map((r) => r.eventId)).toEqual([cancelledOnly.id])
    expect(await balanceOf()).toBe(3)
    expect((await drift()).length).toBe(0)
  })

  it('never mints: no refund for drafts or events published without a spend', async () => {
    const draft = await eventService.create(
      { userId: ownerId },
      orgId,
      eventInput('Draft', { status: 'draft' }),
    )
    await eventService.cancel({ userId: ownerId }, draft.id)

    process.env.EVENT_BALANCE_ENFORCED = 'false'
    const unspent = await eventService.create({ userId: ownerId }, orgId, eventInput('Free'))
    expect(await balanceOf()).toBe(5)
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await eventService.cancel({ userId: ownerId }, unspent.id)

    expect(await balanceOf()).toBe(5)
    expect((await entriesOf()).map((e) => e.reason)).toEqual(['demo_grant'])
  })

  it('spending is off unless EVENT_BALANCE_ENFORCED is exactly "true"', async () => {
    for (const value of [undefined, '', 'TRUE', '1', 'false']) {
      if (value === undefined) delete process.env.EVENT_BALANCE_ENFORCED
      else process.env.EVENT_BALANCE_ENFORCED = value
      await eventService.create({ userId: ownerId }, orgId, eventInput(`Off ${value}`))
    }
    expect(await balanceOf()).toBe(5)
    expect((await entriesOf()).filter((e) => e.reason === 'spend')).toHaveLength(0)
  })

  it('purchase request: owner snapshot of a package, pending, audited, balance unchanged', async () => {
    const pkg = EVENT_BALANCE_PACKAGES[1]!
    const request = await eventBalanceService.createPurchaseRequest({ userId: ownerId }, orgId, {
      packageCode: pkg.code,
    })
    expect(request).toMatchObject({
      organizationId: orgId,
      requestedByUserId: ownerId,
      units: pkg.units,
      amount: pkg.amount,
      currency: pkg.currency,
      status: 'pending',
      decidedAt: null,
    })
    expect(await balanceOf()).toBe(5)
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'event_balance.purchase_requested'))
    expect(audit).toMatchObject({
      organizationId: orgId,
      userId: ownerId,
      entityType: 'event_balance_purchase_request',
      entityId: request.id,
    })

    const view = await eventBalanceService.get({ userId: ownerId }, orgId)
    expect(view.pendingRequests).toEqual([
      expect.objectContaining({ id: request.id, units: pkg.units, amount: pkg.amount }),
    ])

    await expect(
      eventBalanceService.createPurchaseRequest({ userId: ownerId }, orgId, {
        packageCode: 'nope' as never,
      }),
    ).rejects.toMatchObject({ name: 'ZodError' })
    await expect(
      eventBalanceService.createPurchaseRequest({ userId: ownerId }, orgId, {
        packageCode: pkg.code,
        units: 1000,
      } as never),
    ).rejects.toMatchObject({ name: 'ZodError' })
    expect(await db.select().from(eventBalancePurchaseRequests)).toHaveLength(1)
  })

  it('history: newest first with reason, author and event; keyset pages without overlap', async () => {
    const organizer = await newUser('Org Anna')
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizer, role: 'organizer' },
    )
    const e1 = await eventService.create({ userId: organizer }, orgId, eventInput('Первая'))
    await eventService.create({ userId: ownerId }, orgId, eventInput('Вторая'))
    await eventService.cancel({ userId: ownerId }, e1.id)

    // чужая группа не попадает в историю
    const foreignOwner = await newUser('Foreign')
    await organizationService.create({ userId: foreignOwner }, { name: 'Foreign' })

    const all = await eventBalanceService.listEntries({ userId: ownerId }, orgId, {})
    expect(all.entries.map((e) => e.reason)).toEqual(['refund', 'spend', 'spend', 'demo_grant'])
    expect(all.nextCursor).toBeNull()
    expect(all.entries[2]).toMatchObject({
      delta: -1,
      balanceAfter: 4,
      actorKind: 'user',
      author: { id: organizer, name: 'Org Anna' },
      event: { id: e1.id, title: 'Первая' },
    })
    expect(all.entries[3]).toMatchObject({
      actorKind: 'system',
      author: null,
      source: 'org-create',
    })
    expect(JSON.stringify(all)).not.toContain('@t.by')

    const page1 = await eventBalanceService.listEntries({ userId: ownerId }, orgId, { limit: '2' })
    expect(page1.entries).toHaveLength(2)
    expect(page1.nextCursor).toEqual(expect.any(String))
    const page2 = await eventBalanceService.listEntries({ userId: ownerId }, orgId, {
      limit: '2',
      cursor: page1.nextCursor!,
    })
    expect([...page1.entries, ...page2.entries].map((e) => e.id)).toEqual(
      all.entries.map((e) => e.id),
    )
    expect(page2.nextCursor).toBeNull()

    for (const bad of [{ limit: '0' }, { limit: '101' }, { cursor: 'not-a-cursor' }]) {
      await expect(
        eventBalanceService.listEntries({ userId: ownerId }, orgId, bad),
      ).rejects.toMatchObject({ name: 'ZodError' })
    }
  })

  it('a group without a projection row (old runtime window) gets it lazily at the first operation', async () => {
    await db.delete(eventBalanceEntries).where(eq(eventBalanceEntries.organizationId, orgId))
    await db
      .delete(organizationEventBalances)
      .where(eq(organizationEventBalances.organizationId, orgId))
    expect((await eventBalanceService.get({ userId: ownerId }, orgId)).balance).toBe(0)
    await expect(
      eventService.create({ userId: ownerId }, orgId, eventInput()),
    ).rejects.toMatchObject({ code: 'event_balance.insufficient' })
    expect(await balanceOf()).toBeNull() // откат транзакции убрал и ленивую строку
  })
})
