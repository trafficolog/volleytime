import {
  auditLog,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  eventBalancePackages,
  eventBalancePurchaseRequests,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventBalanceService } from '../event-balance/service'
import { organizationService } from '../organizations/service'
import { ForbiddenError } from '../permissions/errors'

import { PlatformPurchaseRequestError } from './errors'
import { buildPurchaseRequestsCsv, platformPurchaseRequestsService } from './purchase-requests'

/** Task 22.2.3: реестр заявок на покупку баланса, решения root и выгрузка (R-04, D-07). */
describe('platformPurchaseRequestsService (integration)', { timeout: 60_000 }, () => {
  let rootId: number
  let plainId: number
  let orgId: number
  let otherOrgId: number
  const svc = platformPurchaseRequestsService
  const root = () => ({ userId: rootId })
  const balance = async (org = orgId) =>
    (await eventBalanceService.get({ userId: plainId }, org)).balance
  const purchaseEntries = () =>
    db.select().from(eventBalanceEntries).where(eq(eventBalanceEntries.reason, 'purchase'))
  const audits = (action: string) => db.$count(auditLog, eq(auditLog.action, action))
  const makeRequest = async (
    over: Partial<typeof eventBalancePurchaseRequests.$inferInsert> = {},
  ) =>
    (
      await db
        .insert(eventBalancePurchaseRequests)
        .values({
          organizationId: orgId,
          requestedByUserId: plainId,
          units: 50,
          amount: 4500,
          currency: 'BYN',
          ...over,
        })
        .returning()
    )[0]!

  beforeEach(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(eventBalancePackages).where(sql`code LIKE 'pr_test_%'`)
    await db.delete(users)
    ;[rootId, plainId] = (
      await db
        .insert(users)
        .values([
          { name: 'Root', email: 'root@vt.test', isRootAdmin: true },
          { name: 'Plain', email: 'plain@vt.test' },
        ])
        .returning()
    ).map((u) => u.id) as [number, number]
    orgId = (await organizationService.create({ userId: plainId }, { name: 'Покупатель' })).id
    otherOrgId = (await organizationService.create({ userId: plainId }, { name: 'Другая' })).id
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(eventBalancePackages).where(sql`code LIKE 'pr_test_%'`)
    await db.delete(users)
    await closeDb()
  })

  it('refuses a non-root user on every method and changes nothing', async () => {
    const req = await makeRequest()
    const plain = { userId: plainId }
    await expect(svc.list(plain)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(svc.summary(plain)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(svc.exportRows(plain)).rejects.toBeInstanceOf(ForbiddenError)
    await expect(svc.approve(plain, { requestId: req.id })).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      svc.reject(plain, { requestId: req.id, reason: 'Нет оплаты' }),
    ).rejects.toBeInstanceOf(ForbiddenError)
    const [after] = await db
      .select()
      .from(eventBalancePurchaseRequests)
      .where(eq(eventBalancePurchaseRequests.id, req.id))
    expect(after!.status).toBe('pending')
    expect(await purchaseEntries()).toEqual([])
  })

  it('approve credits the request snapshot (not the current package price) with audit by root', async () => {
    const [pkg] = await db
      .insert(eventBalancePackages)
      .values({ code: 'pr_test_777', units: 777, amount: 3000, currency: 'BYN', visible: true })
      .returning()
    const req = await eventBalanceService.createPurchaseRequest({ userId: plainId }, orgId, {
      packageCode: pkg!.code,
    })
    // каталог меняется после заявки: подтверждение берёт снимок заявки
    await db
      .update(eventBalancePackages)
      .set({ amount: 9900 })
      .where(eq(eventBalancePackages.id, pkg!.id))
    const before = await balance()
    const result = await svc.approve(root(), { requestId: req.id, comment: 'Оплата получена' })
    expect(result.request).toMatchObject({
      id: req.id,
      status: 'approved',
      units: 777,
      amount: 3000,
      decidedBy: { id: rootId, name: 'Root' },
      decisionComment: 'Оплата получена',
    })
    expect(result.balanceAfter).toBe(before + 777)
    expect(await balance()).toBe(before + 777)
    const entries = await purchaseEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      delta: 777,
      purchaseRequestId: req.id,
      createdByUserId: rootId,
    })
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'event_balance.purchase_approved'))
    expect(audit).toMatchObject({ userId: rootId, organizationId: orgId, entityId: req.id })
    expect(audit!.newValue).toMatchObject({ amount: 3000, units: 777, source: 'root-admin' })
  })

  it('reject requires a reason, keeps the balance and writes the audit', async () => {
    const req = await makeRequest()
    const before = await balance()
    await expect(svc.reject(root(), { requestId: req.id, reason: '  ' })).rejects.toThrow()
    const result = await svc.reject(root(), { requestId: req.id, reason: 'Оплата не поступила' })
    expect(result.request).toMatchObject({
      status: 'rejected',
      decisionComment: 'Оплата не поступила',
      decidedBy: { id: rootId, name: 'Root' },
    })
    expect(result.balanceAfter).toBeNull()
    expect(await balance()).toBe(before)
    expect(await purchaseEntries()).toEqual([])
    expect(await audits('event_balance.purchase_rejected')).toBe(1)
  })

  it('a decided request cannot be decided again: 409 not_pending, no second credit', async () => {
    const req = await makeRequest({ units: 10 })
    await svc.approve(root(), { requestId: req.id })
    await expect(svc.approve(root(), { requestId: req.id })).rejects.toMatchObject({
      code: 'purchase_request.not_pending',
    })
    await expect(svc.reject(root(), { requestId: req.id, reason: 'Поздно' })).rejects.toMatchObject(
      { code: 'purchase_request.not_pending' },
    )
    expect(await purchaseEntries()).toHaveLength(1)
    await expect(svc.approve(root(), { requestId: 2_000_000_000 })).rejects.toMatchObject({
      code: 'purchase_request.not_found',
    })
    await expect(svc.approve(root(), { requestId: 2_000_000_000 })).rejects.toBeInstanceOf(
      PlatformPurchaseRequestError,
    )
  })

  it('parallel approve/reject of one request: exactly one wins, credited at most once', async () => {
    const req = await makeRequest({ units: 7 })
    const before = await balance()
    const results = await Promise.allSettled([
      ...Array.from({ length: 4 }, () => svc.approve(root(), { requestId: req.id })),
      ...Array.from({ length: 4 }, () =>
        svc.reject(root(), { requestId: req.id, reason: 'Гонка' }),
      ),
    ])
    const won = results.filter((r) => r.status === 'fulfilled')
    expect(won).toHaveLength(1)
    for (const r of results)
      if (r.status === 'rejected')
        expect(r.reason).toMatchObject({ code: 'purchase_request.not_pending' })
    const [after] = await db
      .select()
      .from(eventBalancePurchaseRequests)
      .where(eq(eventBalancePurchaseRequests.id, req.id))
    const entries = await purchaseEntries()
    if (after!.status === 'approved') {
      expect(entries).toHaveLength(1)
      expect(await balance()).toBe(before + 7)
    } else {
      expect(after!.status).toBe('rejected')
      expect(entries).toHaveLength(0)
      expect(await balance()).toBe(before)
    }
    expect(
      (await audits('event_balance.purchase_approved')) +
        (await audits('event_balance.purchase_rejected')),
    ).toBe(1)
  })

  it('parallel double approve credits once', async () => {
    const req = await makeRequest({ units: 12 })
    const before = await balance()
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => svc.approve(root(), { requestId: req.id })),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await purchaseEntries()).toHaveLength(1)
    expect(await balance()).toBe(before + 12)
  })

  it('does not credit a deleted organization (D-15)', async () => {
    const req = await makeRequest()
    await db
      .update(organizations)
      .set({ deletedAt: sql`now()`, restoreUntil: sql`now() + interval '30 days'` })
      .where(eq(organizations.id, orgId))
    await expect(svc.approve(root(), { requestId: req.id })).rejects.toMatchObject({
      code: 'platform.purchase_org_deleted',
    })
    expect(await purchaseEntries()).toEqual([])
  })

  it('lists with status, organization and period filters and keyset paging', async () => {
    const a = await makeRequest({ units: 10 })
    const b = await makeRequest({ units: 20, organizationId: otherOrgId })
    const c = await makeRequest({ units: 30 })
    await svc.approve(root(), { requestId: a.id })
    const all = await svc.list(root(), { limit: 2 })
    expect(all.items.map((r) => r.id)).toEqual([c.id, b.id])
    expect(all.nextCursor).toBe(b.id)
    const rest = await svc.list(root(), { limit: 2, cursor: all.nextCursor! })
    expect(rest.items.map((r) => r.id)).toEqual([a.id])
    expect(rest.nextCursor).toBeNull()
    expect((await svc.list(root(), { status: 'pending' })).items.map((r) => r.id)).toEqual([
      c.id,
      b.id,
    ])
    expect((await svc.list(root(), { organizationId: otherOrgId })).items.map((r) => r.id)).toEqual(
      [b.id],
    )
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect((await svc.list(root(), { from: future })).items).toEqual([])
    const row = (await svc.list(root(), { status: 'approved' })).items[0]!
    expect(row.requestedBy).toEqual({ id: plainId, name: 'Plain' })
    expect(JSON.stringify(row)).not.toContain('plain@vt.test')
    await expect(svc.list(root(), { status: 'paid' as never })).rejects.toThrow()
    await expect(svc.list(root(), { from: 'not-a-date' })).rejects.toThrow()
  })

  it('summary: approved total for the period equals the ledger purchase credits to the minor unit', async () => {
    const a = await makeRequest({ units: 10, amount: 1001 })
    const b = await makeRequest({ units: 25, amount: 2299, organizationId: otherOrgId })
    const c = await makeRequest({ units: 5, amount: 555 })
    const d = await makeRequest({ units: 3, amount: 300 })
    await svc.approve(root(), { requestId: a.id })
    await svc.approve(root(), { requestId: b.id })
    await svc.reject(root(), { requestId: c.id, reason: 'Нет оплаты' })
    void d
    const s = await svc.summary(root(), {})
    expect(s.approved).toEqual([{ currency: 'BYN', amount: 3300, count: 2, units: 35 }])
    expect(s.pendingCount).toBe(1)
    expect(s.rejectedCount).toBe(1)
    expect(s.payingOrganizations).toBe(2)
    expect(s.ledger).toEqual({
      approvedUnits: 35,
      ledgerUnits: 35,
      ledgerEntries: 2,
      matches: true,
    })
    const ledgerSum = (await purchaseEntries()).reduce((n, e) => n + e.delta, 0)
    expect(ledgerSum).toBe(35)
    expect(s.byOrganization.map((o) => [o.organization.id, o.amount])).toEqual([
      [otherOrgId, 2299],
      [orgId, 1001],
    ])
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect((await svc.summary(root(), { from: future })).approved).toEqual([])
  })

  it('the organizer cabinet shows decisions: approved and rejected with the reason', async () => {
    const a = await makeRequest({ units: 10 })
    const r = await makeRequest({ units: 20 })
    const p = await makeRequest({ units: 30 })
    const other = await makeRequest({ units: 40, organizationId: otherOrgId })
    await svc.approve(root(), { requestId: a.id })
    await svc.reject(root(), { requestId: r.id, reason: 'Оплата не поступила' })
    await svc.approve(root(), { requestId: other.id })
    const view = await eventBalanceService.get({ userId: plainId }, orgId)
    expect(view.pendingRequests.map((x) => x.id)).toEqual([p.id])
    expect(view.recentDecisions.map((x) => [x.id, x.status, x.decisionComment]).sort()).toEqual(
      [
        [a.id, 'approved', null],
        [r.id, 'rejected', 'Оплата не поступила'],
      ].sort(),
    )
  })

  it("the organizer never sees root's internal comment of an approved request", async () => {
    const a = await makeRequest({ units: 10 })
    const r = await makeRequest({ units: 20 })
    await svc.approve(root(), { requestId: a.id, comment: 'внутренняя заметка root' })
    await svc.reject(root(), { requestId: r.id, reason: 'Оплата не поступила' })
    const view = await eventBalanceService.get({ userId: plainId }, orgId)
    expect(view.recentDecisions.find((x) => x.id === a.id)!.decisionComment).toBeNull()
    expect(view.recentDecisions.find((x) => x.id === r.id)!.decisionComment).toBe(
      'Оплата не поступила',
    )
    expect(JSON.stringify(view)).not.toContain('внутренняя заметка')
  })

  it("the organizer history hides root's approval comment and identity on purchase entries", async () => {
    const a = await makeRequest({ units: 10 })
    await svc.approve(root(), { requestId: a.id, comment: 'внутренняя заметка root' })
    // журнал по-прежнему хранит комментарий для истории на стороне root
    expect((await purchaseEntries())[0]).toMatchObject({ comment: 'внутренняя заметка root' })

    const history = await eventBalanceService.listEntries({ userId: plainId }, orgId, {})
    const purchase = history.entries.find((e) => e.reason === 'purchase')!
    expect(purchase).toMatchObject({ delta: 10, comment: null, author: null })
    expect(JSON.stringify(history)).not.toContain('внутренняя заметка')
    expect(JSON.stringify(history)).not.toContain('Root')
  })

  it('summary flags a truncated per-organization list (more than 100 rows)', async () => {
    const small = await svc.summary(root(), {})
    expect(small.byOrganizationTruncated).toBe(false)
    const orgs = await db
      .insert(organizations)
      .values(
        Array.from({ length: 101 }, (_, i) => ({
          name: `Массовая ${i}`,
          slug: `mass-org-${i}`,
          ownerUserId: plainId,
        })),
      )
      .returning()
    await db.insert(eventBalancePurchaseRequests).values(
      orgs.map((o) => ({
        organizationId: o.id,
        requestedByUserId: plainId,
        units: 1,
        amount: 100,
        currency: 'BYN',
        status: 'approved' as const,
        decidedAt: new Date(),
        decidedByUserId: rootId,
      })),
    )
    const s = await svc.summary(root(), {})
    expect(s.byOrganization).toHaveLength(100)
    expect(s.byOrganizationTruncated).toBe(true)
  })

  it('exports approved payments of the period as a formula-safe CSV without contacts', async () => {
    await db
      .update(organizations)
      .set({ name: '=HYPERLINK("x")' })
      .where(eq(organizations.id, orgId))
    const a = await makeRequest({ units: 10, amount: 1050 })
    const p = await makeRequest({ units: 1, amount: 100 })
    await svc.approve(root(), { requestId: a.id, comment: '+375 оплата' })
    void p
    const rows = await svc.exportRows(root(), {})
    expect(rows.map((r) => r.id)).toEqual([a.id])
    const csv = buildPurchaseRequestsCsv(rows)
    const lines = csv.replace('\uFEFF', '').trimEnd().split('\r\n')
    expect(lines[0]).toBe(
      'Заявка;Создана;Подтверждена;Организация ID;Организация;Событий;Сумма;Сумма (коп.);Валюта;Подтвердил;Комментарий',
    )
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain(`;${orgId};"'=HYPERLINK(""x"")";10;10,50;1050;BYN;Root;'+375 оплата`)
    expect(csv).not.toContain('@vt.test')
  })
})
