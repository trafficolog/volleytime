import { enqueueNotification, organizationService } from '@volley-time/core'
import { closeDb, db, eq, notifications, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 20.3.2: HTTP-контракт ленты уведомлений и тихих часов (permissions-v3, «Уведомления», self):
 * нет сессии — 401; чужая группа и чужие идентификаторы не расширяют выборку и не затрагиваются.
 */
describe('notifications API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let me: number
  let other: number
  let myOrg: number
  let otherOrg: number

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `nt-${tag}-${Math.random()}@t.by`, name: tag })
      .returning()
    return u!.id
  }

  async function notify(userId: number, orgId: number, eventId: number) {
    await enqueueNotification(db, {
      type: 'reminder_24h',
      dedupKey: `reminder_24h:event:${eventId}:user:${userId}`,
      userId,
      organizationId: orgId,
      params: { eventTitle: `Игра ${eventId}`, organizationId: orgId },
    })
  }

  const ids = async (userId: number) =>
    (await db.select().from(notifications).where(eq(notifications.recipientUserId, userId))).map(
      (n) => n.id,
    )

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    me = await newUser('me')
    other = await newUser('other')
    myOrg = (await organizationService.create({ userId: me }, { name: 'Моя группа' })).id
    otherOrg = (await organizationService.create({ userId: other }, { name: 'Чужая группа' })).id
    await notify(me, myOrg, 1)
    await notify(other, otherOrg, 2)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('requires a session on every route', async () => {
    expect((await request('GET', '/api/notifications')).status).toBe(401)
    expect((await request('POST', '/api/notifications/read', { body: { all: true } })).status).toBe(
      401,
    )
    expect((await request('GET', '/api/notifications/quiet-hours')).status).toBe(401)
    expect(
      (await request('PUT', '/api/notifications/quiet-hours', { body: { start: 1, end: 2 } }))
        .status,
    ).toBe(401)
  })

  it('lists only own notifications', async () => {
    const res = await request('GET', '/api/notifications', { user: me })
    expect(res.status).toBe(200)
    const body = res.body as { items: { organizationId: number }[]; unreadCount: number }
    expect(body.items).toHaveLength(1)
    expect(body.items[0]!.organizationId).toBe(myOrg)
    expect(body.unreadCount).toBe(1)
  })

  it("does not widen the feed with another group's organizationId", async () => {
    const res = await request('GET', `/api/notifications?organizationId=${otherOrg}`, { user: me })
    expect(res.status).toBe(200)
    expect((res.body as { items: unknown[]; unreadCount: number }).items).toEqual([])
    expect((res.body as { unreadCount: number }).unreadCount).toBe(0)
  })

  it('rejects malformed query parameters', async () => {
    expect((await request('GET', '/api/notifications?limit=0', { user: me })).status).toBe(422)
    expect(
      (await request('GET', '/api/notifications?organizationId=abc', { user: me })).status,
    ).toBe(422)
  })

  it('silently ignores foreign ids when marking as read', async () => {
    const [mine] = await ids(me)
    const [theirs] = await ids(other)
    const res = await request('POST', '/api/notifications/read', {
      user: me,
      body: { ids: [theirs, 999_999] },
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ updated: 0 })
    expect(
      (await db.select().from(notifications).where(eq(notifications.id, theirs!)))[0]!.readAt,
    ).toBeNull()

    const own = await request('POST', '/api/notifications/read', {
      user: me,
      body: { ids: [mine] },
    })
    expect(own.body).toEqual({ updated: 1 })
  })

  it("'all' with another group's organizationId touches nothing", async () => {
    const res = await request('POST', '/api/notifications/read', {
      user: me,
      body: { all: true, organizationId: otherOrg },
    })
    expect(res.body).toEqual({ updated: 0 })
    const [theirs] = await ids(other)
    expect(
      (await db.select().from(notifications).where(eq(notifications.id, theirs!)))[0]!.readAt,
    ).toBeNull()
  })

  it('validates the read body', async () => {
    expect((await request('POST', '/api/notifications/read', { user: me, body: {} })).status).toBe(
      422,
    )
    expect(
      (await request('POST', '/api/notifications/read', { user: me, body: { ids: [] } })).status,
    ).toBe(422)
    expect(
      (
        await request('POST', '/api/notifications/read', {
          user: me,
          body: { ids: [1], all: true },
        })
      ).status,
    ).toBe(422)
  })

  it('stores quiet hours per user and validates the range', async () => {
    const put = (body: unknown, user = me) =>
      request('PUT', '/api/notifications/quiet-hours', { user, body })
    expect((await put({ start: 1320, end: 420 })).body).toEqual({
      quietHours: { start: 1320, end: 420 },
    })
    expect((await request('GET', '/api/notifications/quiet-hours', { user: me })).body).toEqual({
      quietHours: { start: 1320, end: 420 },
    })
    // у другого пользователя настройка своя
    expect((await request('GET', '/api/notifications/quiet-hours', { user: other })).body).toEqual({
      quietHours: null,
    })
    expect((await put({ start: 1440, end: 0 })).status).toBe(422)
    expect((await put({ start: 10 })).status).toBe(422)
    expect((await put(null)).body).toEqual({ quietHours: null })
  })
})
