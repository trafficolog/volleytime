import {
  and,
  appendEventBalanceEntry,
  asc,
  bookings,
  desc,
  eq,
  EventBalanceInsufficientError,
  eventBalanceEntries,
  eventBalancePackages,
  eventBalancePurchaseRequests,
  events,
  hasEventBalanceEntryForEvent,
  isNull,
  lockEventBalance,
  ne,
  organizationEventBalances,
  organizations,
  sql,
  users,
  type Event,
  type EventBalanceEntry,
  type EventBalanceEntryInput,
  type EventBalancePackageBadge,
  type EventBalancePurchaseRequest,
} from '@volley-time/db'

import { unlimitedLastDay, type EventBalanceUnlimited } from '@volley-time/shared'

import { AUDIT_ACTIONS } from '../audit/actions'
import { auditService } from '../audit/service'
import { writeOrganizerFeed } from '../notifier/organizer-feed'
import { getPlatformSettings } from '../platform/settings'
import { getDb, inTransaction, type ServiceContext } from '../shared/context'

import { EVENT_BALANCE_LOW_THRESHOLD, isEventBalanceEnforced } from './config'
import { EventBalancePackageUnavailableError, InsufficientEventBalanceError } from './errors'
import {
  CreatePurchaseRequestInput,
  encodeEventBalanceCursor,
  ListEventBalanceEntriesQuery,
  type CreatePurchaseRequestInput as CreateRequestInput,
  type ListEventBalanceEntriesQuery as ListEntriesQuery,
} from './schemas'

/** Пакет витрины организатора: видимый и не архивный (22.2.1). */
export interface EventBalanceStorefrontPackage {
  code: string
  units: number
  /** minor units */
  amount: number
  currency: string
  badge: EventBalancePackageBadge | null
  /** Производное от `badge = 'popular'`, для совместимости ответа. */
  popular: boolean
}

export interface EventBalanceView {
  balance: number
  /** Безлимит событий группы (22.3.1): последний день по Минску; `null` — безлимита нет или он истёк. */
  unlimited: EventBalanceUnlimited | null
  /** Контакт поддержки платформы (22.3.1, `general.supportContact`): «Вопросы по оплате — …»; `null` — не показывать. */
  supportContact: string | null
  lowThreshold: number
  /** «Баланс заканчивается»: остаток не больше порога. */
  low: boolean
  packages: EventBalanceStorefrontPackage[]
  pendingRequests: Pick<
    EventBalancePurchaseRequest,
    'id' | 'units' | 'amount' | 'currency' | 'createdAt'
  >[]
  /**
   * Решения платформы по заявкам за последние 30 дней (22.2.3), новые сверху, не больше 5:
   * подтверждённые и отклонённые; причина (`decisionComment`) только у отклонённых. Автор решения не раскрывается.
   */
  recentDecisions: (Pick<
    EventBalancePurchaseRequest,
    'id' | 'units' | 'amount' | 'currency' | 'createdAt' | 'decisionComment'
  > & { status: 'approved' | 'rejected'; decidedAt: Date })[]
}

/** Окно и предел «Решений по заявкам» в кабинете. */
const RECENT_DECISIONS_DAYS = 30
const RECENT_DECISIONS_LIMIT = 5

export interface EventBalanceHistoryRow {
  id: number
  delta: number
  reason: EventBalanceEntry['reason']
  balanceAfter: number
  actorKind: EventBalanceEntry['actorKind']
  /**
   * Автор-пользователь (без email/телефона, 5.13.2); у системных операций — null и `source`;
   * у `purchase` всегда null: root, подтвердивший заявку, организатору не раскрывается.
   */
  author: { id: number; name: string | null } | null
  source: string | null
  comment: string | null
  event: { id: number; title: string; startsAt: Date } | null
  purchaseRequestId: number | null
  createdAt: string
}

/**
 * Безлимит группы активен (22.3.1): исключающая граница в будущем. Время — часы приложения (как у
 * остальных проверок срока), поэтому тесты фиксируют его фейковыми таймерами.
 */
export async function readActiveUnlimitedUntil(
  ctx: ServiceContext,
  orgId: number,
  now: Date = new Date(),
): Promise<Date | null> {
  const [row] = await getDb(ctx)
    .select({ until: organizations.eventBalanceUnlimitedUntil })
    .from(organizations)
    .where(eq(organizations.id, orgId))
  return row?.until && row.until > now ? row.until : null
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
    const unlimitedUntil = await readActiveUnlimitedUntil(ctx, orgId)
    const catalog = await db
      .select({
        code: eventBalancePackages.code,
        units: eventBalancePackages.units,
        amount: eventBalancePackages.amount,
        currency: eventBalancePackages.currency,
        badge: eventBalancePackages.badge,
      })
      .from(eventBalancePackages)
      .where(and(eq(eventBalancePackages.visible, true), isNull(eventBalancePackages.archivedAt)))
      .orderBy(
        asc(eventBalancePackages.sortOrder),
        asc(eventBalancePackages.units),
        asc(eventBalancePackages.id),
      )
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
    const decided = await db
      .select({
        id: eventBalancePurchaseRequests.id,
        units: eventBalancePurchaseRequests.units,
        amount: eventBalancePurchaseRequests.amount,
        currency: eventBalancePurchaseRequests.currency,
        createdAt: eventBalancePurchaseRequests.createdAt,
        // приватность: внутренний комментарий root к подтверждению организатору не отдаётся —
        // причина видна только у отклонённых заявок
        decisionComment: sql<
          string | null
        >`CASE WHEN ${eventBalancePurchaseRequests.status} = 'rejected' THEN ${eventBalancePurchaseRequests.decisionComment} END`,
        status: eventBalancePurchaseRequests.status,
        decidedAt: eventBalancePurchaseRequests.decidedAt,
      })
      .from(eventBalancePurchaseRequests)
      .where(
        and(
          eq(eventBalancePurchaseRequests.organizationId, orgId),
          sql`${eventBalancePurchaseRequests.status} IN ('approved', 'rejected')`,
          sql`${eventBalancePurchaseRequests.decidedAt} > now() - make_interval(days => ${RECENT_DECISIONS_DAYS})`,
        ),
      )
      .orderBy(desc(eventBalancePurchaseRequests.decidedAt), desc(eventBalancePurchaseRequests.id))
      .limit(RECENT_DECISIONS_LIMIT)
    const recentDecisions = decided.map((r) => ({
      ...r,
      status: r.status as 'approved' | 'rejected',
      decidedAt: r.decidedAt!,
    }))
    return {
      balance,
      unlimited: unlimitedUntil ? { until: unlimitedLastDay(unlimitedUntil) } : null,
      supportContact: (await getPlatformSettings(ctx))['general.supportContact'],
      lowThreshold: EVENT_BALANCE_LOW_THRESHOLD,
      low: balance <= EVENT_BALANCE_LOW_THRESHOLD,
      packages: catalog.map((p) => ({ ...p, popular: p.badge === 'popular' })),
      pendingRequests,
      recentDecisions,
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
        // покупка: подтвердивший root и его внутренний комментарий организатору не отдаются
        // (в журнале остаются для истории на стороне root); начисления `grant` — наоборот, 22.2.2
        author:
          r.authorId === null || r.reason === 'purchase'
            ? null
            : { id: r.authorId, name: r.authorName },
        source: r.source,
        comment: r.reason === 'purchase' ? null : r.comment,
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
    return inTransaction(ctx, async (tx) => {
      // FOR SHARE: правка, скрытие и архив пакета берут FOR UPDATE той же строки и сериализуются с
      // заявкой — она видит либо старую, либо новую версию целиком (ADR-22-2-1)
      const [pkg] = await getDb(tx)
        .select()
        .from(eventBalancePackages)
        .where(eq(eventBalancePackages.code, data.packageCode))
        .for('share')
      if (!pkg || !pkg.visible || pkg.archivedAt !== null) {
        throw new EventBalancePackageUnavailableError()
      }
      const [request] = await getDb(tx)
        .insert(eventBalancePurchaseRequests)
        .values({
          organizationId: orgId,
          requestedByUserId: tx.userId,
          units: pkg.units,
          amount: pkg.amount,
          currency: pkg.currency,
          packageId: pkg.id,
        })
        .returning()
      await auditService.record(tx, {
        organizationId: orgId,
        action: AUDIT_ACTIONS.EVENT_BALANCE_PURCHASE_REQUESTED,
        entityType: 'event_balance_purchase_request',
        entityId: request!.id,
        newValue: {
          packageId: pkg.id,
          packageCode: pkg.code,
          units: pkg.units,
          amount: pkg.amount,
          currency: pkg.currency,
        },
      })
      return request!
    })
  },

  /**
   * Стартовый баланс новой группы — в транзакции создания организации. Размер — настройка
   * `eventBalance.newOrganizationGrant` (22.3.1, по умолчанию 5; из кэша, устаревание до 30 с);
   * причина в журнале остаётся `demo_grant`.
   */
  async grantDemoQuota(ctx: ServiceContext, orgId: number): Promise<EventBalanceEntry> {
    const grant = (await getPlatformSettings(ctx))['eventBalance.newOrganizationGrant']
    return append(ctx, {
      organizationId: orgId,
      delta: grant,
      reason: 'demo_grant',
      actor: { kind: 'system', source: 'org-create' },
      comment: `Стартовый баланс новой группы: ${grant} событий`,
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
    // безлимит группы (22.3.1): проверка в момент публикации, списания и записи в журнале нет;
    // отмена такого события баланс не возвращает (нет `spend`). Истёкший безлимит — обычное списание
    if (await readActiveUnlimitedUntil(ctx, event.organizationId)) return null
    if (await hasEventBalanceEntryForEvent(db, event.id, 'spend')) return null
    const entry = await append(ctx, {
      organizationId: event.organizationId,
      delta: -1,
      reason: 'spend',
      eventId: event.id,
      actor: { kind: 'user', userId: ctx.userId },
    })
    // «Мало событий на балансе» (21.4.5): один раз при пересечении порога вниз; ключ — запись журнала,
    // поэтому пересчёт и повторные списания ниже порога не повторяют уведомление. Пополнить может
    // только владелец (заявка на пакет — requireOrgOwner), ему и пишем.
    if (
      entry.balanceAfter <= EVENT_BALANCE_LOW_THRESHOLD &&
      entry.balanceAfter - entry.delta > EVENT_BALANCE_LOW_THRESHOLD
    ) {
      await writeOrganizerFeed(db, {
        organizationId: event.organizationId,
        kind: 'event_balance_low',
        entity: `entry:${entry.id}`,
        roles: ['owner'],
        params: {
          balance: entry.balanceAfter,
          threshold: EVENT_BALANCE_LOW_THRESHOLD,
          target: 'balance',
        },
      })
    }
    return entry
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
