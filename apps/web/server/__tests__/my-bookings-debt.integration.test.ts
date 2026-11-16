import {
  bookingService,
  eventService,
  organizationService,
  paymentService,
} from '@volley-time/core'
import {
  bookings,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

interface MyBooking {
  id: number
  status: string
  method: string | null
  seatPayments: { paidSeats: number; pendingSeats: number; releasedPaidSeats: number }
}

/**
 * Task 21.4.19: кнопка «Оплатить» у должника с посещённой записью. Экран только показывает
 * реквизиты; долг клиент берёт из `seatPayments.pendingSeats` ответа `bookings/my`, поэтому
 * проверяется сервер: долг есть только у неоплаченной записи, и только у самого игрока.
 */
describe('my bookings: debt of attended / no_show bookings (21.4.19)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let playerId: number
  let otherId: number
  let outsiderId: number
  let orgId: number
  let otherOrgId: number
  const owner = () => ({ userId: ownerId })
  const mine = (org: number, user: number) =>
    request('GET', `/api/organizations/${org}/bookings/my?filter=all&limit=100`, { user })
  const bookingsOf = async (org: number, user: number) =>
    ((await mine(org, user)).body as { bookings: MyBooking[] }).bookings

  async function heldBooking(userId: number, status: 'attended' | 'no_show') {
    const event = await eventService.create(owner(), orgId, {
      title: `Игра ${status}`,
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
      capacity: 10,
      price: 1500,
    })
    const booking = await bookingService.book({ userId }, orgId, event.id, { method: 'cash' })
    // посещение отмечается после начала игры; здесь важен только итоговый статус записи
    await db.update(bookings).set({ status }).where(eq(bookings.id, booking.id))
    return booking
  }

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { email: 'debt-owner@test.by' },
        { email: 'debt-player@test.by' },
        { email: 'debt-other@test.by' },
        { email: 'debt-outsider@test.by' },
      ])
      .returning()
    ownerId = people[0]!.id
    playerId = people[1]!.id
    otherId = people[2]!.id
    outsiderId = people[3]!.id
    orgId = (await organizationService.create(owner(), { name: 'Debt' })).id
    otherOrgId = (await organizationService.create({ userId: outsiderId }, { name: 'Elsewhere' }))
      .id
    await db.insert(organizationMembers).values(
      [playerId, otherId].map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('reports an unpaid seat on attended and no_show bookings of the player', async () => {
    const a = await heldBooking(playerId, 'attended')
    const n = await heldBooking(playerId, 'no_show')
    const list = await bookingsOf(orgId, playerId)
    const byId = new Map(list.map((b) => [b.id, b]))
    expect(byId.get(a.id)).toMatchObject({
      status: 'attended',
      method: 'cash',
      seatPayments: { pendingSeats: 1, paidSeats: 0 },
    })
    expect(byId.get(n.id)).toMatchObject({
      status: 'no_show',
      seatPayments: { pendingSeats: 1, paidSeats: 0 },
    })
  })

  it('reports no debt once the organizer confirmed the payment', async () => {
    const a = await heldBooking(playerId, 'attended')
    const n = await heldBooking(playerId, 'no_show')
    for (const b of [a, n]) await paymentService.confirm(owner(), b.paymentId!, { orgId })
    const list = await bookingsOf(orgId, playerId)
    expect(list).toHaveLength(2)
    for (const b of list) expect(b.seatPayments).toMatchObject({ pendingSeats: 0, paidSeats: 1 })
  })

  it('does not show a debt of one player to another player of the same group', async () => {
    const a = await heldBooking(playerId, 'attended')
    expect(await bookingsOf(orgId, otherId)).toEqual([])
    expect((await bookingsOf(orgId, playerId)).map((b) => b.id)).toEqual([a.id])
  })

  it('does not expose the booking to a player of another group', async () => {
    await heldBooking(playerId, 'no_show')
    // чужая группа: не участник → 403; в своей группе у него записей нет
    expect((await mine(orgId, outsiderId)).status).toBe(403)
    expect(await bookingsOf(otherOrgId, outsiderId)).toEqual([])
    // и ровно наоборот: запись группы не просачивается в другую группу
    expect((await mine(otherOrgId, playerId)).status).toBe(403)
  })
})
