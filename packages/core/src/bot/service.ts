import {
  and,
  asc,
  bookings,
  db,
  desc,
  eq,
  events,
  gt,
  inArray,
  ne,
  organizationMembers,
  organizations,
  users,
  venues,
  waitlistOffers,
} from '@volley-time/db'

import {
  BookingCancellationNotAllowedError,
  BookingDeadlinePassedError,
  BookingNotCancellableError,
  EventNotBookableError,
  WaitlistOfferExpiredError,
  WaitlistOfferNotFoundError,
} from '../bookings/errors'
import { takenSeatsSql } from '../bookings/seats'
import { bookingService } from '../bookings/service'
import type { PendingNotification } from '../notifier/types'

/** Сколько строк бот показывает в списках (`/games`, `/my`): сообщение остаётся коротким. */
const LIST_LIMIT = 5
/** Участники, которым бот может показывать данные группы. */
const ACTIVE_STATUSES = ['active'] as const

export interface BotGame {
  eventId: number
  title: string
  startsAt: string
  timeZone: string
  organizationName: string
  venueName: string | null
  capacity: number
  taken: number
}

export interface BotBooking {
  eventId: number
  bookingId: number
  title: string
  startsAt: string
  timeZone: string
  organizationName: string
  venueName: string | null
  status: 'confirmed' | 'pending_payment' | 'waitlisted' | 'attended' | 'no_show'
  seats: number
}

export type CancelOutcome = 'cancelled' | 'already_cancelled' | 'not_found' | 'not_allowed'
export type AcceptOutcome = 'accepted' | 'expired' | 'closed' | 'not_found'

const TELEGRAM_ID_RE = /^\d{1,15}$/

/**
 * Пользователь по Telegram id, пришедшему от бота (внутренний канал под секретом). Любое
 * действие выполняется только над данными этого пользователя — id записей и событий из
 * callback_data авторизуются здесь, а не принимаются на веру (20.3.3).
 */
async function userByTelegramId(telegramId: string): Promise<number | null> {
  if (!TELEGRAM_ID_RE.test(telegramId)) return null
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.telegramUserId, BigInt(telegramId)), eq(users.isActive, true)))
  return u?.id ?? null
}

const memberOrgs = (userId: number) =>
  db
    .select({ id: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        inArray(organizationMembers.status, [...ACTIVE_STATUSES]),
      ),
    )

/** Запись пользователя на событие, если он действующий участник группы события. */
async function ownBooking(userId: number, eventId: number) {
  if (!Number.isInteger(eventId) || eventId <= 0) return null
  const [row] = await db
    .select({ booking: bookings })
    .from(bookings)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, bookings.organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(bookings.eventId, eventId),
        eq(bookings.userId, userId),
        inArray(organizationMembers.status, [...ACTIVE_STATUSES]),
      ),
    )
  return row?.booking ?? null
}

export const botService = {
  /**
   * Бот снова доступен (входящее обновление: `/start`, `my_chat_member` со статусом `member`):
   * снять `users.bot_blocked_at` (20.3.2). Неизвестный пользователь — no-op.
   */
  async markReachable(telegramId: string): Promise<boolean> {
    const userId = await userByTelegramId(telegramId)
    if (userId === null) return false
    await db.update(users).set({ botBlockedAt: null }).where(eq(users.id, userId))
    return true
  },

  /** Ближайшие опубликованные события групп пользователя (`/games`). */
  async listGames(telegramId: string): Promise<BotGame[]> {
    const userId = await userByTelegramId(telegramId)
    if (userId === null) return []
    const rows = await db
      .select({
        eventId: events.id,
        title: events.title,
        startsAt: events.startsAt,
        capacity: events.capacity,
        timeZone: organizations.defaultTimezone,
        organizationName: organizations.name,
        venueName: venues.name,
      })
      .from(events)
      .innerJoin(organizations, eq(organizations.id, events.organizationId))
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(
        and(
          eq(events.status, 'published'),
          gt(events.startsAt, new Date()),
          inArray(events.organizationId, memberOrgs(userId)),
        ),
      )
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(LIST_LIMIT)
    if (rows.length === 0) return []
    const taken = await db
      .select({ eventId: bookings.eventId, taken: takenSeatsSql })
      .from(bookings)
      .where(
        inArray(
          bookings.eventId,
          rows.map((r) => r.eventId),
        ),
      )
      .groupBy(bookings.eventId)
    const takenBy = new Map(taken.map((t) => [t.eventId, t.taken]))
    return rows.map((r) => ({
      ...r,
      startsAt: r.startsAt.toISOString(),
      taken: takenBy.get(r.eventId) ?? 0,
    }))
  },

  /** Предстоящие записи пользователя без отменённых (`/my`). */
  async listMyBookings(telegramId: string): Promise<BotBooking[]> {
    const userId = await userByTelegramId(telegramId)
    if (userId === null) return []
    const rows = await db
      .select({
        eventId: events.id,
        bookingId: bookings.id,
        title: events.title,
        startsAt: events.startsAt,
        status: bookings.status,
        seats: bookings.seats,
        timeZone: organizations.defaultTimezone,
        organizationName: organizations.name,
        venueName: venues.name,
      })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .innerJoin(organizations, eq(organizations.id, events.organizationId))
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(
        and(
          eq(bookings.userId, userId),
          ne(bookings.status, 'cancelled'),
          gt(events.startsAt, new Date()),
          inArray(events.organizationId, memberOrgs(userId)),
        ),
      )
      .orderBy(asc(events.startsAt), asc(bookings.id))
      .limit(LIST_LIMIT)
    return rows.map((r) => ({
      ...r,
      startsAt: r.startsAt.toISOString(),
      status: r.status as BotBooking['status'],
    }))
  },

  /**
   * Отмена своей записи на событие по кнопке бота. Правила те же, что у `bookingService.cancel`
   * (срок, политика группы, начавшееся событие); повтор — `already_cancelled`.
   */
  async cancelMyBooking(
    telegramId: string,
    eventId: number,
    notifications?: PendingNotification[],
  ): Promise<CancelOutcome> {
    const userId = await userByTelegramId(telegramId)
    if (userId === null) return 'not_found'
    const booking = await ownBooking(userId, eventId)
    if (!booking) return 'not_found'
    if (booking.status === 'cancelled') return 'already_cancelled'
    try {
      await bookingService.cancel({ userId, notifications }, booking.id)
      return 'cancelled'
    } catch (e) {
      if (
        e instanceof BookingCancellationNotAllowedError ||
        e instanceof BookingNotCancellableError ||
        e instanceof BookingDeadlinePassedError
      )
        return 'not_allowed'
      throw e
    }
  },

  /** Принять своё предложение места из листа ожидания; повтор — `accepted`. */
  async acceptMyOffer(
    telegramId: string,
    eventId: number,
    notifications?: PendingNotification[],
  ): Promise<AcceptOutcome> {
    const userId = await userByTelegramId(telegramId)
    if (userId === null) return 'not_found'
    const booking = await ownBooking(userId, eventId)
    if (!booking) return 'not_found'
    const [offer] = await db
      .select({ id: waitlistOffers.id, status: waitlistOffers.status })
      .from(waitlistOffers)
      .where(eq(waitlistOffers.bookingId, booking.id))
      .orderBy(desc(waitlistOffers.id))
      .limit(1)
    if (!offer) return 'not_found'
    if (offer.status === 'accepted') return 'accepted'
    try {
      await bookingService.acceptWaitlistOffer({ userId, notifications }, offer.id, {
        organizationId: booking.organizationId,
      })
      return 'accepted'
    } catch (e) {
      if (e instanceof WaitlistOfferExpiredError) return 'expired'
      // запись закрыта или событие не открыто: предложение не истекло само, место принять нельзя
      if (e instanceof EventNotBookableError) return 'closed'
      if (e instanceof WaitlistOfferNotFoundError) return 'not_found'
      throw e
    }
  },
}
