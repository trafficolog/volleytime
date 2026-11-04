import {
  bookingService,
  eventService,
  ledgerService,
  memberService,
  organizationService,
} from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import type { ManagerOverview } from '@volley-time/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

/** Task 21.2.18: агрегаты обзора кабинета в ответе дашборда — только управляющему своей группы. */
describe('dashboard overview aggregates (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let owner: number
  let player: number
  let outsider: number
  let foreignOwner: number
  let orgId: number
  let foreignOrgId: number
  let eventId: number

  const dashboard = (org = orgId) => `/api/organizations/${org}/dashboard`

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { name: 'Owner' },
        { name: 'Player' },
        { name: 'Outsider' },
        { name: 'Foreign owner' },
        { name: 'Foreign player' },
      ])
      .returning()
    owner = people[0]!.id
    player = people[1]!.id
    outsider = people[2]!.id
    foreignOwner = people[3]!.id
    const foreignPlayer = people[4]!.id
    orgId = (await organizationService.create({ userId: owner }, { name: 'Overview' })).id
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: player })
    foreignOrgId = (
      await organizationService.create({ userId: foreignOwner }, { name: 'Overview foreign' })
    ).id
    await memberService.add(
      { userId: foreignOwner },
      { organizationId: foreignOrgId, userId: foreignPlayer },
    )
    const mk = (title: string, price: number) => ({
      title,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 93_600_000),
      capacity: 4,
      price,
    })
    eventId = (await eventService.create({ userId: owner }, orgId, mk('Основа', 1500))).id
    const foreignEventId = (
      await eventService.create({ userId: foreignOwner }, foreignOrgId, mk('Чужое', 900))
    ).id
    await bookingService.book({ userId: player }, orgId, eventId, { method: 'cash' })
    await bookingService.book({ userId: foreignPlayer }, foreignOrgId, foreignEventId, {
      method: 'cash',
    })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('gives a manager every W-02 aggregate in the dashboard response', async () => {
    const res = await request('GET', dashboard(), { user: owner })
    expect(res.status).toBe(200)
    const body = res.body as { isManager: boolean; overview: ManagerOverview; manager: unknown }
    expect(body.isManager).toBe(true)
    const o = body.overview
    expect(o.currency).toBe('BYN')
    expect(o.timezone).toBe('Europe/Minsk')
    expect(o.events.thisMonth).toBeGreaterThanOrEqual(0)
    expect(o.bookings).toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        seats: expect.any(Number),
        capacity: expect.any(Number),
      }),
    )
    expect(o.subscriptions.active).toBe(0)
    expect(o.pendingPayments).toMatchObject({ count: 1, amount: 1500, currency: 'BYN' })
    expect(o.pendingPayments.items[0]).toMatchObject({
      amount: 1500,
      event: { id: eventId, title: 'Основа' },
      user: { id: player },
    })
    expect(o.cashWeekly.weeks).toHaveLength(4)
    // существующие поля менеджера не изменились
    expect(body.manager).toMatchObject({ pendingCount: 1, pendingAmount: 1500 })
  })

  it('reconciles the weekly series with the cash desk after a confirmed payment', async () => {
    const pending = (
      (await request('GET', `/api/organizations/${orgId}/payments`, { user: owner })).body as {
        payments: { id: number }[]
      }
    ).payments
    expect(
      (
        await request('POST', `/api/organizations/${orgId}/payments/${pending[0]!.id}/confirm`, {
          user: owner,
        })
      ).status,
    ).toBe(200)
    await ledgerService.addExpense({ userId: owner }, orgId, {
      category: 'rent',
      amount: 400,
      description: 'Аренда',
    })
    const o = (
      (await request('GET', dashboard(), { user: owner })).body as { overview: ManagerOverview }
    ).overview
    const ledger = (await request('GET', `/api/organizations/${orgId}/ledger`, { user: owner }))
      .body as { balance: { income: number; expense: number; balance: number } }
    expect(o.cashWeekly.total).toEqual({
      income: ledger.balance.income,
      expense: ledger.balance.expense,
      net: ledger.balance.balance,
    })
    expect(o.cashWeekly.total).toEqual({ income: 1500, expense: 400, net: 1100 })
    expect(o.cashWeekly.weeks[3]).toMatchObject({ income: 1500, expense: 400, net: 1100 })
    expect(o.pendingPayments).toMatchObject({ count: 0, amount: 0, items: [] })
  })

  it('does not expose any group aggregate to a player and keeps the player payload unchanged', async () => {
    const res = await request('GET', dashboard(), { user: player })
    expect(res.status).toBe(200)
    const body = res.body as Record<string, unknown>
    expect(body.isManager).toBe(false)
    expect(body.manager).toBeNull()
    expect('overview' in body).toBe(false)
    expect(Object.keys(body).sort()).toEqual(
      [
        'bookingsAwaitingPayment',
        'bookingsCount',
        'hero',
        'isManager',
        'manager',
        'myBookings',
        'subscription',
        'upcoming',
      ].sort(),
    )
    for (const marker of ['cashWeekly', 'pendingPayments', 'occupancyPercent'])
      expect(res.text).not.toContain(marker)
  })

  it('denies an outsider and a manager of another group', async () => {
    for (const user of [outsider, foreignOwner]) {
      const res = await request('GET', dashboard(), { user })
      expect([403, 404], `user ${user} → ${res.status}`).toContain(res.status)
      for (const marker of ['cashWeekly', 'pendingPayments', 'overview'])
        expect(res.text).not.toContain(marker)
    }
    const anon = await request('GET', dashboard())
    expect([401, 403]).toContain(anon.status)
  })

  it('scopes aggregates to the requested group and gives a manager no rights in another group', async () => {
    // владелец — обычный игрок чужой группы: свои цифры без агрегатов группы
    await memberService.add(
      { userId: foreignOwner },
      { organizationId: foreignOrgId, userId: owner },
    )
    const asPlayer = await request('GET', dashboard(foreignOrgId), { user: owner })
    expect(asPlayer.status).toBe(200)
    expect((asPlayer.body as { isManager: boolean }).isManager).toBe(false)
    expect(asPlayer.text).not.toContain('cashWeekly')
    expect(asPlayer.text).not.toContain('pendingPayments')

    const mine = (
      (await request('GET', dashboard(), { user: owner })).body as { overview: ManagerOverview }
    ).overview
    const foreign = (
      (await request('GET', dashboard(foreignOrgId), { user: foreignOwner })).body as {
        overview: ManagerOverview
      }
    ).overview
    // у чужой группы своя ожидающая оплата 900; в ответе своей группы её нет
    expect(foreign.pendingPayments).toMatchObject({ count: 1, amount: 900 })
    expect(mine.pendingPayments.amount).toBe(0)
    expect(JSON.stringify(mine)).not.toContain('Чужое')
  })
})
