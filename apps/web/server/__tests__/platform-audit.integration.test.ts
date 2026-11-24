import { auditLog, closeDb, db, organizations, users } from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import type { PlatformAuditPage } from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

/** Task 22.1.2: `/api/platform/audit` — журнал только для root и только на чтение. */
describe('GET /api/platform/audit (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let owner: number
  let orgId: number

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([{ name: 'Root' }, { name: 'Owner' }])
      .returning()
    root = people[0]!.id
    await grantPlatformRole(root)
    owner = people[1]!.id
    orgId = (
      await db
        .insert(organizations)
        .values({ name: 'Audit group', slug: 'audit-http', ownerUserId: owner })
        .returning()
    )[0]!.id
    await db.insert(auditLog).values([
      {
        organizationId: orgId,
        userId: owner,
        action: 'ownership_transfer.started',
        entityType: 'ownership_transfer',
        entityId: 1,
        newValue: { toUserId: root, token: 'tok-HTTP-SECRET' },
        ipAddress: '203.0.113.9',
        userAgent: 'secret-agent',
      },
      { action: 'plan.created', entityType: 'plan', entityId: 2 },
    ])
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user', async () => {
    expect((await request('GET', '/api/platform/audit')).status).toBe(401)
    const res = await request('GET', '/api/platform/audit', { user: owner })
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
  })

  it('root reads the log without cache and without secrets, ip or user-agent', async () => {
    const res = await request('GET', '/api/platform/audit', { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformAuditPage
    expect(body.total).toBe(2)
    expect(body.entries.map((e) => e.action)).toEqual([
      'plan.created',
      'ownership_transfer.started',
    ])
    const json = JSON.stringify(res.body)
    for (const hidden of ['tok-HTTP-SECRET', '203.0.113.9', 'secret-agent']) {
      expect(json).not.toContain(hidden)
    }
  })

  it('applies filters from the query string', async () => {
    const res = await request(
      'GET',
      `/api/platform/audit?organizationId=${orgId}&category=organizations&period=all&limit=1&q=ownership`,
      { user: root },
    )
    expect(res.status).toBe(200)
    expect((res.body as PlatformAuditPage).entries).toHaveLength(1)
  })

  it('422 for a malformed query', async () => {
    for (const q of [
      'period=year',
      'category=nope',
      'limit=0',
      'cursor=abc',
      'organizationId=-1',
    ]) {
      const res = await request('GET', `/api/platform/audit?${q}`, { user: root })
      expect(res.status, q).toBe(422)
    }
  })

  it('has no way to change the log: only GET routes exist under /api/platform/audit', async () => {
    const routes = (await listApiRoutes()).filter((r) => r.route.startsWith('/api/platform/audit'))
    expect(routes.map((r) => r.method)).toEqual(['get'])
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const res = await request(method, '/api/platform/audit', { user: root, body: {} })
      expect(res.status, method).toBeGreaterThanOrEqual(400)
      expect(await db.$count(auditLog)).toBe(2)
    }
  })
})
