import { memberService, organizationService } from '@volley-time/core'
import {
  appendEventBalanceEntry,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  events,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Body = { data?: { code?: string }; [key: string]: unknown }

/** Task 20.2.1: баланс событий по HTTP — права, ошибки, списание и возврат через API событий. */
describe('event balance API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED
  const base = (id = orgId) => `/api/organizations/${id}/event-balance`
  const future = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
  const newEvent = (title = 'Игра') => ({
    title,
    startsAt: future(24),
    endsAt: future(26),
    capacity: 10,
    price: 0,
  })

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `ebh-${tag}-${Math.random()}@t.by`, name: `Name ${tag}` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    playerId = await newUser('player')
    otherOwnerId = await newUser('other')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Balance HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('GET event-balance: manager sees balance, threshold, packages; player is refused', async () => {
    for (const user of [ownerId, organizerId]) {
      const res = await request('GET', base(), { user })
      expect(res.status).toBe(200)
      expect((res.body as Body).eventBalance).toMatchObject({
        balance: 5,
        low: true,
        lowThreshold: 10,
        pendingRequests: [],
      })
      expect(
        ((res.body as Body).eventBalance as { packages: { code: string }[] }).packages.map(
          (p) => p.code,
        ),
      ).toEqual(['events_10', 'events_30', 'events_100'])
    }
    const player = await request('GET', base(), { user: playerId })
    expect(player.status).toBe(403)
    const outsider = await request('GET', base(), { user: otherOwnerId })
    expect(outsider.status).toBe(403)
  })

  it('publishing through the events API spends; zero balance answers 409 and creates nothing', async () => {
    const created = await request('POST', `/api/organizations/${orgId}/events`, {
      user: organizerId,
      body: newEvent('Списание'),
    })
    expect(created.status).toBe(200)
    const balance = await request('GET', base(), { user: ownerId })
    expect(((balance.body as Body).eventBalance as { balance: number }).balance).toBe(4)

    await db.transaction((tx) =>
      appendEventBalanceEntry(tx, {
        organizationId: orgId,
        delta: -4,
        reason: 'correction',
        actor: { kind: 'user', userId: ownerId },
        comment: 'test',
      }),
    )
    const before = await db.select().from(events).where(eq(events.organizationId, orgId))
    const refused = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: newEvent('Нет баланса'),
    })
    expect(refused.status).toBe(409)
    expect((refused.body as Body).data?.code).toBe('event_balance.insufficient')
    expect(await db.select().from(events).where(eq(events.organizationId, orgId))).toHaveLength(
      before.length,
    )
  })

  it('cancelling an event without bookings through the API refunds one event', async () => {
    const created = await request('POST', `/api/organizations/${orgId}/events`, {
      user: ownerId,
      body: newEvent(),
    })
    const eventId = ((created.body as Body).event as { id: number }).id
    const cancelled = await request(
      'POST',
      `/api/organizations/${orgId}/events/${eventId}/cancel`,
      {
        user: ownerId,
        body: {},
      },
    )
    expect(cancelled.status).toBe(200)
    const history = await request('GET', `${base()}/entries`, { user: organizerId })
    expect(history.status).toBe(200)
    const entries = (history.body as { entries: { reason: string; delta: number }[] }).entries
    expect(entries.map((e) => [e.reason, e.delta])).toEqual([
      ['refund', 1],
      ['spend', -1],
      ['demo_grant', 5],
    ])
  })

  it('GET entries: keyset pages, 422 on bad limit/cursor, no foreign or private data', async () => {
    for (let i = 0; i < 3; i++) {
      await request('POST', `/api/organizations/${orgId}/events`, {
        user: ownerId,
        body: newEvent(`Событие ${i}`),
      })
    }
    // чужая группа тратит свой баланс — в нашей истории её нет
    await request('POST', `/api/organizations/${otherOrgId}/events`, {
      user: otherOwnerId,
      body: newEvent('Чужое секретное'),
    })

    const first = await request('GET', `${base()}/entries?limit=2`, { user: ownerId })
    expect(first.status).toBe(200)
    const page1 = first.body as { entries: { id: number }[]; nextCursor: string | null }
    expect(page1.entries).toHaveLength(2)
    expect(page1.nextCursor).toEqual(expect.any(String))
    const second = await request(
      'GET',
      `${base()}/entries?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
      { user: ownerId },
    )
    const page2 = second.body as { entries: { id: number }[]; nextCursor: string | null }
    expect(page2.entries).toHaveLength(2)
    expect(page2.nextCursor).toBeNull()
    expect(new Set([...page1.entries, ...page2.entries].map((e) => e.id)).size).toBe(4)
    expect(first.text + second.text).not.toContain('Чужое секретное')
    expect(first.text + second.text).not.toContain('@t.by')

    for (const q of ['limit=0', 'limit=101', 'limit=abc', 'cursor=%%%', 'cursor=eyJ4IjoxfQ']) {
      const res = await request('GET', `${base()}/entries?${q}`, { user: ownerId })
      expect(res.status, q).toBe(422)
      expect((res.body as Body).data?.code).toBe('validation_failed')
    }
    expect((await request('GET', `${base()}/entries`, { user: playerId })).status).toBe(403)
  })

  it('POST purchase-requests: owner only, snapshot from the catalog, strict body', async () => {
    const res = await request('POST', `${base()}/purchase-requests`, {
      user: ownerId,
      body: { packageCode: 'events_30' },
    })
    expect(res.status).toBe(200)
    expect((res.body as Body).purchaseRequest).toMatchObject({
      organizationId: orgId,
      units: 30,
      amount: 12_000,
      currency: 'BYN',
      status: 'pending',
    })

    for (const body of [
      { packageCode: 'events_1000' },
      { packageCode: 'events_10', units: 1 },
      {},
    ]) {
      const bad = await request('POST', `${base()}/purchase-requests`, { user: ownerId, body })
      expect(bad.status, JSON.stringify(body)).toBe(422)
    }
    for (const user of [organizerId, playerId, otherOwnerId]) {
      const denied = await request('POST', `${base()}/purchase-requests`, {
        user,
        body: { packageCode: 'events_10' },
      })
      expect(denied.status).toBe(403)
    }
    expect(await db.select().from(eventBalancePurchaseRequests)).toHaveLength(1)
    // заявка не меняет баланс; в журнале только demo-квоты двух групп
    expect((await db.select().from(eventBalanceEntries)).map((e) => e.reason)).toEqual([
      'demo_grant',
      'demo_grant',
    ])
    const view = await request('GET', base(), { user: ownerId })
    expect((view.body as Body).eventBalance).toMatchObject({
      balance: 5,
      pendingRequests: [expect.objectContaining({ units: 30, amount: 12_000 })],
    })
  })
})
