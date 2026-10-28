import {
  alias,
  and,
  bookings,
  desc,
  eq,
  events,
  gte,
  lt,
  ledgerEntries,
  payments,
  sql,
  users,
  type LedgerEntry,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { EventNotFoundError } from '../events/errors'

import { getDb, inTransaction, type ServiceContext } from '../shared/context'
import { resolveOrgCurrency } from '../shared/currency'

import { AddExpenseInput, AddIncomeInput } from './schemas'

export type LedgerCategory =
  | 'payment_income'
  | 'rent'
  | 'equipment'
  | 'refund'
  | 'salary'
  | 'other'
  | 'donation'
  | 'sponsorship'
  | 'other_income'
  | 'contribution'
  | 'carryover'

export interface CreateEntryParams {
  organizationId: number
  type: 'income' | 'expense'
  category: LedgerCategory
  amount: number // minor, положительное
  currency?: string
  paymentId?: number
  eventId?: number
  description?: string
  occurredAt?: Date
}

export interface CurrencyBalance {
  income: number
  expense: number
  balance: number
}

/** Баланс в валюте организации + разбивка по валютам (6.8.8). */
export interface Balance extends CurrencyBalance {
  currency: string
  byCurrency: Record<string, CurrencyBalance>
}

/** Предел строк выгрузки; при превышении кабинет просит сузить период. */
export const EXPORT_MAX_ROWS = 5000

export type LedgerHistoryEntry = Awaited<ReturnType<typeof listHistoryRows>>[number]

/** Ждущие оплаты деньги группы («Долги» кассы): платежи `pending` в валюте группы. */
export interface AwaitingMoney {
  amount: number
  count: number
  currency: string
}

export const ledgerService = {
  /** Создать запись кассы. Append-only. */
  async createEntry(ctx: ServiceContext, params: CreateEntryParams): Promise<LedgerEntry> {
    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw new Error('ledger: amount must be a positive integer (minor units)')
    }
    const [entry] = await getDb(ctx)
      .insert(ledgerEntries)
      .values({
        organizationId: params.organizationId,
        type: params.type,
        category: params.category,
        amount: params.amount,
        currency: params.currency ?? 'BYN',
        paymentId: params.paymentId ?? null,
        eventId: params.eventId ?? null,
        description: params.description ?? null,
        occurredAt: params.occurredAt ?? new Date(),
        createdByUserId: ctx.userId,
      })
      .returning()
    return entry!
  },

  /** Ручной расход организатора: zod-валидация, событие своей организации, audit (6.8.7). */
  async addExpense(
    ctx: ServiceContext,
    orgId: number,
    input: AddExpenseInput,
  ): Promise<LedgerEntry> {
    const data = AddExpenseInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      if (data.eventId) {
        const ev = await getDb(tx).query.events.findFirst({
          where: and(eq(events.id, data.eventId), eq(events.organizationId, orgId)),
          columns: { id: true },
        })
        if (!ev) throw new EventNotFoundError(data.eventId)
      }
      const entry = await this.createEntry(tx, {
        organizationId: orgId,
        currency: await resolveOrgCurrency(tx, orgId),
        type: 'expense',
        category: data.category,
        amount: data.amount,
        description: data.description,
        eventId: data.eventId,
        occurredAt: data.occurredAt,
      })
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.LEDGER_EXPENSE_ADDED,
        entityType: 'ledger_entry',
        entityId: entry.id,
        newValue: { category: data.category, amount: data.amount, eventId: data.eventId ?? null },
      })
      return entry
    })
  },

  /** Ручной доход организатора (6.8.9): без платежа, audit ledger.income_added. */
  async addIncome(ctx: ServiceContext, orgId: number, input: AddIncomeInput): Promise<LedgerEntry> {
    const data = AddIncomeInput.parse(input)
    return inTransaction(ctx, async (tx) => {
      if (data.eventId) {
        const ev = await getDb(tx).query.events.findFirst({
          where: and(eq(events.id, data.eventId), eq(events.organizationId, orgId)),
          columns: { id: true },
        })
        if (!ev) throw new EventNotFoundError(data.eventId)
      }
      const entry = await this.createEntry(tx, {
        organizationId: orgId,
        currency: await resolveOrgCurrency(tx, orgId),
        type: 'income',
        category: data.category,
        amount: data.amount,
        description: data.description,
        eventId: data.eventId,
        occurredAt: data.occurredAt,
      })
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.LEDGER_INCOME_ADDED,
        entityType: 'ledger_entry',
        entityId: entry.id,
        newValue: { category: data.category, amount: data.amount },
      })
      return entry
    })
  },

  /** Баланс = SUM(income) − SUM(expense), сгруппировано по валюте; валюты не складываются (6.8.8). */
  async getBalance(ctx: ServiceContext, orgId: number): Promise<Balance> {
    const rows = await getDb(ctx)
      .select({
        currency: ledgerEntries.currency,
        income: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::int`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::int`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.organizationId, orgId))
      .groupBy(ledgerEntries.currency)
    const currency = await resolveOrgCurrency(ctx, orgId)
    const byCurrency: Record<string, CurrencyBalance> = {}
    for (const r of rows) {
      byCurrency[r.currency] = {
        income: r.income,
        expense: r.expense,
        balance: r.income - r.expense,
      }
    }
    const main = byCurrency[currency] ?? { income: 0, expense: 0, balance: 0 }
    return { currency, ...main, byCurrency }
  },

  /**
   * Поступило и списано за период по дате операции (`from` включительно, `to` нет) в валюте
   * группы — плитки кассы кабинета. Баланс от периода не зависит и берётся из `getBalance`.
   */
  async getPeriodTotals(
    ctx: ServiceContext,
    orgId: number,
    period: { from?: Date; to?: Date } = {},
  ): Promise<{ income: number; expense: number; currency: string }> {
    const currency = await resolveOrgCurrency(ctx, orgId)
    const conds = [eq(ledgerEntries.organizationId, orgId), eq(ledgerEntries.currency, currency)]
    if (period.from) conds.push(gte(ledgerEntries.occurredAt, period.from))
    if (period.to) conds.push(lt(ledgerEntries.occurredAt, period.to))
    const [row] = await getDb(ctx)
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::int`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::int`,
      })
      .from(ledgerEntries)
      .where(and(...conds))
    return { income: row?.income ?? 0, expense: row?.expense ?? 0, currency }
  },

  /**
   * История операций для кассы (Task 6.8.12): дата операции, событие, кто внёс, плательщик —
   * только публичные поля. Сортировка по дате операции.
   */
  async listHistory(
    ctx: ServiceContext,
    orgId: number,
    opts: {
      type?: 'income' | 'expense'
      category?: LedgerCategory
      /** Дата операции не раньше (включительно) */
      from?: Date
      /** Дата операции раньше (не включительно) */
      to?: Date
      limit?: number
      offset?: number
    } = {},
  ) {
    return listHistoryRows(ctx, orgId, opts)
  },

  /** Строки для CSV-выгрузки: те же фильтры, что у журнала, но до `EXPORT_MAX_ROWS` записей. */
  async listForExport(
    ctx: ServiceContext,
    orgId: number,
    opts: {
      type?: 'income' | 'expense'
      category?: LedgerCategory
      from?: Date
      to?: Date
    } = {},
  ) {
    return listHistoryRows(ctx, orgId, { ...opts, limit: EXPORT_MAX_ROWS + 1 }, EXPORT_MAX_ROWS + 1)
  },

  /**
   * Деньги, которые группа ещё ждёт: сумма и число всех платежей `pending` организации в валюте
   * группы — за участие, абонементы и платежи, у которых запись удалена. Платежи в другой валюте,
   * отменённые и возвращённые не входят. Это шире «ждёт оплаты» в списке событий
   * (`readEventListMoney`): там только платежи записей события и валюта события.
   */
  async getAwaiting(ctx: ServiceContext, orgId: number): Promise<AwaitingMoney> {
    const currency = await resolveOrgCurrency(ctx, orgId)
    const [row] = await getDb(ctx)
      .select({
        // bigint приходит строкой
        amount: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, orgId),
          eq(payments.status, 'pending'),
          eq(payments.currency, currency),
        ),
      )
    return { amount: Number(row?.amount ?? 0), count: row?.count ?? 0, currency }
  },
}

async function listHistoryRows(
  ctx: ServiceContext,
  orgId: number,
  opts: {
    type?: 'income' | 'expense'
    category?: LedgerCategory
    from?: Date
    to?: Date
    limit?: number
    offset?: number
  },
  maxLimit = 200,
) {
  const conds = [eq(ledgerEntries.organizationId, orgId)]
  if (opts.type) conds.push(eq(ledgerEntries.type, opts.type))
  if (opts.category) conds.push(eq(ledgerEntries.category, opts.category))
  if (opts.from) conds.push(gte(ledgerEntries.occurredAt, opts.from))
  if (opts.to) conds.push(lt(ledgerEntries.occurredAt, opts.to))
  const author = alias(users, 'author')
  const payer = alias(users, 'payer')
  const rows = await getDb(ctx)
    .select({
      id: ledgerEntries.id,
      type: ledgerEntries.type,
      category: ledgerEntries.category,
      amount: ledgerEntries.amount,
      currency: ledgerEntries.currency,
      description: ledgerEntries.description,
      method: payments.method,
      occurredAt: ledgerEntries.occurredAt,
      createdAt: ledgerEntries.createdAt,
      eventId: events.id,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      authorName: author.name,
      authorUsername: author.telegramUsername,
      payerName: payer.name,
      payerUsername: payer.telegramUsername,
    })
    .from(ledgerEntries)
    .leftJoin(payments, eq(payments.id, ledgerEntries.paymentId))
    .leftJoin(bookings, eq(bookings.id, payments.bookingId))
    .leftJoin(events, eq(events.id, sql`COALESCE(${ledgerEntries.eventId}, ${bookings.eventId})`))
    .leftJoin(author, eq(author.id, ledgerEntries.createdByUserId))
    .leftJoin(payer, eq(payer.id, payments.userId))
    .where(and(...conds))
    .orderBy(desc(ledgerEntries.occurredAt), desc(ledgerEntries.id))
    .limit(Math.min(opts.limit ?? 50, maxLimit))
    .offset(opts.offset ?? 0)
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    amount: r.amount,
    currency: r.currency,
    description: r.description,
    method: r.method,
    occurredAt: r.occurredAt,
    createdAt: r.createdAt,
    event: r.eventId ? { id: r.eventId, title: r.eventTitle!, startsAt: r.eventStartsAt! } : null,
    author:
      r.authorName || r.authorUsername
        ? { name: r.authorName, telegramUsername: r.authorUsername }
        : null,
    payer:
      r.payerName || r.payerUsername
        ? { name: r.payerName, telegramUsername: r.payerUsername }
        : null,
  }))
}
