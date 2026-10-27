import {
  and,
  auditLog,
  closeDb,
  db,
  eq,
  inArray,
  ledgerEntries,
  organizations,
  payments,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { collectionService } from './service'

/**
 * Task 21.2.4: сборы — домен, доступ и касса. Деньги: подтверждённый взнос = ровно одна запись
 * кассы `contribution`; сумма подтверждённых взносов сбора = поступления кассы по нему; гонки
 * подтверждения, отклонения, повторного взноса и отмены сбора сериализуются строкой сбора.
 */
describe('collections (integration)', { timeout: 60_000 }, () => {
  let owner: number
  let player: number
  let orgId: number
  let otherOrg: number
  let otherPlayer: number

  const ctx = (userId: number) => ({ userId })
  const newUser = async (label: string) =>
    (
      await db
        .insert(users)
        .values({ email: `col-${label}-${Math.random()}@t.by`, name: label })
        .returning()
    )[0]!.id
  const addPlayer = async (org: number, ownerId: number) => {
    const id = await newUser('p')
    await memberService.add({ userId: ownerId }, { organizationId: org, userId: id })
    return id
  }
  const create = (extra: Record<string, unknown> = {}) =>
    collectionService.create(ctx(owner), orgId, {
      title: 'Новый комплект мячей',
      targetAmount: 25_000,
      ...extra,
    })
  const collectionIncome = async (collectionId: number) => {
    const [row] = await db.execute<{ income: number; entries: number; bad: number }>(sql`
      SELECT coalesce(sum(l.amount), 0)::int AS income, count(l.id)::int AS entries,
             count(l.id) FILTER (WHERE l.category <> 'contribution')::int AS bad
      FROM ledger_entries l JOIN payments p ON p.id = l.payment_id
      WHERE p.collection_id = ${collectionId} AND l.type = 'income'`)
    return row!
  }
  const confirmedSum = async (collectionId: number) => {
    const [row] = await db.execute<{ n: number }>(sql`
      SELECT coalesce(sum(amount), 0)::int AS n FROM payments
      WHERE collection_id = ${collectionId} AND status = 'succeeded'`)
    return row!.n
  }

  beforeEach(async () => {
    vi.stubEnv('COLLECTIONS_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser('owner')
    orgId = (await organizationService.create(ctx(owner), { name: 'Сборы А' })).id
    player = await addPlayer(orgId, owner)
    const otherOwner = await newUser('owner-b')
    otherOrg = (await organizationService.create(ctx(otherOwner), { name: 'Сборы Б' })).id
    otherPlayer = await addPlayer(otherOrg, otherOwner)
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('writes are gated by COLLECTIONS_ENABLED; reads and decisions stay available', async () => {
    const c = await create()
    await collectionService.contribute(ctx(player), orgId, c.id, { amount: 1500, method: 'cash' })
    vi.stubEnv('COLLECTIONS_ENABLED', 'false')
    await expect(create()).rejects.toMatchObject({ code: 'collection.disabled' })
    await expect(
      collectionService.contribute(ctx(player), orgId, c.id, { amount: 1500, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'collection.disabled' })
    const view = await collectionService.get(ctx(owner), orgId, c.id, { manager: true })
    expect(view.contributions).toHaveLength(1)
    await collectionService.confirmContribution(ctx(owner), orgId, c.id, view.contributions[0]!.id)
    expect(await confirmedSum(c.id)).toBe(1500)
  })

  it('creates, publishes, edits and closes a collection with audit; drafts are manager-only', async () => {
    const draft = await create({ status: 'draft', icon: 'trophy', description: 'Турнир' })
    expect(draft).toMatchObject({ status: 'draft', icon: 'trophy', currency: 'BYN' })
    // игрок не видит черновик ни в списке, ни по id
    const asPlayer = await collectionService.list(ctx(player), orgId, {}, { manager: false })
    expect(asPlayer.collections).toHaveLength(0)
    await expect(
      collectionService.get(ctx(player), orgId, draft.id, { manager: false }),
    ).rejects.toMatchObject({ code: 'collection.not_found' })
    await expect(
      collectionService.contribute(ctx(player), orgId, draft.id, { amount: 100, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'collection.not_found' })

    const active = await collectionService.update(ctx(owner), orgId, draft.id, {
      status: 'active',
      title: 'Аренда зала на турнир',
      targetAmount: null,
    })
    expect(active).toMatchObject({ status: 'active', title: 'Аренда зала на турнир' })
    expect(active.targetAmount).toBeNull()
    expect(
      (await collectionService.list(ctx(player), orgId, {}, { manager: false })).collections,
    ).toHaveLength(1)

    const done = await collectionService.complete(ctx(owner), orgId, draft.id)
    expect(done.status).toBe('completed')
    expect(done.closedAt).not.toBeNull()
    await expect(
      collectionService.update(ctx(owner), orgId, draft.id, { title: 'X' }),
    ).rejects.toMatchObject({ code: 'collection.not_active' })
    await expect(collectionService.complete(ctx(owner), orgId, draft.id)).rejects.toMatchObject({
      code: 'collection.not_active',
    })
    await expect(collectionService.cancel(ctx(owner), orgId, draft.id)).rejects.toMatchObject({
      code: 'collection.not_active',
    })

    const actions = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'collection'), eq(auditLog.entityId, draft.id)))
      .orderBy(auditLog.id)
    expect(actions.map((a) => a.action)).toEqual([
      'collection.created',
      'collection.updated',
      'collection.completed',
    ])
  })

  it('a pledge waits for confirmation; confirmation writes exactly one contribution income', async () => {
    const c = await create()
    const first = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 1500,
      method: 'cash',
    })
    expect(first.replaced).toBe(false)
    expect(first.contribution).toMatchObject({ status: 'pending', amount: 1500 })
    // повторный взнос до подтверждения меняет обещание, а не плодит строки
    const changed = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 2000,
      method: 'transfer',
    })
    expect(changed.replaced).toBe(true)
    expect(changed.contribution.id).toBe(first.contribution.id)
    expect(await db.select().from(payments).where(eq(payments.collectionId, c.id))).toHaveLength(1)
    expect(await collectionIncome(c.id)).toMatchObject({ income: 0, entries: 0 })

    await collectionService.confirmContribution(ctx(owner), orgId, c.id, first.contribution.id)
    const [entry] = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.paymentId, first.contribution.id))
    expect(entry).toMatchObject({
      type: 'income',
      category: 'contribution',
      amount: 2000,
      organizationId: orgId,
    })
    // после подтверждения можно внести ещё: новое обещание
    const second = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 500,
      method: 'cash',
    })
    expect(second.replaced).toBe(false)
    await collectionService.rejectContribution(ctx(owner), orgId, c.id, second.contribution.id)

    expect(await confirmedSum(c.id)).toBe(2000)
    expect(await collectionIncome(c.id)).toEqual({ income: 2000, entries: 1, bad: 0 })

    const view = await collectionService.get(ctx(player), orgId, c.id, { manager: false })
    expect(view.collection).toMatchObject({
      collected: 2000,
      pledged: 0,
      contributors: 1,
      my: { paid: 2000, pending: null },
    })
    // отклонённый взнос в списке не показывается
    expect(view.contributions.map((x) => x.status)).toEqual(['succeeded'])
    expect(JSON.stringify(view)).not.toMatch(/email|telegramUserId|phone/)
  })

  it('a contribution confirmed through the payments route is a contribution too', async () => {
    const c = await create()
    const { contribution } = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 700,
      method: 'cash',
    })
    const pending = await paymentService.listPending(ctx(owner), orgId)
    expect(pending.find((p) => p.id === contribution.id)?.collection).toEqual({
      id: c.id,
      title: c.title,
    })
    await paymentService.confirm(ctx(owner), contribution.id, { orgId })
    expect(await collectionIncome(c.id)).toEqual({ income: 700, entries: 1, bad: 0 })
  })

  it('does not reveal or accept collections and contributions of another group (IDOR)', async () => {
    const c = await create()
    const { contribution } = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 900,
      method: 'cash',
    })
    // игрок другой группы через путь своей группы: сбор чужой — 404, как несуществующий
    await expect(
      collectionService.get(ctx(otherPlayer), otherOrg, c.id, { manager: true }),
    ).rejects.toMatchObject({ code: 'collection.not_found' })
    await expect(
      collectionService.contribute(ctx(otherPlayer), otherOrg, c.id, {
        amount: 100,
        method: 'cash',
      }),
    ).rejects.toMatchObject({ code: 'collection.not_found' })
    expect(
      (await collectionService.list(ctx(otherPlayer), otherOrg, {}, { manager: true })).collections,
    ).toHaveLength(0)
    await expect(
      collectionService.confirmContribution(ctx(otherPlayer), otherOrg, c.id, contribution.id),
    ).rejects.toMatchObject({ code: 'collection.not_found' })
    // чужой платёж своего сбора (взнос другого сбора) — 404, ничего не меняется
    const own = await create({ title: 'Другой сбор' })
    await expect(
      collectionService.confirmContribution(ctx(owner), orgId, own.id, contribution.id),
    ).rejects.toMatchObject({ code: 'payment.not_found' })
    await expect(
      collectionService.rejectContribution(ctx(owner), orgId, own.id, contribution.id),
    ).rejects.toMatchObject({ code: 'payment.not_found' })
    const [row] = await db.select().from(payments).where(eq(payments.id, contribution.id))
    expect(row!.status).toBe('pending')
  })

  it('cancelling a collection rejects pending pledges and keeps confirmed money', async () => {
    const c = await create()
    const paid = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 1000,
      method: 'cash',
    })
    await collectionService.confirmContribution(ctx(owner), orgId, c.id, paid.contribution.id)
    const p2 = await addPlayer(orgId, owner)
    const pledge = await collectionService.contribute(ctx(p2), orgId, c.id, {
      amount: 300,
      method: 'cash',
    })
    const cancelled = await collectionService.cancel(ctx(owner), orgId, c.id)
    expect(cancelled.status).toBe('cancelled')
    const [row] = await db.select().from(payments).where(eq(payments.id, pledge.contribution.id))
    expect(row!.status).toBe('cancelled')
    await expect(
      collectionService.confirmContribution(ctx(owner), orgId, c.id, pledge.contribution.id),
    ).rejects.toMatchObject({ code: 'payment.not_pending' })
    await expect(
      collectionService.contribute(ctx(player), orgId, c.id, { amount: 100, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'collection.not_active' })
    expect(await confirmedSum(c.id)).toBe(1000)
    expect(await collectionIncome(c.id)).toEqual({ income: 1000, entries: 1, bad: 0 })
  })

  it('a completed collection takes no new pledges but its pending pledges can be confirmed', async () => {
    const c = await create()
    const pledge = await collectionService.contribute(ctx(player), orgId, c.id, {
      amount: 400,
      method: 'transfer',
    })
    await collectionService.complete(ctx(owner), orgId, c.id)
    await expect(
      collectionService.contribute(ctx(player), orgId, c.id, { amount: 100, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'collection.not_active' })
    await collectionService.confirmContribution(ctx(owner), orgId, c.id, pledge.contribution.id)
    expect(await collectionIncome(c.id)).toEqual({ income: 400, entries: 1, bad: 0 })
  })

  describe('races', () => {
    it('10 parallel confirmations of one pledge → one success and one income (3 runs)', async () => {
      for (let run = 0; run < 3; run++) {
        const c = await create({ title: `Гонка ${run}` })
        const { contribution } = await collectionService.contribute(ctx(player), orgId, c.id, {
          amount: 1500,
          method: 'cash',
        })
        const results = await Promise.allSettled(
          Array.from({ length: 10 }, (_, i) =>
            i % 2
              ? collectionService.confirmContribution(ctx(owner), orgId, c.id, contribution.id)
              : paymentService.confirm(ctx(owner), contribution.id, { orgId }),
          ),
        )
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
        expect(await collectionIncome(c.id)).toEqual({ income: 1500, entries: 1, bad: 0 })
      }
    })

    it('confirm vs reject of one pledge → exactly one outcome, cash matches', async () => {
      for (let run = 0; run < 3; run++) {
        const c = await create({ title: `Решение ${run}` })
        const { contribution } = await collectionService.contribute(ctx(player), orgId, c.id, {
          amount: 800,
          method: 'cash',
        })
        const results = await Promise.allSettled([
          collectionService.confirmContribution(ctx(owner), orgId, c.id, contribution.id),
          collectionService.rejectContribution(ctx(owner), orgId, c.id, contribution.id),
        ])
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
        expect((await collectionIncome(c.id)).income).toBe(await confirmedSum(c.id))
      }
    })

    it('10 parallel pledges of one player → one pending pledge', async () => {
      const c = await create()
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          collectionService.contribute(ctx(player), orgId, c.id, {
            amount: 100 * (i + 1),
            method: 'cash',
          }),
        ),
      )
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10)
      const rows = await db.select().from(payments).where(eq(payments.collectionId, c.id))
      expect(rows).toHaveLength(1)
      expect(rows[0]!.status).toBe('pending')
    })

    it('cancel vs confirm and cancel vs new pledges leave no pending money and a consistent cash', async () => {
      for (let run = 0; run < 3; run++) {
        const c = await create({ title: `Отмена ${run}` })
        const { contribution } = await collectionService.contribute(ctx(player), orgId, c.id, {
          amount: 600,
          method: 'cash',
        })
        const players = await Promise.all([0, 1, 2].map(() => addPlayer(orgId, owner)))
        await Promise.allSettled([
          collectionService.cancel(ctx(owner), orgId, c.id),
          collectionService.confirmContribution(ctx(owner), orgId, c.id, contribution.id),
          ...players.map((p) =>
            collectionService.contribute(ctx(p), orgId, c.id, { amount: 200, method: 'cash' }),
          ),
        ])
        const rows = await db
          .select()
          .from(payments)
          .where(
            and(eq(payments.collectionId, c.id), inArray(payments.status, ['pending'] as const)),
          )
        expect(rows).toHaveLength(0)
        const income = await collectionIncome(c.id)
        expect(income.income).toBe(await confirmedSum(c.id))
        expect(income.bad).toBe(0)
      }
    })
  })
})
