import {
  auditLog,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  organizationEventBalances,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import type {
  PlatformOrganizationCreateResult,
  PlatformOrganizationDetail,
  PlatformOrganizationsPage,
} from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

/** Task 22.1.3: `/api/platform/organizations` — список, карточка и ручное создание только для root. */
describe('/api/platform/organizations (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let owner: number
  let orgId: number

  async function clean() {
    await db.delete(auditLog)
    await db.delete(eventBalanceEntries)
    await db.delete(organizationEventBalances)
    await db.delete(organizationMembers)
    await db.delete(organizations)
    await db.delete(users)
  }

  beforeAll(async () => {
    request = await createTestApi()
    await clean()
    const people = await db
      .insert(users)
      .values([
        { name: 'Root' },
        { name: 'Owner', email: 'owner@vt.test', telegramUsername: 'owner_tg' },
      ])
      .returning()
    root = people[0]!.id
    await grantPlatformRole(root)
    owner = people[1]!.id
    orgId = (
      await db
        .insert(organizations)
        .values({ name: 'Group One', slug: 'group-one', ownerUserId: owner })
        .returning()
    )[0]!.id
    await db.insert(auditLog).values({
      organizationId: orgId,
      userId: owner,
      action: 'ownership_transfer.started',
      entityType: 'ownership_transfer',
      entityId: 1,
      newValue: { token: 'tok-HTTP-SECRET' },
      ipAddress: '203.0.113.9',
    })
  })
  afterAll(async () => {
    await clean()
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user, on every route', async () => {
    const routes: [string, string, unknown?][] = [
      ['GET', '/api/platform/organizations'],
      ['GET', `/api/platform/organizations/${orgId}`],
      ['POST', '/api/platform/organizations', { name: 'Nope', owner: 'owner@vt.test' }],
    ]
    for (const [method, url, body] of routes) {
      expect((await request(method, url, { body })).status, `${method} ${url}`).toBe(401)
      const res = await request(method, url, { user: owner, body })
      expect(res.status, `${method} ${url}`).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
    expect(await db.$count(organizations)).toBe(1)
  })

  it('root lists groups without cache and filters through the query string', async () => {
    const res = await request('GET', '/api/platform/organizations', { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformOrganizationsPage
    expect(body.items.map((o) => o.slug)).toEqual(['group-one'])
    expect(body.counts.all).toBe(1)
    expect(body.items[0]!.owner).toMatchObject({ telegramUsername: 'owner_tg' })

    const none = await request(
      'GET',
      '/api/platform/organizations?status=blocked&lowBalance=1&inactive=false&sort=events&q=group&page=1&pageSize=10',
      { user: root },
    )
    expect(none.status).toBe(200)
    expect((none.body as PlatformOrganizationsPage).items).toEqual([])
  })

  it('422 for a malformed list query', async () => {
    for (const q of [
      'status=nope',
      'sort=name',
      'lowBalance=maybe',
      'page=0',
      'pageSize=101',
      'q=' + 'x'.repeat(101),
    ]) {
      const res = await request('GET', `/api/platform/organizations?${q}`, { user: root })
      expect(res.status, q).toBe(422)
    }
  })

  it('returns the card without secrets, 404 for a missing or malformed id', async () => {
    const res = await request('GET', `/api/platform/organizations/${orgId}`, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformOrganizationDetail
    expect(body).toMatchObject({ id: orgId, name: 'Group One', owner: { id: owner } })
    expect(body.recentAudit).toHaveLength(1)
    const json = JSON.stringify(res.body)
    for (const hidden of ['tok-HTTP-SECRET', '203.0.113.9']) expect(json).not.toContain(hidden)

    for (const id of ['999999', 'abc', '0', '-1']) {
      const missing = await request('GET', `/api/platform/organizations/${id}`, { user: root })
      expect(missing.status, id).toBe(404)
    }
  })

  it('creates a group by email: 201, membership, balance and audit by root; slug is taken afterwards', async () => {
    const res = await request('POST', '/api/platform/organizations', {
      user: root,
      body: { name: 'VolleyTime Гомель', slug: 'vt-gomel', city: 'Гомель', owner: 'owner@vt.test' },
    })
    expect(res.status).toBe(201)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const created = res.body as PlatformOrganizationCreateResult
    expect(created).toMatchObject({ slug: 'vt-gomel', name: 'VolleyTime Гомель' })

    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, created.id))
    expect(member).toMatchObject({ userId: owner, role: 'owner' })
    const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, created.id))
    expect(audit.find((a) => a.action === 'organization.created')).toMatchObject({ userId: root })

    const taken = await request('POST', '/api/platform/organizations', {
      user: root,
      body: { name: 'Again', slug: 'vt-gomel', owner: 'owner@vt.test' },
    })
    expect(taken.status).toBe(409)
    expect(taken.body).toMatchObject({ data: { code: 'organization.slug_taken' } })
  })

  it('creates a group by Telegram username; 404 for an unknown owner, 422 for bad input', async () => {
    const ok = await request('POST', '/api/platform/organizations', {
      user: root,
      body: { name: 'By Telegram', owner: '@Owner_TG' },
    })
    expect(ok.status).toBe(201)

    const unknown = await request('POST', '/api/platform/organizations', {
      user: root,
      body: { name: 'Ghost', owner: 'ghost@vt.test' },
    })
    expect(unknown.status).toBe(404)
    expect(unknown.body).toMatchObject({ data: { code: 'platform.owner_not_found' } })

    const before = await db.$count(organizations)
    for (const body of [
      {},
      { name: 'x', owner: 'owner@vt.test' },
      { name: 'Bad slug', slug: 'Bad Slug!', owner: 'owner@vt.test' },
      { name: 'No owner' },
    ]) {
      const res = await request('POST', '/api/platform/organizations', { user: root, body })
      expect(res.status, JSON.stringify(body)).toBe(422)
    }
    expect(await db.$count(organizations)).toBe(before)
  })

  it('exposes only list, card, create, the balance grant (22.2.2) and unlimited events (22.3.1) under /api/platform/organizations', async () => {
    const routes = (await listApiRoutes())
      .filter((r) => r.route.startsWith('/api/platform/organizations'))
      .map((r) => `${r.method} ${r.route}`)
      .sort()
    expect(routes).toEqual([
      'get /api/platform/organizations',
      'get /api/platform/organizations/:id',
      'post /api/platform/organizations',
      'post /api/platform/organizations/:id/event-balance-grants',
      'post /api/platform/organizations/:id/event-balance/unlimited/cancel',
      'put /api/platform/organizations/:id/event-balance/unlimited',
    ])
  })
})
