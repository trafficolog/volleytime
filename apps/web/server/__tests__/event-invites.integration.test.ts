import { memberService, organizationService } from '@volley-time/core'
import { bookings, closeDb, db, eq, inviteLinks, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

type Body = { data?: { code?: string } } & Record<string, unknown>

/**
 * Task 20.1.3: HTTP-контракт режима записи и приглашений на событие — коды ошибок, наследование
 * группа → событие через API, запрет записи без приглашения, запрос приглашения и ответ организатора.
 */
describe('event join mode and invites API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let secondId: number
  let orgId: number
  const base = () => `/api/organizations/${orgId}`

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `ei-${tag}-${Math.random()}@t.by`, name: tag })
      .returning()
    return u!.id
  }

  async function createEvent(body: Record<string, unknown> = {}) {
    const res = await request('POST', `${base()}/events`, {
      user: ownerId,
      body: {
        title: 'Игра',
        startsAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 50 * 3600_000).toISOString(),
        capacity: 10,
        price: 0,
        ...body,
      },
    })
    return res
  }

  const code = (res: { body: unknown }) => (res.body as Body).data?.code

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    vi.stubEnv('EVENT_INVITE_MODE_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    playerId = await newUser('player')
    secondId = await newUser('second')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Invite HTTP' })).id
    for (const userId of [playerId, secondId])
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('capability is exposed and gates invite mode with 409 when disabled', async () => {
    const on = await request('GET', base(), { user: ownerId })
    expect((on.body as Body).capabilities).toMatchObject({ eventInviteMode: true })
    vi.stubEnv('EVENT_INVITE_MODE_ENABLED', '')
    const off = await request('GET', base(), { user: ownerId })
    expect((off.body as Body).capabilities).toMatchObject({ eventInviteMode: false })
    const res = await createEvent({ joinMode: 'invite' })
    expect(res.status).toBe(409)
    expect(code(res)).toBe('event.invite_mode_disabled')
  })

  it('group default flows into new events; created events keep their mode', async () => {
    await request('PATCH', `${base()}/settings`, {
      user: ownerId,
      body: { defaultJoinMode: 'invite' },
    })
    const inherited = await createEvent()
    expect(inherited.status).toBe(200)
    expect((inherited.body as { event: { joinMode: string } }).event.joinMode).toBe('invite')
    const overridden = await createEvent({ joinMode: 'open' })
    expect((overridden.body as { event: { joinMode: string } }).event.joinMode).toBe('open')

    await request('PATCH', `${base()}/settings`, {
      user: ownerId,
      body: { defaultJoinMode: 'open' },
    })
    const id = (inherited.body as { event: { id: number } }).event.id
    const detail = await request('GET', `${base()}/events/${id}`, { user: playerId })
    expect(detail.body).toMatchObject({ event: { joinMode: 'invite', myInviteRequest: null } })
  })

  it('booking an invite event without a valid invite is rejected by the API', async () => {
    const ev = (await createEvent({ joinMode: 'invite' })).body as { event: { id: number } }
    const book = (user: number, body: Record<string, unknown> = {}) =>
      request('POST', `${base()}/events/${ev.event.id}/bookings`, {
        user,
        body: { method: 'free', ...body },
      })

    const denied = await book(playerId)
    expect(denied.status).toBe(403)
    expect(code(denied)).toBe('booking.invite_required')
    const guessed = await book(playerId, { inviteToken: 'A'.repeat(24) })
    expect(guessed.status).toBe(403)
    expect(code(guessed)).toBe('booking.invite_required')

    const created = await request('POST', `${base()}/events/${ev.event.id}/invites`, {
      user: ownerId,
      body: {},
    })
    expect(created.status).toBe(200)
    const { invite, startParam } = created.body as {
      invite: { id: number; token: string }
      startParam: string
    }
    expect(startParam).toBe(`event_${ev.event.id}_${invite.token}`)

    const ok = await book(playerId, { inviteToken: invite.token })
    expect(ok.status).toBe(200)
    const reused = await book(secondId, { inviteToken: invite.token })
    expect(reused.status).toBe(403)
    expect(code(reused)).toBe('booking.invite_required')

    const expired = (
      await request('POST', `${base()}/events/${ev.event.id}/invites`, {
        user: ownerId,
        body: { expiresInHours: 1 },
      })
    ).body as { invite: { id: number; token: string } }
    await db
      .update(inviteLinks)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(inviteLinks.id, expired.invite.id))
    const late = await book(secondId, { inviteToken: expired.invite.token })
    expect(late.status).toBe(410)
    expect(code(late)).toBe('invite.expired')

    const rows = await db.select().from(bookings).where(eq(bookings.eventId, ev.event.id))
    expect(rows.map((r) => [r.userId, r.inviteId])).toEqual([[playerId, invite.id]])

    // токен приглашения на событие — не приглашение в группу
    const redeem = await request('POST', `/api/invites/${invite.token}/redeem`, {
      user: await newUser('stranger'),
    })
    expect(redeem.status).toBe(404)
  })

  it('player asks, organizer answers, player books; codes for repeated actions', async () => {
    const ev = (await createEvent({ joinMode: 'invite' })).body as { event: { id: number } }
    const reqUrl = `${base()}/events/${ev.event.id}/invite-requests`

    const asked = await request('POST', reqUrl, { user: playerId, body: { message: 'Можно?' } })
    expect(asked.status).toBe(200)
    const requestId = (asked.body as { request: { id: number } }).request.id
    const again = await request('POST', reqUrl, { user: playerId, body: {} })
    expect(again.status).toBe(409)
    expect(code(again)).toBe('invite_request.already_pending')

    const detail = await request('GET', `${base()}/events/${ev.event.id}`, { user: playerId })
    expect(detail.body).toMatchObject({ event: { myInviteRequest: { status: 'pending' } } })

    const list = await request('GET', reqUrl, { user: ownerId })
    expect(list.status).toBe(200)
    expect(list.body).toMatchObject({
      requests: [{ id: requestId, status: 'pending', message: 'Можно?', user: { id: playerId } }],
    })
    expect(list.text).not.toContain('@t.by')

    const approved = await request('POST', `${reqUrl}/${requestId}/approve`, {
      user: ownerId,
      body: {},
    })
    expect(approved.status).toBe(200)
    const twice = await request('POST', `${reqUrl}/${requestId}/decline`, {
      user: ownerId,
      body: {},
    })
    expect(twice.status).toBe(409)
    expect(code(twice)).toBe('invite_request.not_pending')
    const missing = await request('POST', `${reqUrl}/999999/approve`, { user: ownerId, body: {} })
    expect(missing.status).toBe(404)
    expect(code(missing)).toBe('invite_request.not_found')
    const badId = await request('POST', `${reqUrl}/abc/approve`, { user: ownerId, body: {} })
    expect(badId.status).toBe(404)

    const booked = await request('POST', `${base()}/events/${ev.event.id}/bookings`, {
      user: playerId,
      body: { method: 'free' },
    })
    expect(booked.status).toBe(200)

    const open = (await createEvent({ joinMode: 'open' })).body as { event: { id: number } }
    const notNeeded = await request('POST', `${base()}/events/${open.event.id}/invite-requests`, {
      user: secondId,
      body: {},
    })
    expect(notNeeded.status).toBe(409)
    expect(code(notNeeded)).toBe('event.join_mode_open')
  })

  it('the event can be switched to invite via PATCH', async () => {
    const ev = (await createEvent()).body as { event: { id: number } }
    const patched = await request('PATCH', `${base()}/events/${ev.event.id}`, {
      user: ownerId,
      body: { joinMode: 'invite' },
    })
    expect(patched.status).toBe(200)
    const denied = await request('POST', `${base()}/events/${ev.event.id}/bookings`, {
      user: playerId,
      body: { method: 'free' },
    })
    expect(code(denied)).toBe('booking.invite_required')
  })
})
