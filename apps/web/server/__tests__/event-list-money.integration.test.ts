import { memberService, organizationService } from '@volley-time/core'
import {
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  organizations,
  payments,
  users,
  venues,
} from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

interface ListRow {
  id: number
  title: string
  paymentTotals?: { paid: number; pending: number; currency: string }
  splitShareQuote?: { basis: string; perSeat: { min: number; max: number } } | null
}

/**
 * Task 20.5.8: суммы «Оплаты» и цена места в списке событий кабинета, дублирование (черновик через
 * POST …/events), права и границы группы.
 */
describe('cabinet events list: payments column and row menu (20.5.8)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let player2Id: number
  let outsiderId: number
  let orgId: number
  let otherOrgId: number
  const list = (user: number, id = orgId, query = '?filter=all') =>
    request('GET', `/api/organizations/${id}/events${query}`, { user })
  const rows = async (user: number, id = orgId) => {
    const res = await list(user, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { events: ListRow[] }).events
  }
  const create = async (user: number, body: Record<string, unknown>, id = orgId) => {
    const res = await request('POST', `/api/organizations/${id}/events`, {
      user,
      body: {
        title: 'Игра',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 93600000).toISOString(),
        capacity: 4,
        price: 1000,
        ...body,
      },
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { event: { id: number } }).event.id
  }
  const book = async (eventId: number, user: number) => {
    const res = await request('POST', `/api/organizations/${orgId}/events/${eventId}/bookings`, {
      user,
      body: { method: 'cash' },
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return (res.body as { booking: { id: number; paymentId: number } }).booking
  }
  const newUser = async (tag: string) =>
    (
      await db
        .insert(users)
        .values({ email: `elm-${tag}-${crypto.randomUUID()}@t.by` })
        .returning()
    )[0]!.id

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    playerId = await newUser('player')
    player2Id = await newUser('player2')
    outsiderId = await newUser('outsider')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'List money API' })).id
    otherOrgId = (await organizationService.create({ userId: outsiderId }, { name: 'Foreign' })).id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
    for (const userId of [playerId, player2Id])
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId })
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(eq(organizations.id, orgId))
    await db.delete(organizations).where(eq(organizations.id, otherOrgId))
  })
  afterAll(closeDb)

  it('manager gets paid and pending totals per event; they match the cashbox and ignore cancelled payments', async () => {
    const eventId = await create(ownerId, {})
    const emptyId = await create(ownerId, { title: 'Пустое' })
    const paid = await book(eventId, playerId)
    const cancelled = await book(eventId, player2Id)
    const confirm = await request(
      'POST',
      `/api/organizations/${orgId}/payments/${paid.paymentId}/confirm`,
      {
        user: ownerId,
        body: {},
      },
    )
    expect(confirm.status, JSON.stringify(confirm.body)).toBe(200)
    await request('POST', `/api/organizations/${orgId}/bookings/${cancelled.id}/cancel`, {
      user: player2Id,
      body: {},
    })
    await book(eventId, organizerId)
    for (const user of [ownerId, organizerId]) {
      const byId = new Map((await rows(user)).map((r) => [r.id, r]))
      expect(byId.get(eventId)!.paymentTotals).toEqual({
        paid: 1000,
        pending: 1000,
        currency: 'BYN',
      })
      expect(byId.get(emptyId)!.paymentTotals).toEqual({ paid: 0, pending: 0, currency: 'BYN' })
      expect(byId.get(eventId)!.splitShareQuote).toBeNull()
    }
    const card = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
      user: ownerId,
    })
    expect(card.status).toBe(200)
  })

  it('split share is the quote of GET …/price for one seat at the current roster', async () => {
    const eventId = await create(ownerId, { priceMode: 'split', price: 0, targetAmount: 10001 })
    await book(eventId, playerId)
    await book(eventId, player2Id)
    await book(eventId, organizerId)
    const row = (await rows(ownerId)).find((r) => r.id === eventId)!
    const price = await request('GET', `/api/organizations/${orgId}/events/${eventId}/price`, {
      user: playerId,
    })
    expect(price.status).toBe(200)
    expect(row.splitShareQuote).toEqual((price.body as { price: unknown }).price)
    expect(row.splitShareQuote).toMatchObject({ basis: 'forecast', perSeat: { max: 3334 } })
    // после фиксации — снимок без прогноза
    const settle = await request('POST', `/api/organizations/${orgId}/events/${eventId}/settle`, {
      user: ownerId,
      body: {},
    })
    expect(settle.status, JSON.stringify(settle.body)).toBe(200)
    const settled = (await rows(ownerId)).find((r) => r.id === eventId)!
    expect(settled.splitShareQuote).toMatchObject({
      basis: 'settled',
      perSeat: { min: 3333, max: 3334 },
    })
  })

  it('a player never receives group money fields', async () => {
    const eventId = await create(ownerId, {})
    await create(ownerId, { priceMode: 'split', price: 0, targetAmount: 5000 })
    await book(eventId, playerId)
    for (const row of await rows(playerId)) {
      expect(row).not.toHaveProperty('paymentTotals')
      expect(row).not.toHaveProperty('splitShareQuote')
    }
  })

  it('foreign group: member of another group is refused, own list never shows these events', async () => {
    const eventId = await create(ownerId, {})
    const foreign = await list(outsiderId, orgId)
    expect(foreign.status).toBe(403)
    expect(JSON.stringify(foreign.body)).not.toContain('paymentTotals')
    const own = await rows(outsiderId, otherOrgId)
    expect(own.map((r) => r.id)).not.toContain(eventId)
    // организатор этой группы по чужой группе тоже ничего не получает
    expect((await list(organizerId, otherOrgId)).status).toBe(403)
  })

  it('does not sum payments of another group booked under this event', async () => {
    const eventId = await create(ownerId, {})
    const booking = await book(eventId, playerId)
    await db
      .update(payments)
      .set({ organizationId: otherOrgId })
      .where(eq(payments.id, booking.paymentId))
    const row = (await rows(ownerId)).find((r) => r.id === eventId)!
    expect(row.paymentTotals).toMatchObject({ paid: 0, pending: 0 })
  })

  describe('duplicate (client side: POST …/events with status draft)', () => {
    it('creates a draft with copied fields and a shifted date without spending balance', async () => {
      vi.stubEnv('EVENT_BALANCE_ENFORCED', 'true')
      const sourceId = await create(ownerId, { title: 'Основа', capacity: 8, price: 1500 })
      const [source] = await db.select().from(events).where(eq(events.id, sourceId))
      const spendBefore = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, orgId))
      const week = 7 * 86_400_000
      const copy = await request('POST', `/api/organizations/${orgId}/events`, {
        user: organizerId,
        body: {
          title: source!.title,
          capacity: source!.capacity,
          price: source!.price,
          priceMode: source!.priceMode,
          startsAt: new Date(source!.startsAt.getTime() + week).toISOString(),
          endsAt: new Date(source!.endsAt.getTime() + week).toISOString(),
          status: 'draft',
        },
      })
      expect(copy.status, JSON.stringify(copy.body)).toBe(200)
      const draft = (copy.body as { event: { id: number; status: string } }).event
      expect(draft.status).toBe('draft')
      const [stored] = await db.select().from(events).where(eq(events.id, draft.id))
      expect(stored!.startsAt.getTime() - source!.startsAt.getTime()).toBe(week)
      expect(stored!.capacity).toBe(8)
      expect(stored!.price).toBe(1500)
      const spendAfter = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, orgId))
      expect(spendAfter).toHaveLength(spendBefore.length)
      // черновик виден управляющему и скрыт от игрока
      expect((await rows(ownerId)).map((r) => r.id)).toContain(draft.id)
      expect((await rows(playerId)).map((r) => r.id)).not.toContain(draft.id)
    })

    it('refuses a player, a foreign group member and a foreign venue', async () => {
      const body = {
        title: 'Копия',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 93600000).toISOString(),
        capacity: 4,
        status: 'draft',
      }
      const before = await db.select().from(events).where(eq(events.organizationId, orgId))
      for (const user of [playerId, outsiderId]) {
        const res = await request('POST', `/api/organizations/${orgId}/events`, { user, body })
        expect(res.status).toBe(403)
      }
      const [foreignVenue] = await db
        .insert(venues)
        .values({ organizationId: otherOrgId, name: 'Чужой зал' })
        .returning()
      const res = await request('POST', `/api/organizations/${orgId}/events`, {
        user: ownerId,
        body: { ...body, venueId: foreignVenue!.id },
      })
      expect([403, 404, 422]).toContain(res.status)
      expect(await db.select().from(events).where(eq(events.organizationId, orgId))).toHaveLength(
        before.length,
      )
    })
  })

  describe('cancel from the row menu', () => {
    it('cancels once and refunds the event balance only once', async () => {
      vi.stubEnv('EVENT_BALANCE_ENFORCED', 'true')
      const eventId = await create(ownerId, {})
      const balance = async () =>
        (
          await db
            .select()
            .from(eventBalanceEntries)
            .where(eq(eventBalanceEntries.organizationId, orgId))
        ).reduce((sum, e) => sum + e.delta, 0)
      const afterCreate = await balance()
      const cancel = (user: number) =>
        request('POST', `/api/organizations/${orgId}/events/${eventId}/cancel`, { user, body: {} })
      expect((await cancel(playerId)).status).toBe(403)
      expect((await cancel(outsiderId)).status).toBe(403)
      expect((await cancel(organizerId)).status).toBe(200)
      const afterFirst = await balance()
      expect(afterFirst).toBe(afterCreate + 1)
      expect((await cancel(organizerId)).status).toBe(200)
      expect(await balance()).toBe(afterFirst)
      const [stored] = await db.select().from(events).where(eq(events.id, eventId))
      expect(stored!.status).toBe('cancelled')
      expect(await db.select().from(bookings).where(eq(bookings.eventId, eventId))).toHaveLength(0)
    })

    it('a foreign group event cannot be cancelled through own group path', async () => {
      const foreignEvent = await create(outsiderId, { title: 'Чужое' }, otherOrgId)
      const res = await request(
        'POST',
        `/api/organizations/${orgId}/events/${foreignEvent}/cancel`,
        { user: ownerId, body: {} },
      )
      expect([403, 404]).toContain(res.status)
      const [stored] = await db.select().from(events).where(eq(events.id, foreignEvent))
      expect(stored!.status).not.toBe('cancelled')
    })
  })
})
