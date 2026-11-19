import {
  auditLog,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  sessions,
  users,
} from '@volley-time/db'
import type {
  PlatformUserBlockResult,
  PlatformUserDetail,
  PlatformUsersPage,
} from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

/** Task 22.1.4: `/api/platform/users` — реестр, карточка и блокировка только для root. */
describe('/api/platform/users (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let otherRoot: number
  let plain: number
  let target: number
  let orgId: number

  async function clean() {
    await db.delete(auditLog)
    await db.delete(organizationMembers)
    await db.delete(organizations)
    await db.delete(sessions)
    await db.delete(users)
  }

  beforeAll(async () => {
    request = await createTestApi()
    await clean()
    const people = await db
      .insert(users)
      .values([
        { name: 'Root', isRootAdmin: true },
        { name: 'Root Two', isRootAdmin: true },
        { name: 'Plain', email: 'plain@vt.test' },
        {
          name: 'Target',
          email: 'target@vt.test',
          telegramUsername: 'target_tg',
          telegramUserId: 910_001n,
          phone: '+375290009999',
        },
      ])
      .returning()
    ;[root, otherRoot, plain, target] = people.map((p) => p.id) as [number, number, number, number]
    orgId = (
      await db
        .insert(organizations)
        .values({ name: 'Group One', slug: 'group-one', ownerUserId: plain })
        .returning()
    )[0]!.id
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: target, role: 'player', status: 'active' })
  })
  afterAll(async () => {
    await clean()
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user, on every route', async () => {
    const routes: [string, string][] = [
      ['GET', '/api/platform/users'],
      ['GET', `/api/platform/users/${target}`],
      ['POST', `/api/platform/users/${target}/block`],
      ['POST', `/api/platform/users/${target}/unblock`],
    ]
    for (const [method, url] of routes) {
      expect((await request(method, url)).status, `${method} ${url}`).toBe(401)
      const res = await request(method, url, { user: plain })
      expect(res.status, `${method} ${url}`).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
    const [row] = await db.select().from(users).where(eq(users.id, target))
    expect(row!.isActive).toBe(true)
    expect(await db.$count(auditLog)).toBe(0)
  })

  it('lists users without cache, without phone or numeric telegram id, and filters through the query', async () => {
    const res = await request('GET', '/api/platform/users', { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformUsersPage
    expect(body.counts.all).toBe(4)
    const row = body.items.find((u) => u.id === target)!
    expect(row).toMatchObject({
      name: 'Target',
      email: 'target@vt.test',
      telegramUsername: 'target_tg',
      telegramLinked: true,
      groups: 1,
      topRole: 'player',
      blocked: false,
    })
    for (const hidden of ['+375290009999', '910001', 'phone', 'telegramUserId']) {
      expect(JSON.stringify(res.body)).not.toContain(hidden)
    }

    const found = await request(
      'GET',
      '/api/platform/users?status=all&q=target_tg&page=1&pageSize=10',
      {
        user: root,
      },
    )
    expect((found.body as PlatformUsersPage).items.map((u) => u.id)).toEqual([target])
    const none = await request('GET', '/api/platform/users?status=blocked', { user: root })
    expect((none.body as PlatformUsersPage).items).toEqual([])
  })

  it('422 for a malformed list query', async () => {
    for (const q of ['status=nope', 'page=0', 'pageSize=101', 'q=' + 'x'.repeat(101)]) {
      const res = await request('GET', `/api/platform/users?${q}`, { user: root })
      expect(res.status, q).toBe(422)
    }
  })

  it('returns the card, 404 for a missing or malformed id', async () => {
    const res = await request('GET', `/api/platform/users/${target}`, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformUserDetail
    expect(body).toMatchObject({ id: target, memberships: [{ organizationName: 'Group One' }] })
    expect(JSON.stringify(res.body)).not.toContain('+375290009999')
    for (const id of ['999999', 'abc', '0', '-1']) {
      const missing = await request('GET', `/api/platform/users/${id}`, { user: root })
      expect(missing.status, id).toBe(404)
    }
  })

  it('blocks: 200 no-store, flag off, sessions closed, audit by root; repeat is 409', async () => {
    await db
      .insert(sessions)
      .values({ userId: target, token: 'http-tok-1', expiresAt: new Date(Date.now() + 60_000) })
    const res = await request('POST', `/api/platform/users/${target}/block`, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.body as PlatformUserBlockResult).toEqual({ id: target, blocked: true })

    const [row] = await db.select().from(users).where(eq(users.id, target))
    expect(row!.isActive).toBe(false)
    expect(await db.$count(sessions, eq(sessions.userId, target))).toBe(0)
    const trail = await db.select().from(auditLog).where(eq(auditLog.entityId, target))
    expect(trail.map((a) => [a.action, a.userId])).toEqual([['user.blocked', root]])

    const again = await request('POST', `/api/platform/users/${target}/block`, { user: root })
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({ data: { code: 'platform.user_already_blocked' } })
    expect(await db.$count(auditLog)).toBe(1)

    const list = await request('GET', '/api/platform/users?status=blocked', { user: root })
    expect((list.body as PlatformUsersPage).items.map((u) => u.id)).toEqual([target])
  })

  it('unblocks: 200, flag on, audit by root; repeat is 409', async () => {
    const res = await request('POST', `/api/platform/users/${target}/unblock`, { user: root })
    expect(res.status).toBe(200)
    expect(res.body as PlatformUserBlockResult).toEqual({ id: target, blocked: false })
    const [row] = await db.select().from(users).where(eq(users.id, target))
    expect(row!.isActive).toBe(true)
    const trail = await db.select().from(auditLog).where(eq(auditLog.entityId, target))
    expect(trail.map((a) => a.action).sort()).toEqual(['user.blocked', 'user.unblocked'])

    const again = await request('POST', `/api/platform/users/${target}/unblock`, { user: root })
    expect(again.status).toBe(409)
    expect(again.body).toMatchObject({ data: { code: 'platform.user_not_blocked' } })
  })

  it('422 when root blocks themselves or another root, 404 for a missing user; nothing changes', async () => {
    const before = await db.$count(auditLog)
    const self = await request('POST', `/api/platform/users/${root}/block`, { user: root })
    expect(self.status).toBe(422)
    expect(self.body).toMatchObject({ data: { code: 'platform.user_cannot_block_self' } })
    const peer = await request('POST', `/api/platform/users/${otherRoot}/block`, { user: root })
    expect(peer.status).toBe(422)
    expect(peer.body).toMatchObject({ data: { code: 'platform.user_cannot_block_root' } })
    for (const id of ['999999', 'abc', '0']) {
      for (const action of ['block', 'unblock']) {
        const res = await request('POST', `/api/platform/users/${id}/${action}`, { user: root })
        expect(res.status, `${id} ${action}`).toBe(404)
      }
    }
    const roots = await db.select().from(users).where(eq(users.isRootAdmin, true))
    expect(roots.every((r) => r.isActive)).toBe(true)
    expect(await db.$count(auditLog)).toBe(before)
  })

  it('exposes only list, card, block and unblock under /api/platform/users', async () => {
    const routes = (await listApiRoutes())
      .filter((r) => r.route.startsWith('/api/platform/users'))
      .map((r) => `${r.method} ${r.route}`)
      .sort()
    expect(routes).toEqual([
      'get /api/platform/users',
      'get /api/platform/users/:id',
      'post /api/platform/users/:id/block',
      'post /api/platform/users/:id/unblock',
    ])
  })
})
