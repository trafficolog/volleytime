import { eventService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

interface LedgerBody {
  balance: { currency: string; income: number; expense: number; balance: number }
  awaiting: { amount: number; count: number; currency: string }
  entries: {
    id: number
    type: string
    category: string
    amount: number
    description: string | null
    method: string | null
    occurredAt: string
  }[]
}

/** Касса кабинета v3 (21.2.3): комментарий, фильтры, CSV, цифры как в карточке события. */
describe('cabinet cash desk v3 (HTTP)', () => {
  let request: Api
  let owner: number
  let player: number
  let outsider: number
  let outsiderOwner: number
  let orgId: number
  let otherOrgId: number
  let eventId: number
  let foreignEventId: number

  beforeAll(async () => {
    request = await createTestApi()
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { name: 'Owner' },
        { name: 'Player' },
        { name: 'Second' },
        { name: 'Outsider' },
        { name: 'Other owner' },
      ])
      .returning()
    owner = people[0]!.id
    player = people[1]!.id
    const second = people[2]!.id
    outsider = people[3]!.id
    outsiderOwner = people[4]!.id
    const org = await organizationService.create({ userId: owner }, { name: 'Cash desk v3' })
    orgId = org.id
    for (const userId of [player, second])
      await memberService.add({ userId: owner }, { organizationId: orgId, userId })
    const other = await organizationService.create({ userId: outsiderOwner }, { name: 'Foreign' })
    otherOrgId = other.id
    const mk = (title: string, price: number) => ({
      title,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 93_600_000),
      capacity: 4,
      price,
    })
    eventId = (await eventService.create({ userId: owner }, orgId, mk('Основа', 1500))).id
    foreignEventId = (
      await eventService.create({ userId: outsiderOwner }, otherOrgId, mk('Чужое', 900))
    ).id
    const base = `/api/organizations/${orgId}`
    for (const user of [player, second])
      expect(
        (
          await request('POST', `${base}/events/${eventId}/bookings`, {
            user,
            body: { method: 'cash' },
          })
        ).status,
      ).toBe(200)
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  const base = () => `/api/organizations/${orgId}`

  it('keeps cash desk figures equal to the event card (paid and awaiting)', async () => {
    const pending = (
      (await request('GET', `${base()}/payments`, { user: owner })).body as {
        payments: { id: number }[]
      }
    ).payments
    expect(pending).toHaveLength(2)
    expect(
      (await request('POST', `${base()}/payments/${pending[0]!.id}/confirm`, { user: owner }))
        .status,
    ).toBe(200)

    const ledger = (await request('GET', `${base()}/ledger`, { user: owner })).body as LedgerBody
    const list = (await request('GET', `${base()}/events`, { user: owner })).body as {
      events: { id: number; paymentTotals: { paid: number; pending: number } }[]
    }
    const card = list.events.find((e) => e.id === eventId)!.paymentTotals
    expect(card).toEqual(expect.objectContaining({ paid: 1500, pending: 1500 }))
    expect(ledger.balance.income).toBe(card.paid)
    expect(ledger.awaiting).toEqual({ amount: card.pending, count: 1, currency: 'BYN' })
    expect(ledger.entries.find((e) => e.category === 'payment_income')).toMatchObject({
      amount: card.paid,
      method: 'cash',
    })
  })

  it('requires a comment for manual operations and records it', async () => {
    for (const kind of ['income', 'expense']) {
      const category = kind === 'income' ? 'donation' : 'rent'
      for (const description of [undefined, '', '   '])
        expect(
          (
            await request('POST', `${base()}/ledger/${kind}`, {
              user: owner,
              body: { category, amount: 500, description },
            })
          ).status,
        ).toBe(422)
    }
    const ok = await request('POST', `${base()}/ledger/expense`, {
      user: owner,
      body: { category: 'rent', amount: 400, description: '=Аренда зала' },
    })
    expect(ok.status).toBe(200)
    expect(
      (
        await request('POST', `${base()}/ledger/income`, {
          user: owner,
          body: { category: 'donation', amount: 250, description: 'Донат' },
        })
      ).status,
    ).toBe(200)
    const ledger = (await request('GET', `${base()}/ledger`, { user: owner })).body as LedgerBody
    expect(ledger.balance).toMatchObject({ income: 1750, expense: 400, balance: 1350 })
  })

  it('filters by type, category, period and pages the journal', async () => {
    const q = (qs: string) =>
      request('GET', `${base()}/ledger?${qs}`, { user: owner }).then((r) => r.body as LedgerBody)
    expect((await q('type=expense')).entries.map((e) => e.category)).toEqual(['rent'])
    expect((await q('category=donation')).entries).toHaveLength(1)
    expect((await q('limit=1&offset=1')).entries).toHaveLength(1)
    const future = new Date(Date.now() + 40 * 86_400_000).toISOString()
    expect((await q(`from=${encodeURIComponent(future)}`)).entries).toHaveLength(0)
    const all = await q(
      `from=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`,
    )
    expect(all.entries).toHaveLength(3)
    // totals are not narrowed by filters: they match the Mini App and the event card
    expect((await q('type=expense')).balance.income).toBe(1750)
    for (const bad of ['type=x', 'category=hack', 'from=abc', 'limit=-1', 'offset=x'])
      expect((await request('GET', `${base()}/ledger?${bad}`, { user: owner })).status).toBe(422)
  })

  it('exports the filtered journal as CSV for managers only and neutralises formulas', async () => {
    const res = await request('GET', `${base()}/ledger/export?type=expense`, { user: owner })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="cashbox-.*\.csv"/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const lines = res.text.replace('﻿', '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('Дата;Тип;Категория;Описание;Событие;Способ;Сумма;Валюта;Плательщик;Внёс')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain(";Расход;Аренда;'=Аренда зала;")
    expect(lines[1]).toContain(';4,00;BYN;')

    for (const user of [player, outsider])
      expect((await request('GET', `${base()}/ledger/export`, { user })).status).toBe(403)
    expect((await request('GET', `${base()}/ledger/export`)).status).toBe(401)
    expect((await request('GET', `${base()}/ledger/export?from=abc`, { user: owner })).status).toBe(
      422,
    )
  })

  it('isolates the cash desk between groups and roles', async () => {
    // чужая группа: событие чужой организации не принимается, свои деньги чужим не видны
    expect(
      (
        await request('POST', `${base()}/ledger/expense`, {
          user: owner,
          body: { category: 'rent', amount: 100, description: 'x', eventId: foreignEventId },
        })
      ).status,
    ).toBe(404)
    const foreign = await request('GET', `/api/organizations/${otherOrgId}/ledger`, { user: owner })
    expect(foreign.status).toBe(403)
    expect(
      (await request('GET', `/api/organizations/${otherOrgId}/ledger/export`, { user: owner }))
        .status,
    ).toBe(403)
    expect((await request('GET', `${base()}/ledger`, { user: player })).status).toBe(403)
    expect((await request('GET', `${base()}/ledger`, { user: outsider })).status).toBe(403)
    const mine = (
      await request('GET', `/api/organizations/${otherOrgId}/ledger`, {
        user: outsiderOwner,
      })
    ).body as LedgerBody
    expect(mine.balance.income).toBe(0)
    expect(mine.awaiting.amount).toBe(0)
  })
})
