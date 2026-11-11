import {
  and,
  asc,
  bookings,
  eq,
  events,
  inArray,
  isNull,
  notifications,
  organizationMembers,
  payments,
  sql,
  users,
  type DbOrTx,
} from '@volley-time/db'

/**
 * Виды ленты организатора (21.4.5). Тип записи в БД один — `organizer_action_required` (схема не
 * меняется, как у запроса приглашения 20.4.7), вид хранится в `payload.params.kind`. Ограничение:
 * по типу в БД эти уведомления не различаются, фильтры настроек по типу потребуют отдельной
 * карточки со схемой (ADR, Opus).
 *
 * Записи только для ленты: в Telegram они не уходят (`delivery_status = 'skipped'`, причина
 * `feed_only`), чтобы не дублировать «Заявку на оплату» бота и не слать сообщение на каждую запись.
 */
export type OrganizerFeedKind =
  'payments_pending' | 'booking_created' | 'booking_cancelled' | 'event_balance_low'

export const ORGANIZER_FEED_TYPE = 'organizer_action_required' as const

/** Ключ дедупликации: `organizer_action_required:<kind>:<сущность>` (ADR v3, «Лента уведомлений»). */
export const organizerFeedKey = (kind: OrganizerFeedKind, entity: string): string =>
  `${ORGANIZER_FEED_TYPE}:${kind}:${entity}`

type Role = 'owner' | 'organizer'

/** Получатели: активные управляющие группы, кроме `excludeUserId` (автор действия). */
async function recipientsOf(
  db: DbOrTx,
  organizationId: number,
  roles: Role[],
  excludeUserId?: number,
): Promise<number[]> {
  const rows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active'),
        inArray(organizationMembers.role, roles),
      ),
    )
  return rows.map((r) => r.userId).filter((id) => id !== excludeUserId)
}

export interface OrganizerFeedEntry {
  organizationId: number
  kind: OrganizerFeedKind
  /** Сущность ключа дедупликации (запись и её воплощение, запись баланса). */
  entity: string
  eventId?: number | null
  /** Кому: по умолчанию владелец и организаторы; пополнение баланса доступно только владельцу. */
  roles?: Role[]
  /** Автор действия: о собственном действии лента не пишется. */
  excludeUserId?: number
  params: Record<string, unknown>
}

/**
 * Записать вид ленты каждому получателю своей группы. Идемпотентно: повтор с тем же ключом ничего
 * не добавляет. Вызывать в транзакции действия: запись появляется только вместе с ним.
 */
export async function writeOrganizerFeed(db: DbOrTx, e: OrganizerFeedEntry): Promise<void> {
  const recipients = await recipientsOf(
    db,
    e.organizationId,
    e.roles ?? ['owner', 'organizer'],
    e.excludeUserId,
  )
  if (recipients.length === 0) return
  const payload = {
    template: ORGANIZER_FEED_TYPE,
    params: { ...e.params, kind: e.kind, organizationId: e.organizationId, eventId: e.eventId },
  }
  await db
    .insert(notifications)
    .values(
      recipients.map((recipientUserId) => ({
        recipientUserId,
        organizationId: e.organizationId,
        eventId: e.eventId ?? null,
        type: ORGANIZER_FEED_TYPE,
        dedupKey: organizerFeedKey(e.kind, e.entity),
        payload,
        deliveryStatus: 'skipped' as const,
        lastError: 'feed_only',
      })),
    )
    .onConflictDoNothing({ target: [notifications.recipientUserId, notifications.dedupKey] })
}

const COUNT_OF = sql`(payload #>> '{params,count}')::int`

/**
 * Агрегат «N платежей ждут подтверждения» (21.4.5). У каждого управляющего группы одна открытая
 * строка: число считается по платежам `pending` группы на сейчас, поэтому обработанные в счёт не
 * входят. Рост числа возвращает строку в непрочитанные; когда ожидающих не осталось, строка
 * закрывается (число 0, прочитана); следующий платёж открывает новую строку. Открытая строка живёт, пока есть
 * ожидающие; ключ новой — наименьший ожидающий платёж на момент открытия.
 * Пересчёт идемпотентен и самовосстанавливается: любое следующее событие платежей даёт верное число.
 */
export async function syncPendingPaymentsFeed(db: DbOrTx, organizationId: number): Promise<void> {
  const pending = await db
    .select({ id: payments.id, createdAt: payments.createdAt, eventTitle: events.title })
    .from(payments)
    .leftJoin(bookings, eq(bookings.id, payments.bookingId))
    .leftJoin(events, eq(events.id, bookings.eventId))
    .where(and(eq(payments.organizationId, organizationId), eq(payments.status, 'pending')))
    .orderBy(asc(payments.id))
  const first = pending[0]
  const openAggregates = and(
    eq(notifications.organizationId, organizationId),
    eq(notifications.type, ORGANIZER_FEED_TYPE),
    sql`payload #>> '{params,kind}' = 'payments_pending'`,
    sql`${COUNT_OF} > 0`,
  )
  if (!first) {
    await db
      .update(notifications)
      .set({
        readAt: sql`coalesce(${notifications.readAt}, now())`,
        payload: sql`jsonb_set(${notifications.payload}, '{params,count}', '0')`,
      })
      .where(openAggregates)
    return
  }
  // открытая «серия» продолжается под своим ключом; новая серия — по наименьшему ожидающему платежу
  const [open] = await db
    .select({ key: notifications.dedupKey })
    .from(notifications)
    .where(openAggregates)
    .orderBy(asc(notifications.id))
    .limit(1)
  const key =
    open?.key ?? organizerFeedKey('payments_pending', `org:${organizationId}:from:${first.id}`)

  const titles = [...new Set(pending.map((p) => p.eventTitle).filter((t): t is string => !!t))]
  const recipients = await recipientsOf(db, organizationId, ['owner', 'organizer'])
  if (recipients.length === 0) return
  const payload = {
    template: ORGANIZER_FEED_TYPE,
    params: {
      kind: 'payments_pending' as const,
      organizationId,
      count: pending.length,
      eventTitles: titles.slice(0, 2),
      moreEvents: Math.max(0, titles.length - 2),
      oldestAt: first.createdAt.toISOString(),
      target: 'payments',
    },
  }
  await db
    .insert(notifications)
    .values(
      recipients.map((recipientUserId) => ({
        recipientUserId,
        organizationId,
        type: ORGANIZER_FEED_TYPE,
        dedupKey: key,
        payload,
        deliveryStatus: 'skipped' as const,
        lastError: 'feed_only',
      })),
    )
    .onConflictDoUpdate({
      target: [notifications.recipientUserId, notifications.dedupKey],
      set: {
        payload: sql`excluded.payload`,
        readAt: sql`CASE WHEN (notifications.payload #>> '{params,count}')::int < (excluded.payload #>> '{params,count}')::int THEN NULL ELSE notifications.read_at END`,
      },
    })
}

interface BookingFeedRef {
  id: number
  incarnation: number
  userId: number
  organizationId: number
  seats: number
  waitlistSeats: number
}
interface EventFeedRef {
  id: number
  title: string
  startsAt: Date
}

async function playerNameOf(db: DbOrTx, userId: number): Promise<string> {
  const [u] = await db
    .select({ name: users.name, username: users.telegramUsername })
    .from(users)
    .where(eq(users.id, userId))
  return u?.name || (u?.username ? `@${u.username}` : 'Игрок')
}

/** «Новая запись» (21.4.5): одна строка на запись и её воплощение; сам записавшийся не уведомляется. */
export async function writeBookingCreatedFeed(
  db: DbOrTx,
  booking: BookingFeedRef,
  event: EventFeedRef,
  status: string,
): Promise<void> {
  await writeOrganizerFeed(db, {
    organizationId: booking.organizationId,
    kind: 'booking_created',
    entity: `booking:${booking.id}:${booking.incarnation}`,
    eventId: event.id,
    excludeUserId: booking.userId,
    params: {
      playerName: await playerNameOf(db, booking.userId),
      eventTitle: event.title,
      eventDate: event.startsAt.toISOString(),
      seats: booking.seats + booking.waitlistSeats,
      waitlisted: status === 'waitlisted',
    },
  })
}

/**
 * «Отмена записи» (21.4.5): места, оплаченные деньги и уход места первому из листа ожидания. Оплаченное
 * не возвращается автоматически (D-14) — организатор видит сумму и решает о возврате. `paid` считается
 * до освобождения мест, `promotedFromWaitlist` — после продвижения очереди.
 */
export async function writeBookingCancelledFeed(
  db: DbOrTx,
  booking: BookingFeedRef,
  event: EventFeedRef,
  extra: { paidSeats: number; paidAmount: number; currency: string; promotedFromWaitlist: boolean },
  actorUserId: number,
): Promise<void> {
  await writeOrganizerFeed(db, {
    organizationId: booking.organizationId,
    kind: 'booking_cancelled',
    entity: `booking:${booking.id}:${booking.incarnation}`,
    eventId: event.id,
    excludeUserId: actorUserId,
    params: {
      playerName: await playerNameOf(db, booking.userId),
      eventTitle: event.title,
      eventDate: event.startsAt.toISOString(),
      seats: booking.seats,
      ...extra,
    },
  })
}

/** Оплаченные места записи на момент отмены (живые `succeeded`-платежи воплощения). */
export async function paidSeatsOf(
  db: DbOrTx,
  booking: { id: number; incarnation: number },
): Promise<{ paidSeats: number; paidAmount: number; currency: string }> {
  const rows = await db
    .select({ amount: payments.amount, currency: payments.currency })
    .from(payments)
    .where(
      and(
        eq(payments.bookingId, booking.id),
        eq(payments.bookingIncarnation, booking.incarnation),
        eq(payments.status, 'succeeded'),
        isNull(payments.seatReleasedAt),
      ),
    )
  return {
    paidSeats: rows.length,
    paidAmount: rows.reduce((a, r) => a + r.amount, 0),
    currency: rows[0]?.currency ?? 'BYN',
  }
}
