import { organizationService } from '@volley-time/core'
import {
  auditLog,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  organizations,
  users,
} from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import type {
  PlatformPurchaseDecisionResult,
  PlatformPurchaseRequestsPage,
  PlatformPurchaseSummary,
} from '@volley-time/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

const BASE = '/api/platform/event-balance/purchase-requests'

/** Task 22.2.3: заявки организаций на покупку баланса — API только для root. */
describe('platform purchase requests (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let plain: number
  let orgId: number
  const purchases = () => db.$count(eventBalanceEntries, eq(eventBalanceEntries.reason, 'purchase'))
  const makeRequest = async (units = 10, amount = 1000) =>
    (
      await db
        .insert(eventBalancePurchaseRequests)
        .values({ organizationId: orgId, requestedByUserId: plain, units, amount, currency: 'BYN' })
        .returning()
    )[0]!

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    ;[root, plain] = (
      await db
        .insert(users)
        .values([
          { name: 'Root', email: 'root@vt.test' },
          { name: 'Plain', email: 'plain@vt.test' },
        ])
        .returning()
    ).map((u) => u.id) as [number, number]
    await grantPlatformRole(root)
    orgId = (await organizationService.create({ userId: plain }, { name: 'Заявки HTTP' })).id
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user, on every route', async () => {
    const req = await makeRequest()
    for (const [method, path, payload] of [
      ['GET', BASE, undefined],
      ['GET', `${BASE}/summary`, undefined],
      ['GET', `${BASE}/export`, undefined],
      ['POST', `${BASE}/${req.id}/approve`, {}],
      ['POST', `${BASE}/${req.id}/reject`, { reason: 'Нет оплаты' }],
    ] as const) {
      expect((await request(method, path, { body: payload })).status, path).toBe(401)
      const res = await request(method, path, { user: plain, body: payload })
      expect(res.status, path).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
    expect(await purchases()).toBe(0)
  })

  it('approves once (no-store), a repeat is 409 not_pending; the registry and summary reflect it', async () => {
    const req = await makeRequest(15, 1350)
    const first = await request('POST', `${BASE}/${req.id}/approve`, {
      user: root,
      body: { comment: 'Оплата получена' },
    })
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')
    const result = first.body as PlatformPurchaseDecisionResult
    expect(result.request).toMatchObject({ id: req.id, status: 'approved', units: 15 })
    const again = await request('POST', `${BASE}/${req.id}/approve`, { user: root, body: {} })
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({ data: { code: 'purchase_request.not_pending' } })
    expect(await purchases()).toBe(1)

    const list = await request('GET', `${BASE}?status=approved`, { user: root })
    expect(list.status).toBe(200)
    expect(list.headers.get('cache-control')).toBe('no-store')
    expect((list.body as PlatformPurchaseRequestsPage).items.map((r) => r.id)).toEqual([req.id])
    const summary = (await request('GET', `${BASE}/summary`, { user: root }))
      .body as PlatformPurchaseSummary
    expect(summary.approved).toEqual([{ currency: 'BYN', amount: 1350, count: 1, units: 15 }])
    expect(summary.ledger.matches).toBe(true)
  })

  it('rejects with a reason (422 without one); bad ids are 404, bad filters 422', async () => {
    const req = await makeRequest()
    expect(
      (await request('POST', `${BASE}/${req.id}/reject`, { user: root, body: {} })).status,
    ).toBe(422)
    const ok = await request('POST', `${BASE}/${req.id}/reject`, {
      user: root,
      body: { reason: 'Оплата не поступила' },
    })
    expect(ok.status).toBe(200)
    expect((ok.body as PlatformPurchaseDecisionResult).request.status).toBe('rejected')
    expect(await purchases()).toBe(0)
    for (const id of ['abc', '0', '99999999999'])
      expect(
        (await request('POST', `${BASE}/${id}/approve`, { user: root, body: {} })).status,
      ).toBe(404)
    const missing = await request('POST', `${BASE}/2000000000/approve`, { user: root, body: {} })
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ data: { code: 'purchase_request.not_found' } })
    for (const bad of ['status=paid', 'from=yesterday', 'limit=0', 'organizationId=x'])
      expect((await request('GET', `${BASE}?${bad}`, { user: root })).status, bad).toBe(422)
  })

  it("the organizer's history route hides root's approval note and name; grant entries keep author and reason (22.2.2)", async () => {
    const req = await makeRequest(15, 1350)
    const approved = await request('POST', `${BASE}/${req.id}/approve`, {
      user: root,
      body: { comment: 'внутренняя заметка root' },
    })
    expect(approved.status).toBe(200)
    const grant = await request(
      'POST',
      `/api/platform/organizations/${orgId}/event-balance-grants`,
      {
        user: root,
        body: {
          units: 3,
          category: 'promo',
          comment: 'Промо за фидбек',
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
        },
      },
    )
    expect(grant.status).toBe(201)

    const history = await request('GET', `/api/organizations/${orgId}/event-balance/entries`, {
      user: plain,
    })
    expect(history.status).toBe(200)
    const entries = (
      history.body as {
        entries: {
          reason: string
          comment: string | null
          author: { id: number; name: string | null } | null
        }[]
      }
    ).entries
    expect(entries.find((e) => e.reason === 'purchase')).toMatchObject({
      comment: null,
      author: null,
    })
    expect(entries.find((e) => e.reason === 'grant')).toMatchObject({
      comment: expect.stringContaining('Промо за фидбек'),
      author: { id: root, name: 'Root' },
    })
    const purchaseOnly = JSON.stringify(entries.filter((e) => e.reason === 'purchase'))
    expect(purchaseOnly).not.toContain('внутренняя заметка')
    expect(purchaseOnly).not.toContain('Root')
  })

  it('parallel approve requests over HTTP credit exactly once', async () => {
    const req = await makeRequest(9)
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request('POST', `${BASE}/${req.id}/approve`, { user: root, body: {} }),
      ),
    )
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(4)
    expect(await purchases()).toBe(1)
  })

  it('exports approved payments as CSV attachment, no-store', async () => {
    const req = await makeRequest(20, 2050)
    await request('POST', `${BASE}/${req.id}/approve`, { user: root, body: {} })
    const res = await request('GET', `${BASE}/export`, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toMatch(
      /attachment; filename="organization-payments-.*\.csv"/,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    const lines = res.text.replace('\uFEFF', '').trimEnd().split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain(';20;20,50;2050;BYN;Root;')
    expect(res.text).not.toContain('@vt.test')
  })
})
