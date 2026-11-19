import { organizationService } from '@volley-time/core'
import { closeDb, db, eq, organizations, users } from '@volley-time/db'
import type { PlatformOverview } from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

/** Task 22.1.1: `/api/platform/overview` закрыт для не-root на уровне API (фаза 22, DoD 1). */
describe('GET /api/platform/overview (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let owner: number
  let player: number

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([{ name: 'Root', isRootAdmin: true }, { name: 'Owner' }, { name: 'Player' }])
      .returning()
    root = people[0]!.id
    owner = people[1]!.id
    player = people[2]!.id
    await organizationService.create({ userId: owner }, { name: 'Platform overview' })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('401 without a session', async () => {
    expect((await request('GET', '/api/platform/overview')).status).toBe(401)
  })

  it.each([
    ['organization owner', () => owner],
    ['player', () => player],
  ])('403 forbidden.root_only for %s', async (_label, who) => {
    const res = await request('GET', '/api/platform/overview', { user: who() })
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
  })

  it('root gets the overview', async () => {
    const res = await request('GET', '/api/platform/overview', { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformOverview
    expect(body.northStar.registered).toBe(1)
    expect(body.bookingsDaily).toHaveLength(14)
    expect(body.gate.map((m) => m.key)).toEqual([
      'activeOrganizers',
      'retention4weeks',
      'totalEvents',
      'totalBookings',
    ])
  })

  it('a revoked root is rejected on the next request', async () => {
    await db.update(users).set({ isRootAdmin: false }).where(eq(users.id, root))
    expect((await request('GET', '/api/platform/overview', { user: root })).status).toBe(403)
    await db.update(users).set({ isRootAdmin: true }).where(eq(users.id, root))
  })

  it('every /api/platform route rejects a non-root user', async () => {
    const routes = (await listApiRoutes()).filter((r) => r.route.startsWith('/api/platform'))
    expect(routes.length).toBeGreaterThan(0)
    for (const { method, route } of routes) {
      const isRead = method === 'get'
      const res = await request(method.toUpperCase() as 'GET', route, {
        user: owner,
        ...(isRead ? {} : { body: {} }),
      })
      expect(res.status, `${method} ${route}`).toBe(403)
    }
  })
})
