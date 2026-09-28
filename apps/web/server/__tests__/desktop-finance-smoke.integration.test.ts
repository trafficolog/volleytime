import { eventService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

describe('desktop finance HTTP smoke', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
  it('books paid places, confirms/rejects, appends manual operations and isolates player finance', async () => {
    const people = await db
      .insert(users)
      .values([{ name: 'Owner' }, { name: 'Player A' }, { name: 'Player B' }])
      .returning()
    const owner = people[0]!.id,
      player = people[1]!.id,
      second = people[2]!.id
    const org = await organizationService.create(
      { userId: owner },
      { name: 'Desktop finance smoke' },
    )
    for (const userId of [player, second])
      await memberService.add({ userId: owner }, { organizationId: org.id, userId })
    const event = await eventService.create({ userId: owner }, org.id, {
      title: 'Paid places',
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 93600000),
      capacity: 2,
      price: 1500,
    })
    const base = `/api/organizations/${org.id}`
    for (const user of [player, second])
      expect(
        (
          await request('POST', `${base}/events/${event.id}/bookings`, {
            user,
            body: { method: 'cash' },
          })
        ).status,
      ).toBe(200)
    const pending = await request('GET', `${base}/payments`, { user: owner })
    const paymentRows = (pending.body as { payments: { id: number; user: { id: number } }[] })
      .payments
    expect(paymentRows).toHaveLength(2)
    const confirmed = paymentRows.find((p) => p.user.id === player)!.id,
      rejected = paymentRows.find((p) => p.user.id === second)!.id
    expect(
      (await request('POST', `${base}/payments/${confirmed}/confirm`, { user: owner })).status,
    ).toBe(200)
    expect(
      (await request('POST', `${base}/payments/${rejected}/reject`, { user: owner })).status,
    ).toBe(200)
    const history = (await request('GET', `${base}/payments/history`, { user: owner })).body as {
      payments: { id: number; status: string }[]
    }
    expect(history.payments.find((p) => p.id === confirmed)?.status).toBe('succeeded')
    expect(history.payments.find((p) => p.id === rejected)?.status).toBe('cancelled')
    const initial = (await request('GET', `${base}/ledger`, { user: owner })).body as {
      entries: { category: string; amount: number }[]
    }
    expect(initial.entries).toEqual([
      expect.objectContaining({ category: 'payment_income', amount: 1500 }),
    ])
    expect(
      (
        await request('POST', `${base}/ledger/income`, {
          user: owner,
          body: { category: 'other_income', amount: 125 },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await request('POST', `${base}/ledger/expense`, {
          user: owner,
          body: { category: 'rent', amount: 25, eventId: event.id },
        })
      ).status,
    ).toBe(200)
    const final = (await request('GET', `${base}/ledger`, { user: owner })).body as {
      balance: unknown
      entries: unknown[]
    }
    expect(final.balance).toMatchObject({
      currency: 'BYN',
      income: 1625,
      expense: 25,
      balance: 1600,
      byCurrency: { BYN: { income: 1625, expense: 25, balance: 1600 } },
    })
    expect(final.entries).toHaveLength(3)
    for (const path of ['/payments', '/payments/history', '/ledger'])
      expect((await request('GET', base + path, { user: player })).status).toBe(403)
    for (const action of ['income', 'expense'])
      expect(
        (
          await request('POST', `${base}/ledger/${action}`, {
            user: player,
            body: { category: action === 'income' ? 'other_income' : 'rent', amount: 100 },
          })
        ).status,
      ).toBe(403)
    for (const action of ['confirm', 'reject'])
      expect(
        (await request('POST', `${base}/payments/${confirmed}/${action}`, { user: player })).status,
      ).toBe(403)
  })
})
