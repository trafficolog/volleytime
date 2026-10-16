import {
  and,
  appendEventBalanceEntry,
  asc,
  bookings,
  desc,
  eq,
  EVENT_BALANCE_DEMO_QUOTA,
  EventBalanceInsufficientError,
  eventBalanceEntries,
  eventBalancePurchaseRequests,
  events,
  hasEventBalanceEntryForEvent,
  lockEventBalance,
  ne,
  organizationEventBalances,
  sql,
  users,
  type Event,
  type EventBalanceEntry,
  type EventBalanceEntryInput,
  type EventBalancePurchaseRequest,
} from '@volley-time/db'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import {
  EVENT_BALANCE_LOW_THRESHOLD,
  EVENT_BALANCE_PACKAGES,
  isEventBalanceEnforced,
  type EventBalancePackage,
} from './config'
import { InsufficientEventBalanceError } from './errors'
import {
  CreatePurchaseRequestInput,
  encodeEventBalanceCursor,
  ListEventBalanceEntriesQuery,
  type CreatePurchaseRequestInput as CreateRequestInput,
  type ListEventBalanceEntriesQuery as ListEntriesQuery,
} from './schemas'

export interface EventBalanceView {
  balance: number
  lowThreshold: number
  /** «Баланс заканчивается»: остаток не больше порога. */
  low: boolean
  packages: readonly EventBalancePackage[]
  pendingRequests: Pick<
    EventBalancePurchaseRequest,
    'id' | 'units' | 'amount' | 'currency' | 'createdAt'
  >[]
}

export interface EventBalanceHistoryRow {
  id: number
  delta: number
  reason: EventBalanceEntry['reason']
  balanceAfter: number
  actorKind: EventBalanceEntry['actorKind']
  /** Автор-пользователь (без email/телефона, 5.13.2); у системных операций — null и `source`. */
  author: { id: number; name: string | null } | null
  source: string | null
  comment: string | null
  event: { id: number; title: string; startsAt: Date } | null
  purchaseRequestId: number | null
  createdAt: string
}

/** Провести операцию; нехватка баланса — доменная ошибка 409 (баланс никогда не уходит в минус). */
async function append(ctx: ServiceContext, input: EventBalanceEntryInput) {
  try {
    return await appendEventBalanceEntry(getDb(ctx), input)
  } catch (e) {
    if (e instanceof EventBalanceInsufficientError) throw new InsufficientEventBalanceError()
    throw e
  }
}

/**
 * Баланс событий организации (20.2.1, ADR v3 «Баланс событий»). Изменения баланса — только здесь
 * (публикация, отмена, demo-квота) и в операторской команде root (packages/db); прямой записи в
 * журнал через API нет. Методы, вызываемые из других сервисов, работают в транзакции вызывающего.
 */
export const eventBalanceService = {
  async get(ctx: ServiceContext, orgId: number): Promise<EventBalanceView> {
    const db = getDb(ctx)
    const [row] = await db
      .select({ balance: organizationEventBalances.balance })
      .from(organizationEventBalances)
      .where(eq(organizationEventBalances.organizationId, orgId))
    const balance = row?.balance ?? 0
    const pendingRequests = await db
      .select({
        id: eventBalancePurchaseRequests.id,
        units: eventBalancePurchaseRequests.units,
        amount: eventBalancePurchaseRequests.amount,
        currency: eventBalancePurchaseRequests.currency,
        createdAt: eventBalancePurchaseRequests.createdAt,
      })
      .from(eventBalancePurchaseRequests)
      .where(
        and(
          eq(eventBalancePurchaseRequests.organizationId, orgId),
          eq(eventBalancePurchaseRequests.status, 'pending'),
        ),
      )
      .orderBy(asc(eventBalancePurchaseRequests.createdAt), asc(eventBalancePurchaseRequests.id))
    return {
      balance,
      lowThreshold: EVENT_BALANCE_LOW_THRESHOLD,
      low: balance <= EVENT_BALANCE_LOW_THRESHOLD,
      packages: EVENT_BALANCE_PACKAGES,
      pendingRequests,
    }
  },

  /** История операций с причиной и автором; keyset `(created_at, id) DESC`. */
  async listEntries(
    ctx: ServiceContext,
    orgId: number,
    query: ListEntriesQuery,
  ): Promise<{ entries: EventBalanceHistoryRow[]; nextCursor: string | null }> {
    const opts = ListEventBalanceEntriesQuery.parse(query)
    const conds = [eq(eventBalanceEntries.organizationId, orgId)]
    if (opts.cursor) {
      conds.push(
        sql`(${eventBalanceEntries.createdAt}, ${eventBalanceEntries.id}) < (${opts.cursor.createdAt}::timestamptz, ${opts.cursor.id})`,
      )
    }
    const rows = await getDb(ctx)
      .select({
        id: eventBalanceEntries.id,
        delta: eventBalanceEntries.delta,
        reason: eventBalanceEntries.reason,
        balanceAfter: eventBalanceEntries.balanceAfter,
        actorKind: eventBalanceEntries.actorKind,
        authorId: users.id,
        authorName: users.name,
        source: eventBalanceEntries.source,
        comment: eventBalanceEntries.comment,
        eventId: events.id,
        eventTitle: events.title,
        eventStartsAt: events.startsAt,
        purchaseRequestId: eventBalanceEntries.purchaseRequestId,
        createdAt: sql<string>`to_char(${eventBalanceEntries.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(eventBalanceEntries)
      .leftJoin(users, eq(users.id, eventBalanceEntries.createdByUserId))
      // событие — только своей группы (IDOR: журнал не раскрывает чужие события)
      .leftJoin(
        events,
        and(eq(events.id, eventBalanceEntries.eventId), eq(events.organizationId, orgId)),
      )
      .where(and(...conds))
      .orderBy(desc(eventBalanceEntries.createdAt), desc(eventBalanceEntries.id))
      .limit(opts.limit + 1)
    const page = rows.slice(0, opts.limit)
    const last = page.at(-1)
    return {
      entries: page.map((r) => ({
        id: r.id,
        delta: r.delta,
        reason: r.reason,
        balanceAfter: r.balanceAfter,
        actorKind: r.actorKind,
        author: r.authorId === null ? null : { id: r.authorId, name: r.authorName },
        source: r.source,
        comment: r.comment,
        event:
          r.eventId === null
            ? null
            : { id: r.eventId, title: r.eventTitle!, startsAt: r.eventStartsAt! },
        purchaseRequestId: r.purchaseRequestId,
        createdAt: r.createdAt,
      })),
      nextCursor:
        rows.length > opts.limit && last
          ? encodeEventBalanceCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    }
  },

  /** Заявка на покупку пакета (D-07: без онлайн-оплаты); баланс меняет только подтверждение root. */
  async createPurchaseRequest(
    ctx: ServiceContext,
    orgId: number,
    input: CreateRequestInput,
  ): Promise<EventBalancePurchaseRequest> {
    const data = CreatePurchaseRequestInput.parse(input)
    const pkg = EVENT_BALANCE_PACKAGES.find((p) => p.code === data.packageCode)!
    return inTransaction(ctx, async (tx) => {
      const [request] = await getDb(tx)
        .insert(eventBalancePurchaseRequests)
        .values({
          organizationId: orgId,
          requestedByUserId: tx.userId,
          units: pkg.units,
          amount: pkg.amount,
          currency: pkg.currency,
        })
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.EVENT_BALANCE_PURCHASE_REQUESTED,
        entityType: 'event_balance_purchase_request',
        entityId: request!.id,
        newValue: {
          packageCode: pkg.code,
          units: pkg.units,
          amount: pkg.amount,
          currency: pkg.currency,
        },
      })
      return request!
    })
  },

  /** Demo-квота новой группы — в транзакции создания организации. */
  async grantDemoQuota(ctx: ServiceContext, orgId: number): Promise<EventBalanceEntry> {
    return append(ctx, {
      organizationId: orgId,
      delta: EVENT_BALANCE_DEMO_QUOTA,
      reason: 'demo_grant',
      actor: { kind: 'system', source: 'org-create' },
      comment: `Demo-квота новой группы: ${EVENT_BALANCE_DEMO_QUOTA} событий`,
    })
  },

  /**
   * Списание при публикации (создание опубликованным или draft → published, D-04). Вызывать в
   * транзакции события после его блокировки (advisory-lock + FOR UPDATE) или для нового события.
   * Повторная публикация того же события не списывает второй раз. Выключатель — EVENT_BALANCE_ENFORCED.
   */
  async spendOnPublish(
    ctx: ServiceContext,
    event: Pick<Event, 'id' | 'organizationId'>,
  ): Promise<EventBalanceEntry | null> {
    if (!isEventBalanceEnforced(process.env.EVENT_BALANCE_ENFORCED)) return null
    const db = getDb(ctx)
    // предусловия — под блокировкой строки проекции (ADR, шаг 3)
    await lockEventBalance(db, event.organizationId)
    if (await hasEventBalanceEntryForEvent(db, event.id, 'spend')) return null
    return append(ctx, {
      organizationId: event.organizationId,
      delta: -1,
      reason: 'spend',
      eventId: event.id,
      actor: { kind: 'user', userId: ctx.userId },
    })
  },

  /**
   * Возврат при отмене (D-09, D-13): только если за событие списывали и ещё не возвращали, и в нём
   * нет ни одной неотменённой записи (лист ожидания тоже блокирует). Вызывается в транзакции
   * `events.cancel` после блокировки события и ДО цикла отмены записей.
   * Отмена до открытия записи (`booking_opens_at` в будущем, 20.3.1) возвращает баланс и при записях.
   */
  async refundOnCancel(
    ctx: ServiceContext,
    event: Pick<Event, 'id' | 'organizationId'> & Partial<Pick<Event, 'bookingOpensAt'>>,
  ): Promise<EventBalanceEntry | null> {
    const db = getDb(ctx)
    // spend по событию пишется только под его advisory-lock, который держит вызывающий: без списания
    // возврата нет, и строку проекции не трогаем (события пилота R0.7, выключенное списание)
    if (!(await hasEventBalanceEntryForEvent(db, event.id, 'spend'))) return null
    // остальные предусловия — под блокировкой строки проекции (ADR, шаг 3)
    await lockEventBalance(db, event.organizationId)
    if (await hasEventBalanceEntryForEvent(db, event.id, 'refund')) return null
    // D-09: отмена до открытия записи возвращает баланс независимо от записей (20.3.1)
    const beforeOpening = event.bookingOpensAt != null && new Date() < event.bookingOpensAt
    const [active] = beforeOpening
      ? []
      : await db
          .select({ id: bookings.id })
          .from(bookings)
          .where(and(eq(bookings.eventId, event.id), ne(bookings.status, 'cancelled')))
          .limit(1)
    if (active) return null
    return append(ctx, {
      organizationId: event.organizationId,
      delta: 1,
      reason: 'refund',
      eventId: event.id,
      actor: { kind: 'user', userId: ctx.userId },
    })
  },
}
