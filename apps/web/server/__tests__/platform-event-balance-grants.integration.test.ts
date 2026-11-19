import { organizationService } from '@volley-time/core'
import {
  auditLog,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  organizations,
  users,
} from '@volley-time/db'
import type { PlatformGrantResult, PlatformGrantsPage } from '@volley-time/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

const GRANTS = '/api/platform/event-balance/grants'

/** Task 22.2.2: ручное начисление баланса событий — API только для root. */
describe('platform event balance grants (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let plain: number
  let orgId: number
  let seq = 0
  const key = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`
  const url = (id: number | string = orgId) =>
    `/api/platform/organizations/${id}/event-balance-grants`
  const body = (over: Record<string, unknown> = {}) => ({
    units: 10,
    category: 'promo',
    comment: 'Промо за фидбек',
    idempotencyKey: key(),
    ...over,
  })
  const grantEntries = () => db.$count(eventBalanceEntries, eq(eventBalanceEntries.reason, 'grant'))

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
          { name: 'Root', email: 'root@vt.test', isRootAdmin: true },
          { name: 'Plain', email: 'plain@vt.test' },
        ])
        .returning()
    ).map((u) => u.id) as [number, number]
    orgId = (await organizationService.create({ userId: plain }, { name: 'Grant HTTP' })).id
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user, on every route', async () => {
    for (const [method, path, payload] of [
      ['POST', url(), body()],
      ['GET', GRANTS, undefined],
    ] as const) {
      expect((await request(method, path, { body: payload })).status, path).toBe(401)
      const res = await request(method, path, { user: plain, body: payload })
      expect(res.status, path).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
    expect(await grantEntries()).toBe(0)
  })

  it('credits the organization (201, no-store) and replays a double submit (200) without a second credit', async () => {
    const payload = body({ units: 6 })
    const first = await request('POST', url(), { user: root, body: payload })
    expect(first.status).toBe(201)
    expect(first.headers.get('cache-control')).toBe('no-store')
    expect(first.body).toMatchObject({
      organization: { id: orgId, name: 'Grant HTTP' },
      delta: 6,
      category: 'promo',
      replayed: false,
    })
    const second = await request('POST', url(), { user: root, body: payload })
    expect(second.status).toBe(200)
    expect(second.body).toMatchObject({
      replayed: true,
      entryId: (first.body as { entryId: number }).entryId,
    })
    expect(await grantEntries()).toBe(1)
    // организатор видит баланс и запись в истории своей группы
    const balance = await request('GET', `/api/organizations/${orgId}/event-balance`, {
      user: plain,
    })
    expect(balance.body).toMatchObject({ eventBalance: { balance: 11 } })
    const history = await request('GET', `/api/organizations/${orgId}/event-balance/entries`, {
      user: plain,
    })
    expect(
      (history.body as { entries: { reason: string; delta: number }[] }).entries[0],
    ).toMatchObject({
      reason: 'grant',
      delta: 6,
    })
  })

  it('422 without a reason or with out-of-bounds units; organizationId in the body is ignored', async () => {
    for (const bad of [
      { comment: undefined },
      { comment: '  ' },
      { units: 0 },
      { units: 1001 },
      { units: 2.5 },
      { idempotencyKey: 'nope' },
    ]) {
      const res = await request('POST', url(), { user: root, body: body(bad) })
      expect(res.status, JSON.stringify(bad)).toBe(422)
    }
    expect((await request('POST', url(), { user: root, body: [] })).status).toBe(422)
    expect(await grantEntries()).toBe(0)
    const res = await request('POST', url(), {
      user: root,
      body: body({ organizationId: 999_999 }),
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ organization: { id: orgId } })
  })

  it('404 for a malformed or unknown organization id, 409 for a key reused with other data', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999', '999999']) {
      expect((await request('POST', url(id), { user: root, body: body() })).status, id).toBe(404)
    }
    const k = key()
    expect(
      (await request('POST', url(), { user: root, body: body({ idempotencyKey: k }) })).status,
    ).toBe(201)
    const conflict = await request('POST', url(), {
      user: root,
      body: body({ idempotencyKey: k, units: 3 }),
    })
    expect(conflict.status).toBe(409)
    expect(conflict.body).toMatchObject({ data: { code: 'platform.grant_idempotency_conflict' } })
    expect(await grantEntries()).toBe(1)
  })

  it('lists grants without cache, newest first, with keyset pagination', async () => {
    for (const units of [1, 2, 3]) {
      await request('POST', url(), { user: root, body: body({ units }) })
    }
    const res = await request('GET', `${GRANTS}?limit=2`, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const page = res.body as PlatformGrantsPage
    expect(page.entries.map((e) => e.delta)).toEqual([3, 2])
    const next = (
      await request('GET', `${GRANTS}?limit=2&cursor=${page.nextCursor}`, { user: root })
    ).body as PlatformGrantsPage
    expect(next.entries.map((e) => e.delta)).toEqual([1])
    expect(next.nextCursor).toBeNull()
    expect((await request('GET', `${GRANTS}?limit=0`, { user: root })).status).toBe(422)
  })

  it('does not return the replayed result type from a different shape', async () => {
    const res = await request('POST', url(), { user: root, body: body() })
    const r = res.body as PlatformGrantResult
    expect(Object.keys(r).sort()).toEqual(
      [
        'balanceAfter',
        'category',
        'comment',
        'createdAt',
        'delta',
        'entryId',
        'organization',
        'replayed',
      ].sort(),
    )
  })
})
