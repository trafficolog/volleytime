import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, ledgerEntries, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

interface LedgerBody {
  balance: { income: number; expense: number; balance: number }
  period: { income: number; expense: number }
  entries: { id: number; category: string; type: string; amount: number; method: string | null }[]
}

/** Способ оплаты ручной записи и категории «Мячи» / «Судья» / «Тренер» (21.2.19), по HTTP. */
describe('cash desk payment method and new expense categories (HTTP)', () => {
  let request: Api
  let owner: number
  let player: number
  let outsider: number
  let otherOwner: number
  let orgId: number
  let otherOrgId: number

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
        { name: 'Other owner' },
      ])
      .returning()
    owner = people[0]!.id
    player = people[1]!.id
    outsider = people[2]!.id
    otherOwner = people[3]!.id
    orgId = (await organizationService.create({ userId: owner }, { name: 'Method desk' })).id
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: player })
    otherOrgId = (await organizationService.create({ userId: otherOwner }, { name: 'Foreign' })).id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  const base = () => `/api/organizations/${orgId}`
  const post = (kind: 'income' | 'expense', body: Record<string, unknown>, user = owner) =>
    request('POST', `${base()}/ledger/${kind}`, { user, body })
  const ledger = async (qs = '', org = orgId, user = owner) =>
    (await request('GET', `/api/organizations/${org}/ledger${qs}`, { user })).body as LedgerBody

  it('stores cash, transfer and no method; the journal returns each', async () => {
    const make = (category: string, extra: Record<string, unknown> = {}) =>
      post('expense', { category, amount: 1000, description: category, ...extra })
    expect((await make('balls', { method: 'cash' })).status).toBe(200)
    expect((await make('referee', { method: 'transfer' })).status).toBe(200)
    expect((await make('coach')).status).toBe(200)
    expect(
      (
        await post('income', {
          category: 'donation',
          amount: 300,
          description: 'Донат',
          method: 'transfer',
        })
      ).status,
    ).toBe(200)

    const body = await ledger()
    const byCategory = new Map(body.entries.map((e) => [e.category, e.method]))
    expect(byCategory.get('balls')).toBe('cash')
    expect(byCategory.get('referee')).toBe('transfer')
    expect(byCategory.get('coach')).toBeNull()
    expect(byCategory.get('donation')).toBe('transfer')
    // суммы кассы не зависят от способа
    expect(body.balance).toMatchObject({ income: 300, expense: 3000, balance: -2700 })
    expect(body.period).toMatchObject({ income: 300, expense: 3000 })
    // фильтр по новой категории
    expect((await ledger('?category=referee')).entries.map((e) => e.method)).toEqual(['transfer'])
  })

  it('rejects an invalid method and categories outside the type with 422', async () => {
    for (const method of ['online', 'card', '', 'CASH', 1, null, {}])
      expect(
        (await post('expense', { category: 'balls', amount: 100, description: 'x', method }))
          .status,
        String(method),
      ).toBe(422)
    // новые категории — только расходы
    for (const category of ['balls', 'referee', 'coach'])
      expect(
        (await post('income', { category, amount: 100, description: 'x', method: 'cash' })).status,
      ).toBe(422)
    expect((await request('GET', `${base()}/ledger?category=hack`, { user: owner })).status).toBe(
      422,
    )
    // отказы ничего не записали
    expect((await ledger()).entries.filter((e) => e.amount === 100)).toHaveLength(0)
  })

  it('exports the method and the new category labels in the CSV', async () => {
    const res = await request('GET', `${base()}/ledger/export?type=expense`, { user: owner })
    expect(res.status).toBe(200)
    const rows = res.text.replace('﻿', '').trimEnd().split('\r\n').slice(1)
    const find = (label: string) => rows.find((r) => r.includes(`;${label};`))!
    expect(find('Мячи')).toContain(';Наличные;10,00;')
    expect(find('Судья')).toContain(';Перевод;10,00;')
    expect(find('Тренер')).toMatch(/;Тренер;[^;]*;;;10,00;/)
  })

  it('does not let a player or an outsider create or read entries with a method', async () => {
    const before = (
      await db.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, orgId))
    ).length
    for (const user of [player, outsider])
      for (const kind of ['income', 'expense'] as const)
        expect(
          (
            await post(
              kind,
              {
                category: kind === 'income' ? 'donation' : 'balls',
                amount: 500,
                description: 'x',
                method: 'cash',
              },
              user,
            )
          ).status,
        ).toBe(403)
    expect(
      (
        await request('POST', `${base()}/ledger/expense`, {
          body: { category: 'balls', amount: 500, description: 'x', method: 'cash' },
        })
      ).status,
    ).toBe(401)
    for (const user of [player, outsider]) {
      expect((await request('GET', `${base()}/ledger`, { user })).status).toBe(403)
      expect((await request('GET', `${base()}/ledger/export`, { user })).status).toBe(403)
    }
    const after = (
      await db.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, orgId))
    ).length
    expect(after).toBe(before)
  })

  it('keeps entries with a method inside their own group (IDOR)', async () => {
    // владелец чужой группы не пишет в эту и не читает её записи с методом
    expect(
      (
        await request('POST', `/api/organizations/${orgId}/ledger/expense`, {
          user: otherOwner,
          body: { category: 'referee', amount: 500, description: 'x', method: 'transfer' },
        })
      ).status,
    ).toBe(403)
    expect(
      (await request('GET', `/api/organizations/${orgId}/ledger`, { user: otherOwner })).status,
    ).toBe(403)
    // запись в своей группе не появляется в чужой
    expect(
      (
        await request('POST', `/api/organizations/${otherOrgId}/ledger/expense`, {
          user: otherOwner,
          body: { category: 'coach', amount: 700, description: 'Тренер', method: 'cash' },
        })
      ).status,
    ).toBe(200)
    const mine = await ledger()
    expect(mine.entries.some((e) => e.amount === 700)).toBe(false)
    const theirs = await ledger('', otherOrgId, otherOwner)
    expect(theirs.entries).toHaveLength(1)
    expect(theirs.entries[0]).toMatchObject({ category: 'coach', method: 'cash' })
    expect(theirs.balance).toMatchObject({ income: 0, expense: 700 })
  })
})
