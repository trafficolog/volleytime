import { organizationService } from '@volley-time/core'
import { auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { resetEventBalancePackages, grantPlatformRole } from '@volley-time/db/test-utils'
import type {
  PlatformEventBalancePackage,
  PlatformEventBalancePackages,
  PlatformPackageHistoryPage,
} from '@volley-time/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

const BASE = '/api/platform/event-balance/packages'

/** Task 22.2.1: `/api/platform/event-balance/packages` — каталог пакетов только для root. */
describe('/api/platform/event-balance/packages (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let plain: number
  let orgId: number

  const list = async (query = '') =>
    (await request('GET', `${BASE}${query}`, { user: root })).body as PlatformEventBalancePackages
  const seeded = async (code: string) => (await list()).packages.find((p) => p.code === code)!

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await resetEventBalancePackages()
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
    orgId = (await organizationService.create({ userId: plain }, { name: 'Pkg HTTP' })).id
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await resetEventBalancePackages()
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user, on every route', async () => {
    const pkg = await db.query.eventBalancePackages.findFirst()
    const routes: [string, string, unknown?][] = [
      ['GET', BASE],
      ['POST', BASE, { units: 5, amount: 1 }],
      ['GET', `${BASE}/history`],
      ['PATCH', `${BASE}/${pkg!.id}`, { version: 1, amount: 1 }],
      ['POST', `${BASE}/${pkg!.id}/duplicate`, { units: 7 }],
      ['POST', `${BASE}/${pkg!.id}/archive`, { version: 1 }],
    ]
    for (const [method, url, body] of routes) {
      expect((await request(method, url, { body })).status, `${method} ${url}`).toBe(401)
      const res = await request(method, url, { user: plain, body })
      expect(res.status, `${method} ${url}`).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
    expect(await db.$count(auditLog, eq(auditLog.entityType, 'event_balance_package'))).toBe(0)
    expect((await db.query.eventBalancePackages.findMany()).length).toBe(3)
  })

  it('lists the catalog without cache with price per event, sales and unattributed', async () => {
    const res = await request('GET', BASE, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformEventBalancePackages
    expect(body.packages.map((p) => [p.code, p.pricePerEvent, p.version])).toEqual([
      ['events_10', 500, 1],
      ['events_30', 400, 1],
      ['events_100', 350, 1],
    ])
    expect(body.unattributed).toEqual([])
    const archived = await request('GET', `${BASE}?archived=true`, { user: root })
    expect((archived.body as PlatformEventBalancePackages).packages).toEqual([])
    expect((await request('GET', `${BASE}?archived=maybe`, { user: root })).status).toBe(422)
  })

  it('creates a draft (201) with a generated code and records the audit trail by root', async () => {
    const res = await request('POST', BASE, { user: root, body: { units: 50, amount: 17000 } })
    expect(res.status).toBe(201)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.body).toMatchObject({ code: 'events_50', visible: false, version: 1 })
    const trail = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityType, 'event_balance_package'))
    expect(trail.map((a) => [a.action, a.userId, a.organizationId])).toEqual([
      ['event_balance_package.created', root, null],
    ])
  })

  it('422 for a malformed body, 409 units_taken for a taken quantity', async () => {
    for (const body of [
      {},
      { units: 0, amount: 1 },
      { units: 5, amount: -1 },
      { units: 5, amount: 1, currency: 'USD' },
      { units: 5, amount: 1, code: 'events_5' },
    ]) {
      const res = await request('POST', BASE, { user: root, body })
      expect(res.status, JSON.stringify(body)).toBe(422)
    }
    const taken = await request('POST', BASE, { user: root, body: { units: 10, amount: 1 } })
    expect(taken.status).toBe(409)
    expect(taken.body).toMatchObject({ data: { code: 'event_balance_package.units_taken' } })
    expect(await db.$count(auditLog, eq(auditLog.entityType, 'event_balance_package'))).toBe(0)
  })

  it('patches with the version: 200 and a new version, 409 stale for the old one', async () => {
    const pkg = await seeded('events_10')
    const ok = await request('PATCH', `${BASE}/${pkg.id}`, {
      user: root,
      body: { version: 1, amount: 5500, badge: 'discount', visible: false },
    })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ amount: 5500, badge: 'discount', visible: false, version: 2 })
    const stale = await request('PATCH', `${BASE}/${pkg.id}`, {
      user: root,
      body: { version: 1, amount: 6000 },
    })
    expect(stale.status).toBe(409)
    expect(stale.body).toMatchObject({ data: { code: 'event_balance_package.stale' } })
    expect((await seeded('events_10')).amount).toBe(5500)
  })

  it('422 for units, currency or code in the patch body; 404 for an unknown or malformed id', async () => {
    const pkg = await seeded('events_10')
    for (const extra of [{ units: 11 }, { currency: 'USD' }, { code: 'x' }]) {
      const res = await request('PATCH', `${BASE}/${pkg.id}`, {
        user: root,
        body: { version: 1, ...extra },
      })
      expect(res.status, JSON.stringify(extra)).toBe(422)
    }
    for (const id of ['999999', 'abc', '0']) {
      const res = await request('PATCH', `${BASE}/${id}`, { user: root, body: { version: 1 } })
      expect(res.status, id).toBe(404)
    }
    expect(await seeded('events_10')).toMatchObject({ units: 10, version: 1 })
  })

  it('duplicates into a draft (201); 409 units_taken without a free quantity; 404 for an unknown id', async () => {
    const src = await seeded('events_30')
    const copy = await request('POST', `${BASE}/${src.id}/duplicate`, {
      user: root,
      body: { units: 60, amount: 21000 },
    })
    expect(copy.status).toBe(201)
    expect(copy.body).toMatchObject({ code: 'events_60', visible: false, badge: 'popular' })
    const taken = await request('POST', `${BASE}/${src.id}/duplicate`, { user: root, body: {} })
    expect(taken.status).toBe(409)
    expect(taken.body).toMatchObject({ data: { code: 'event_balance_package.units_taken' } })
    const missing = await request('POST', `${BASE}/999999/duplicate`, {
      user: root,
      body: { units: 70 },
    })
    expect(missing.status).toBe(404)
    expect(missing.body).toMatchObject({ data: { code: 'event_balance_package.not_found' } })
  })

  it('archives (200), repeats idempotently, and the organizer can no longer buy the package', async () => {
    const pkg = await seeded('events_100')
    const res = await request('POST', `${BASE}/${pkg.id}/archive`, {
      user: root,
      body: { version: 1 },
    })
    expect(res.status).toBe(200)
    expect(res.body as PlatformEventBalancePackage).toMatchObject({ visible: false, version: 2 })
    const again = await request('POST', `${BASE}/${pkg.id}/archive`, {
      user: root,
      body: { version: 1 },
    })
    expect(again.status).toBe(200)
    expect(await db.$count(auditLog, eq(auditLog.action, 'event_balance_package.archived'))).toBe(1)

    const buy = await request(
      'POST',
      `/api/organizations/${orgId}/event-balance/purchase-requests`,
      {
        user: plain,
        body: { packageCode: 'events_100' },
      },
    )
    expect(buy.status).toBe(409)
    expect(buy.body).toMatchObject({ data: { code: 'event_balance.package_unavailable' } })
    const edit = await request('PATCH', `${BASE}/${pkg.id}`, {
      user: root,
      body: { version: 2, amount: 1 },
    })
    expect(edit.status).toBe(409)
    expect(edit.body).toMatchObject({ data: { code: 'event_balance_package.archived' } })
  })

  it('serves the history newest first with keyset paging and 422 for a bad cursor', async () => {
    const pkg = await seeded('events_10')
    await request('PATCH', `${BASE}/${pkg.id}`, { user: root, body: { version: 1, amount: 5100 } })
    await request('PATCH', `${BASE}/${pkg.id}`, {
      user: root,
      body: { version: 2, visible: false },
    })
    const first = await request('GET', `${BASE}/history?limit=1`, { user: root })
    expect(first.status).toBe(200)
    expect(first.headers.get('cache-control')).toBe('no-store')
    const page = first.body as PlatformPackageHistoryPage
    expect(page.entries.map((e) => e.action)).toEqual(['event_balance_package.visibility_changed'])
    expect(page.entries[0]).toMatchObject({ packageCode: 'events_10', actor: { id: root } })
    const next = await request('GET', `${BASE}/history?limit=5&cursor=${page.nextCursor}`, {
      user: root,
    })
    expect((next.body as PlatformPackageHistoryPage).entries.map((e) => e.action)).toEqual([
      'event_balance_package.updated',
    ])
    for (const q of ['cursor=abc', 'cursor=0', 'limit=0', 'limit=201']) {
      expect((await request('GET', `${BASE}/history?${q}`, { user: root })).status, q).toBe(422)
    }
  })

  it('exposes exactly the documented routes under /api/platform/event-balance', async () => {
    const routes = (await listApiRoutes())
      .filter((r) => r.route.startsWith('/api/platform/event-balance'))
      .map((r) => `${r.method} ${r.route}`)
      .sort()
    expect(routes).toEqual(
      [
        'get /api/platform/event-balance/grants',
        'get /api/platform/event-balance/packages',
        'get /api/platform/event-balance/packages/history',
        'patch /api/platform/event-balance/packages/:id',
        'post /api/platform/event-balance/packages',
        'post /api/platform/event-balance/packages/:id/archive',
        'post /api/platform/event-balance/packages/:id/duplicate',
        'get /api/platform/event-balance/purchase-requests',
        'get /api/platform/event-balance/purchase-requests/export',
        'get /api/platform/event-balance/purchase-requests/summary',
        'post /api/platform/event-balance/purchase-requests/:id/approve',
        'post /api/platform/event-balance/purchase-requests/:id/reject',
      ].sort(),
    )
  })
})
