import { closeDb, db, organizations, payments, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import { organizationService } from '../organizations/service'

import { ledgerService } from './service'

describe('ledgerService cabinet cash desk (integration)', () => {
  let userId: number
  let orgId: number
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [user] = await db.insert(users).values({ name: 'Owner' }).returning()
    userId = user!.id
    orgId = (await organizationService.create({ userId }, { name: 'Cash desk' })).id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('requires a non-blank comment on manual income and expense', async () => {
    const ctx = { userId }
    for (const description of [undefined, '', '   '] as string[]) {
      await expect(
        ledgerService.addIncome(ctx, orgId, {
          category: 'donation',
          amount: 100,
          description,
        }),
      ).rejects.toBeInstanceOf(ZodError)
      await expect(
        ledgerService.addExpense(ctx, orgId, { category: 'rent', amount: 100, description }),
      ).rejects.toBeInstanceOf(ZodError)
    }
    expect((await ledgerService.getBalance(ctx, orgId)).balance).toBe(0)
    const entry = await ledgerService.addIncome(ctx, orgId, {
      category: 'donation',
      amount: 100,
      description: '  Взнос Ивана  ',
    })
    expect(entry.description).toBe('Взнос Ивана')
  })

  it('filters history by period and category, paginates and exposes the payment method', async () => {
    const ctx = { userId }
    const at = (iso: string) => new Date(iso)
    await ledgerService.addExpense(ctx, orgId, {
      category: 'rent',
      amount: 4200,
      description: 'Аренда',
      occurredAt: at('2026-05-10T10:00:00Z'),
    })
    await ledgerService.addExpense(ctx, orgId, {
      category: 'equipment',
      amount: 1800,
      description: 'Мячи',
      occurredAt: at('2026-05-24T10:00:00Z'),
    })
    await ledgerService.addIncome(ctx, orgId, {
      category: 'donation',
      amount: 500,
      description: 'Донат',
      occurredAt: at('2026-06-02T10:00:00Z'),
    })
    const [payment] = await db
      .insert(payments)
      .values({ organizationId: orgId, userId, amount: 1500, currency: 'BYN', method: 'transfer' })
      .returning()
    await ledgerService.createEntry(ctx, {
      organizationId: orgId,
      type: 'income',
      category: 'payment_income',
      amount: 1500,
      paymentId: payment!.id,
      occurredAt: at('2026-05-28T10:00:00Z'),
    })

    const may = await ledgerService.listHistory(ctx, orgId, {
      from: at('2026-05-01T00:00:00Z'),
      to: at('2026-06-01T00:00:00Z'),
    })
    expect(may.map((e) => e.description ?? e.category)).toEqual([
      'payment_income',
      'Мячи',
      'Аренда',
    ])
    expect(may[0]!.method).toBe('transfer')
    expect(may[1]!.method).toBeNull()

    const rentOnly = await ledgerService.listHistory(ctx, orgId, { category: 'rent' })
    expect(rentOnly).toHaveLength(1)

    const page = await ledgerService.listHistory(ctx, orgId, { limit: 2, offset: 2 })
    expect(page.map((e) => e.description ?? e.category)).toEqual(['Мячи', 'Аренда'])
  })

  it('stores the payment method of a manual entry, with or without it (21.2.19)', async () => {
    const ctx = { userId }
    const base = { amount: 700, description: 'Операция' }
    const cash = await ledgerService.addExpense(ctx, orgId, {
      ...base,
      category: 'rent',
      method: 'cash',
    })
    const transfer = await ledgerService.addIncome(ctx, orgId, {
      ...base,
      category: 'donation',
      method: 'transfer',
    })
    const none = await ledgerService.addExpense(ctx, orgId, { ...base, category: 'rent' })
    expect([cash.method, transfer.method, none.method]).toEqual(['cash', 'transfer', null])
    for (const method of ['online', 'card', '', 'CASH'] as string[]) {
      await expect(
        ledgerService.addExpense(ctx, orgId, {
          ...base,
          category: 'rent',
          method: method as 'cash',
        }),
      ).rejects.toBeInstanceOf(ZodError)
    }
    const history = await ledgerService.listHistory(ctx, orgId)
    expect(new Map(history.map((e) => [e.id, e.method]))).toEqual(
      new Map([
        [cash.id, 'cash'],
        [transfer.id, 'transfer'],
        [none.id, null],
      ]),
    )
    // метод попадает в аудит записи
    const audit = await db.query.auditLog.findFirst({
      where: (a, { and, eq }) => and(eq(a.entityType, 'ledger_entry'), eq(a.entityId, cash.id)),
    })
    expect(audit?.newValue).toMatchObject({ category: 'rent', amount: 700, method: 'cash' })
  })

  it('accepts balls, referee and coach as expense categories only and sums them (21.2.19)', async () => {
    const ctx = { userId }
    for (const category of ['balls', 'referee', 'coach'] as const) {
      await ledgerService.addExpense(ctx, orgId, {
        category,
        amount: 1000,
        description: category,
        method: 'cash',
      })
      // это расходы: как доходы категории не принимаются
      await expect(
        ledgerService.addIncome(ctx, orgId, {
          category: category as 'donation',
          amount: 1000,
          description: category,
        }),
      ).rejects.toBeInstanceOf(ZodError)
    }
    const balance = await ledgerService.getBalance(ctx, orgId)
    expect(balance).toMatchObject({ income: 0, expense: 3000, balance: -3000 })
    expect(await ledgerService.getPeriodTotals(ctx, orgId)).toMatchObject({ expense: 3000 })
    const coach = await ledgerService.listHistory(ctx, orgId, { category: 'coach' })
    expect(coach.map((e) => [e.category, e.method])).toEqual([['coach', 'cash']])
  })

  it('keeps the payment method of a confirmed payment in the journal without a ledger method', async () => {
    const ctx = { userId }
    const [payment] = await db
      .insert(payments)
      .values({ organizationId: orgId, userId, amount: 1500, currency: 'BYN', method: 'transfer' })
      .returning()
    const entry = await ledgerService.createEntry(ctx, {
      organizationId: orgId,
      type: 'income',
      category: 'payment_income',
      amount: 1500,
      paymentId: payment!.id,
    })
    // записи платежей игроков способ в ledger не хранят (21.2.19): он выводится из платежа при чтении
    expect(entry.method).toBeNull()
    const [row] = await ledgerService.listHistory(ctx, orgId)
    expect(row!.method).toBe('transfer')
  })

  it('sums only pending payments of the group in the group currency as awaiting money', async () => {
    const ctx = { userId }
    await db.insert(payments).values([
      { organizationId: orgId, userId, amount: 1500, currency: 'BYN', method: 'cash' },
      { organizationId: orgId, userId, amount: 500, currency: 'BYN', method: 'cash' },
      {
        organizationId: orgId,
        userId,
        amount: 700,
        currency: 'BYN',
        method: 'cash',
        status: 'succeeded',
      },
      {
        organizationId: orgId,
        userId,
        amount: 800,
        currency: 'BYN',
        method: 'cash',
        status: 'cancelled',
      },
      { organizationId: orgId, userId, amount: 900, currency: 'USD', method: 'cash' },
    ])
    const other = await organizationService.create({ userId }, { name: 'Other' })
    await db
      .insert(payments)
      .values({ organizationId: other.id, userId, amount: 9999, currency: 'BYN', method: 'cash' })
    expect(await ledgerService.getAwaiting(ctx, orgId)).toEqual({
      amount: 2000,
      count: 2,
      currency: 'BYN',
    })
  })

  it('totals income and expense over a period without touching the all-time balance', async () => {
    const ctx = { userId }
    const at = (iso: string) => new Date(iso)
    await ledgerService.addExpense(ctx, orgId, {
      category: 'rent',
      amount: 4200,
      description: 'Аренда',
      occurredAt: at('2026-05-10T10:00:00Z'),
    })
    await ledgerService.addIncome(ctx, orgId, {
      category: 'donation',
      amount: 500,
      description: 'Донат',
      occurredAt: at('2026-05-31T20:59:59Z'),
    })
    await ledgerService.addIncome(ctx, orgId, {
      category: 'donation',
      amount: 700,
      description: 'Июнь',
      occurredAt: at('2026-05-31T21:00:00Z'),
    })
    const may = { from: at('2026-04-30T21:00:00Z'), to: at('2026-05-31T21:00:00Z') }
    expect(await ledgerService.getPeriodTotals(ctx, orgId, may)).toEqual({
      income: 500,
      expense: 4200,
      currency: 'BYN',
    })
    const all = await ledgerService.getPeriodTotals(ctx, orgId)
    const balance = await ledgerService.getBalance(ctx, orgId)
    expect(all).toMatchObject({ income: balance.income, expense: balance.expense })
    expect(balance.balance).toBe(500 + 700 - 4200)
  })
})
