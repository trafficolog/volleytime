import { and, asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { closeDb, db } from './client'
import { appendEventBalanceEntry } from './event-balance'
import {
  approvePurchaseRequest,
  grantEventBalance,
  parseOperatorArgs,
  reconcileEventBalance,
  rejectPurchaseRequest,
} from './event-balance-operator'
import {
  auditLog,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  events,
  organizationEventBalances,
  organizations,
  users,
} from './schema'

let rootEmail: string
let ownerId: number
let orgId: number

async function newUser(email: string, isRootAdmin = false) {
  const [u] = await db.insert(users).values({ email, isRootAdmin }).returning()
  return u!.id
}

async function newOrg(slug: string) {
  const [o] = await db
    .insert(organizations)
    .values({
      slug: `${slug}-${Math.random().toString(36).slice(2, 7)}`,
      name: slug,
      ownerUserId: ownerId,
    })
    .returning()
  return o!.id
}

async function balanceOf(org = orgId) {
  const [row] = await db
    .select()
    .from(organizationEventBalances)
    .where(eq(organizationEventBalances.organizationId, org))
  return row?.balance ?? null
}

async function entriesOf(org = orgId) {
  return db
    .select()
    .from(eventBalanceEntries)
    .where(eq(eventBalanceEntries.organizationId, org))
    .orderBy(asc(eventBalanceEntries.id))
}

async function newRequest(units = 30, org = orgId) {
  const [r] = await db
    .insert(eventBalancePurchaseRequests)
    .values({
      organizationId: org,
      requestedByUserId: ownerId,
      units,
      amount: 12_000,
      currency: 'BYN',
    })
    .returning()
  return r!.id
}

/** Task 20.2.1: операторская команда root — начисление, исправление, решения по заявкам, сверка. */
describe('event balance operator command (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    rootEmail = `root-${Math.random()}@ops.test`
    await newUser(rootEmail, true)
    ownerId = await newUser(`owner-${Math.random()}@ops.test`)
    orgId = await newOrg('ops')
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('refuses operators that are not root admins', async () => {
    const plainEmail = `plain-${Math.random()}@ops.test`
    await newUser(plainEmail)
    for (const operator of [plainEmail, 'missing@ops.test']) {
      await expect(
        grantEventBalance(db, { organizationId: orgId, units: 5, operator, comment: 'x' }),
      ).rejects.toThrow(/root admin/)
    }
    expect(await entriesOf()).toHaveLength(0)
  })

  it('grant: positive units with a mandatory comment, authored by the operator and audited', async () => {
    await expect(
      grantEventBalance(db, {
        organizationId: orgId,
        units: 5,
        operator: rootEmail,
        comment: '  ',
      }),
    ).rejects.toThrow(/comment/)
    for (const units of [0, -3, 1.5]) {
      await expect(
        grantEventBalance(db, { organizationId: orgId, units, operator: rootEmail, comment: 'c' }),
      ).rejects.toThrow(/units/)
    }
    const entry = await grantEventBalance(db, {
      organizationId: orgId,
      units: 20,
      operator: rootEmail,
      comment: 'Бонус за пилот',
    })
    const [root] = await db.select().from(users).where(eq(users.email, rootEmail))
    expect(entry).toMatchObject({
      delta: 20,
      reason: 'grant',
      balanceAfter: 20,
      actorKind: 'user',
      createdByUserId: root!.id,
      comment: 'Бонус за пилот',
    })
    expect(await balanceOf()).toBe(20)
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'event_balance.granted'))
    expect(audit).toMatchObject({
      organizationId: orgId,
      userId: root!.id,
      entityType: 'event_balance_entry',
      entityId: entry.id,
    })
  })

  it('matches the operator email case-insensitively and caps one operation at 1000 events', async () => {
    const entry = await grantEventBalance(db, {
      organizationId: orgId,
      units: 1000,
      operator: rootEmail.toUpperCase(),
      comment: 'Крупный пакет',
    })
    expect(entry.balanceAfter).toBe(1000)
    for (const [units, correction] of [
      [1001, false],
      [-1001, true],
      [1001, true],
    ] as const) {
      await expect(
        grantEventBalance(db, {
          organizationId: orgId,
          units,
          operator: rootEmail,
          comment: 'too much',
          correction,
        }),
      ).rejects.toThrow(/1000/)
    }
    expect(await balanceOf()).toBe(1000)
  })

  it('appendEventBalanceEntry refuses to run outside a transaction', async () => {
    await expect(
      appendEventBalanceEntry(db, {
        organizationId: orgId,
        delta: 1,
        reason: 'grant',
        actor: { kind: 'system', source: 'test' },
        comment: 'x',
      }),
    ).rejects.toThrow(/transaction/)
    expect(await entriesOf()).toHaveLength(0)
  })

  it('correction: any sign, never below zero, unknown organization refused', async () => {
    await grantEventBalance(db, {
      organizationId: orgId,
      units: 3,
      operator: rootEmail,
      comment: 'g',
    })
    const fix = await grantEventBalance(db, {
      organizationId: orgId,
      units: -2,
      operator: rootEmail,
      comment: 'Ошибочное начисление',
      correction: true,
    })
    expect(fix).toMatchObject({ reason: 'correction', delta: -2, balanceAfter: 1 })
    await expect(
      grantEventBalance(db, {
        organizationId: orgId,
        units: -5,
        operator: rootEmail,
        comment: 'too much',
        correction: true,
      }),
    ).rejects.toMatchObject({ code: 'event_balance.insufficient' })
    expect(await balanceOf()).toBe(1)
    await expect(
      grantEventBalance(db, {
        organizationId: 2147483000,
        units: 1,
        operator: rootEmail,
        comment: 'x',
      }),
    ).rejects.toThrow(/organization/)
  })

  it('approve: pending → approved with one purchase entry; repeats and parallel approvals are refused', async () => {
    const requestId = await newRequest(30)
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        approvePurchaseRequest(db, { requestId, operator: rootEmail, comment: 'Оплата получена' }),
      ),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    for (const r of results.filter((x) => x.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({
        code: 'purchase_request.not_pending',
      })
    }
    const [request] = await db
      .select()
      .from(eventBalancePurchaseRequests)
      .where(eq(eventBalancePurchaseRequests.id, requestId))
    expect(request).toMatchObject({ status: 'approved', decisionComment: 'Оплата получена' })
    expect(request!.decidedAt).toBeInstanceOf(Date)
    const purchase = (await entriesOf()).filter((e) => e.reason === 'purchase')
    expect(purchase).toHaveLength(1)
    expect(purchase[0]).toMatchObject({
      delta: 30,
      purchaseRequestId: requestId,
      actorKind: 'user',
    })
    expect(await balanceOf()).toBe(30)
    expect(
      await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, 'event_balance.purchase_approved')),
    ).toHaveLength(1)
  })

  it('reject: comment required, no balance change, cannot be approved afterwards', async () => {
    const requestId = await newRequest(10)
    await expect(
      rejectPurchaseRequest(db, { requestId, operator: rootEmail, comment: '' }),
    ).rejects.toThrow(/comment/)
    await rejectPurchaseRequest(db, { requestId, operator: rootEmail, comment: 'Оплаты нет' })
    await expect(
      approvePurchaseRequest(db, { requestId, operator: rootEmail }),
    ).rejects.toMatchObject({ code: 'purchase_request.not_pending' })
    await expect(
      approvePurchaseRequest(db, { requestId: 2147483000, operator: rootEmail }),
    ).rejects.toMatchObject({ code: 'purchase_request.not_found' })
    expect(await entriesOf()).toHaveLength(0)
    expect(await balanceOf()).toBeNull()
  })

  it('reconcile: reports drift and unspent events, grants demo only to groups without a starting grant', async () => {
    // пилот (pilot_grant) — квоту не получает; группа старого runtime без баланса — получает 5
    const pilot = await newOrg('pilot')
    await db.transaction((tx) =>
      appendEventBalanceEntry(tx, {
        organizationId: pilot,
        delta: 48,
        reason: 'pilot_grant',
        actor: { kind: 'system', source: 'pilot_grant' },
        comment: 'D-12',
      }),
    )
    const [ev] = await db
      .insert(events)
      .values({
        organizationId: pilot,
        createdByUserId: ownerId,
        title: 'Без списания',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
        capacity: 10,
        status: 'published',
      })
      .returning()

    const dry = await reconcileEventBalance(db, { operator: rootEmail, apply: false })
    expect(dry.withoutStartingGrant).toEqual([orgId])
    expect(dry.unspentEvents.map((e) => e.eventId)).toEqual([ev!.id])
    expect(dry.drift).toEqual([])
    expect(dry.demoGranted).toEqual([])
    expect(await entriesOf()).toHaveLength(0)

    const applied = await reconcileEventBalance(db, { operator: rootEmail, apply: true })
    expect(applied.demoGranted).toEqual([orgId])
    const [demo] = await entriesOf()
    expect(demo).toMatchObject({ reason: 'demo_grant', delta: 5, actorKind: 'user' })
    expect(demo!.comment).toBeTruthy()
    expect(await balanceOf()).toBe(5)
    expect(await balanceOf(pilot)).toBe(48)

    // повторная сверка ничего не начисляет
    const again = await reconcileEventBalance(db, { operator: rootEmail, apply: true })
    expect(again.demoGranted).toEqual([])
    expect(
      await db
        .select()
        .from(eventBalanceEntries)
        .where(and(eq(eventBalanceEntries.reason, 'demo_grant'))),
    ).toHaveLength(1)

    // расхождение проекции с журналом показывается, а не «чинится» молча
    await db.execute(
      sql`UPDATE organization_event_balances SET balance = 7 WHERE organization_id = ${pilot}`,
    )
    const drifted = await reconcileEventBalance(db, { operator: rootEmail, apply: false })
    expect(drifted.drift).toEqual([{ organizationId: pilot, balance: 7, journal: 48 }])
  })

  describe('operator by user id (--operator-id)', () => {
    async function telegramUser(patch: Partial<typeof users.$inferInsert>) {
      const [u] = await db
        .insert(users)
        .values({
          name: 'tg',
          telegramUsername: `tg_${Math.random().toString(36).slice(2, 8)}`,
          ...patch,
        })
        .returning()
      return u!.id
    }

    it('accepts an active root admin by id; journal and audit_log carry that user id', async () => {
      const id = await telegramUser({ isRootAdmin: true })
      const entry = await grantEventBalance(db, {
        organizationId: orgId,
        units: 7,
        operatorId: id,
        comment: 'по id',
      })
      expect(entry.createdByUserId).toBe(id)
      const [log] = await db.select().from(auditLog).where(eq(auditLog.userId, id))
      expect(log).toMatchObject({ action: 'event_balance.granted', organizationId: orgId })
    })

    it('finds a root admin with no email by id and works for every command', async () => {
      const id = await telegramUser({ isRootAdmin: true })
      expect((await db.select().from(users).where(eq(users.id, id)))[0]!.email).toBeNull()
      await grantEventBalance(db, {
        organizationId: orgId,
        units: 10,
        operatorId: id,
        comment: 'g',
      })
      await grantEventBalance(db, {
        organizationId: orgId,
        units: -3,
        operatorId: id,
        comment: 'c',
        correction: true,
      })
      const approved = await approvePurchaseRequest(db, {
        requestId: await newRequest(5),
        operatorId: id,
      })
      expect(approved.request.decidedByUserId).toBe(id)
      const rejected = await rejectPurchaseRequest(db, {
        requestId: await newRequest(5),
        operatorId: id,
        comment: 'no',
      })
      expect(rejected.decidedByUserId).toBe(id)
      const report = await reconcileEventBalance(db, { operatorId: id, apply: true })
      expect(report.drift).toEqual([])
      expect((await entriesOf()).every((e) => e.createdByUserId === id)).toBe(true)
    })

    it('refuses an id that is not a root admin, inactive or missing (forbidden.root_only)', async () => {
      const plain = await telegramUser({})
      const inactive = await telegramUser({ isRootAdmin: true, isActive: false })
      for (const operatorId of [plain, inactive, 999_999_999]) {
        await expect(
          grantEventBalance(db, { organizationId: orgId, units: 5, operatorId, comment: 'x' }),
        ).rejects.toMatchObject({ code: 'forbidden.root_only' })
      }
      expect(await entriesOf()).toHaveLength(0)
    })

    it('refuses an invalid id, both options or neither at the library level', async () => {
      for (const operatorId of [0, -1, 1.5, Number.NaN]) {
        await expect(
          grantEventBalance(db, { organizationId: orgId, units: 5, operatorId, comment: 'x' }),
        ).rejects.toMatchObject({ code: 'operator.invalid_id' })
      }
      await expect(
        grantEventBalance(db, {
          organizationId: orgId,
          units: 5,
          operator: rootEmail,
          operatorId: 1,
          comment: 'x',
        }),
      ).rejects.toMatchObject({ code: 'operator.ambiguous' })
      await expect(
        grantEventBalance(db, { organizationId: orgId, units: 5, comment: 'x' }),
      ).rejects.toMatchObject({ code: 'operator.required' })
      expect(await entriesOf()).toHaveLength(0)
    })

    it('parses --operator-id for every command and rejects bad combinations', () => {
      expect(parseOperatorArgs(['reconcile', '--operator-id', '12'])).toEqual({
        command: 'reconcile',
        operatorId: 12,
      })
      expect(
        parseOperatorArgs([
          'grant',
          '--org',
          '1',
          '--units',
          '2',
          '--operator-id',
          '3',
          '--comment',
          'c',
        ]),
      ).toEqual({ command: 'grant', org: 1, units: 2, operatorId: 3, comment: 'c' })
      expect(parseOperatorArgs(['approve', '--request', '1', '--operator-id', '3'])).toMatchObject({
        operatorId: 3,
      })
      for (const bad of ['0', '-1', 'abc', '1.5']) {
        expect(() => parseOperatorArgs(['reconcile', '--operator-id', bad])).toThrow(
          /--operator-id/,
        )
      }
      expect(() =>
        parseOperatorArgs(['reconcile', '--operator', 'r@x', '--operator-id', '1']),
      ).toThrow(/exactly one/)
      expect(() => parseOperatorArgs(['reconcile'])).toThrow(/exactly one/)
      expect(() => parseOperatorArgs(['reconcile', '--apply'])).toThrow(/exactly one/)
    })
  })

  it('parses CLI arguments strictly', () => {
    expect(
      parseOperatorArgs([
        'grant',
        '--org',
        '3',
        '--units',
        '10',
        '--operator',
        'r@x',
        '--comment',
        'c d',
      ]),
    ).toEqual({ command: 'grant', org: 3, units: 10, operator: 'r@x', comment: 'c d' })
    expect(parseOperatorArgs(['reconcile', '--operator', 'r@x', '--apply'])).toEqual({
      command: 'reconcile',
      operator: 'r@x',
      apply: true,
    })
    expect(() => parseOperatorArgs(['drop-all'])).toThrow(/Usage/)
    expect(() => parseOperatorArgs(['grant', '--org', 'x', '--operator', 'r@x'])).toThrow(/--org/)
    expect(() => parseOperatorArgs(['grant', '--bogus', '1'])).toThrow(/--bogus/)
  })
})
