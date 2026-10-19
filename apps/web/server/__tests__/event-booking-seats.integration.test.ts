import { bookingService, eventService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 20.4.5: HTTP-контракт, на который опирается экран записи Mini App — флаг нескольких мест в
 * `capabilities`, свободные места события с учётом предложений из очереди, места в моей записи и
 * составе, тела запроса степпера (`seats`, `allowWaitlist`).
 */
describe('event booking with several seats over HTTP (20.4.5)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let orgId: number
  let people: number[]
  const base = () => `/api/organizations/${orgId}`
  const newEvent = (capacity: number) =>
    eventService.create({ userId: ownerId }, orgId, {
      title: 'Seats',
      startsAt: new Date(Date.now() + 48 * 3600_000),
      endsAt: new Date(Date.now() + 50 * 3600_000),
      capacity,
    })

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    const rows = await db
      .insert(users)
      .values(Array.from({ length: 4 }, (_, i) => ({ email: `seats-${i}-${Math.random()}@t.by` })))
      .returning()
    ownerId = rows[0]!.id
    people = rows.slice(1).map((u) => u.id)
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Seats' })).id
    for (const userId of people)
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

  it('exposes the multi-seat flag to the Mini App and the group limit', async () => {
    const on = await request('GET', base(), { user: people[0] })
    expect(on.status).toBe(200)
    const body = on.body as {
      organization: { maxSeatsPerBooking: number }
      capabilities: { eventMultiSeat: boolean }
    }
    expect(body.capabilities.eventMultiSeat).toBe(true)
    expect(body.organization.maxSeatsPerBooking).toBe(3)

    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', '')
    const off = await request('GET', base(), { user: people[0] })
    expect((off.body as { capabilities: { eventMultiSeat: boolean } }).capabilities).toMatchObject({
      eventMultiSeat: false,
    })
  })

  it('stepper bodies: partial queue needs allowWaitlist, then seats show in card and roster', async () => {
    const ev = await newEvent(3)
    const [a, b] = people as [number, number, number]
    const url = `${base()}/events/${ev.id}/bookings`
    await request('POST', url, { user: a, body: { method: 'free', seats: 2 } })

    // осталось одно место из трёх: два места без согласия — 409
    const refused = await request('POST', url, { user: b, body: { method: 'free', seats: 2 } })
    expect(refused.status).toBe(409)
    expect((refused.body as { data: { code: string } }).data.code).toBe('booking.not_enough_seats')

    const agreed = await request('POST', url, {
      user: b,
      body: { method: 'free', seats: 2, allowWaitlist: true },
    })
    expect(agreed.status).toBe(200)

    const card = await request('GET', `${base()}/events/${ev.id}`, { user: b })
    const detail = card.body as {
      event: {
        freeSeats: number
        taken: number
        players: number
        waitlist: number
        myBooking: { seats: number; waitlistSeats: number; offer: unknown }
      }
      roster: { user: { id: number }; seats: number }[]
    }
    expect(detail.event).toMatchObject({ freeSeats: 0, taken: 3, players: 2, waitlist: 1 })
    expect(detail.event.myBooking).toMatchObject({ seats: 1, waitlistSeats: 1, offer: null })
    expect(detail.roster.find((r) => r.user.id === a)?.seats).toBe(2)
  })

  it('multi-seat body with the flag off is refused (the UI hides the stepper)', async () => {
    vi.stubEnv('EVENT_MULTI_SEAT_ENABLED', '')
    const ev = await newEvent(5)
    const res = await request('POST', `${base()}/events/${ev.id}/bookings`, {
      user: people[0],
      body: { method: 'free', seats: 2 },
    })
    expect(res.status).toBe(409)
    expect((res.body as { data: { code: string } }).data.code).toBe('booking.multi_seat_disabled')
  })

  it('free seats do not include seats held by a waitlist offer', async () => {
    const ev = await newEvent(1)
    const [a, b] = people as [number, number, number]
    const ba = await bookingService.book({ userId: a }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: b }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: a }, ba.id)

    const card = await request('GET', `${base()}/events/${ev.id}`, { user: b })
    const detail = card.body as {
      event: {
        taken: number
        freeSeats: number
        myBooking: { offer: { seats: number; expiresAt: string } | null }
      }
    }
    // место свободно в составе, но удерживается предложением второму в очереди
    expect(detail.event.taken).toBe(0)
    expect(detail.event.freeSeats).toBe(0)
    expect(detail.event.myBooking.offer).toMatchObject({ seats: 1 })
    expect(Date.parse(detail.event.myBooking.offer!.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('a non-empty queue holds the free seats back while the scheduler is on (M1) and the card carries server time (M2)', async () => {
    const ev = await newEvent(1)
    const [a, b] = people as [number, number, number]
    await bookingService.book({ userId: a }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: b }, orgId, ev.id, { method: 'free' })
    // вместимость выросла без предложения: свободное место есть, очередь не пуста
    await db.update(events).set({ capacity: 2 }).where(eq(events.id, ev.id))

    const on = await request('GET', `${base()}/events/${ev.id}`, { user: people[2] })
    const body = on.body as { event: { freeSeats: number }; serverNow: string }
    expect(body.event.freeSeats).toBe(0)
    expect(Math.abs(Date.parse(body.serverNow) - Date.now())).toBeLessThan(60_000)

    vi.stubEnv('SCHEDULER_ENABLED', '')
    const off = await request('GET', `${base()}/events/${ev.id}`, { user: people[2] })
    expect((off.body as { event: { freeSeats: number } }).event.freeSeats).toBe(1)
  })

  it('N1: queued seats that already hold offers do not hide a free seat', async () => {
    const ev = await newEvent(2)
    const [a, b, c] = people as [number, number, number]
    const ba = await bookingService.book({ userId: a }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: c }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: b }, orgId, ev.id, { method: 'free' })
    await bookingService.cancel({ userId: a }, ba.id) // место предложено b
    await db.update(events).set({ capacity: 3 }).where(eq(events.id, ev.id))

    const card = await request('GET', `${base()}/events/${ev.id}`, { user: people[0] })
    // занято 1 (c) + 1 под предложением b; очередь без предложений пуста; свободно 1 из 3
    expect((card.body as { event: { freeSeats: number } }).event.freeSeats).toBe(1)
    const ok = await request('POST', `${base()}/events/${ev.id}/bookings`, {
      user: people[0],
      body: { method: 'free' },
    })
    expect(ok.status).toBe(200)
    expect((ok.body as { booking: { status: string } }).booking.status).toBe('confirmed')
  })

  it('N2: bookingClosed comes from the server — a title edit after the close moment keeps it closed', async () => {
    const ev = await newEvent(5)
    // момент закрытия (старт − 120 мин) наступил, метки ручного закрытия нет
    await db
      .update(events)
      .set({ startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 7200_000) })
      .where(eq(events.id, ev.id))
    const get = async () =>
      (
        (await request('GET', `${base()}/events/${ev.id}`, { user: people[0] })).body as {
          event: { bookingClosed: boolean }
        }
      ).event.bookingClosed
    expect(await get()).toBe(true)
    await eventService.update({ userId: ownerId }, ev.id, { title: 'Renamed after close' })
    expect(await get()).toBe(true)

    vi.stubEnv('SCHEDULER_ENABLED', '')
    expect(await get()).toBe(false)
  })

  it('N2: an event opened after the close moment is organizer-led (manual close mark) — not closed', async () => {
    const created = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Late',
      startsAt: new Date(Date.now() + 3600_000),
      endsAt: new Date(Date.now() + 7200_000),
      capacity: 5,
    })
    const card = await request('GET', `${base()}/events/${created.id}`, { user: people[0] })
    expect((card.body as { event: { bookingClosed: boolean } }).event.bookingClosed).toBe(false)
  })
})
