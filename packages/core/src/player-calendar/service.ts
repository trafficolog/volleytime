import {
  and,
  asc,
  bookings,
  eq,
  events,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  organizationMembers,
  organizations,
} from '@volley-time/db'
import { zonedInputToDate } from '@volley-time/shared'
import { z } from 'zod'

import { eventService } from '../events/service'
import { getDb, type ServiceContext } from '../shared/context'

/** Ширина запроса в днях (включительно): месяц с запасом на соседние недели сетки. */
export const MAX_PLAYER_CALENDAR_DAYS = 62
/** Верхняя граница числа событий в ответе: игрок состоит в немногих группах, месяц — до сотни игр. */
const MAX_PLAYER_CALENDAR_EVENTS = 500

const IsoDay = z.iso.date()
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

/** `from`/`to` — даты `YYYY-MM-DD`, обе границы включительно, в часовом поясе каждой группы. */
export const PlayerCalendarQuery = z.object({ from: IsoDay, to: IsoDay }).superRefine((q, ctx) => {
  const days = dayNumber(q.to) - dayNumber(q.from) + 1
  if (days < 1)
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from' })
  else if (days > MAX_PLAYER_CALENDAR_DAYS)
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: `range must not exceed ${MAX_PLAYER_CALENDAR_DAYS} days`,
    })
})
export type PlayerCalendarQuery = z.input<typeof PlayerCalendarQuery>

export interface PlayerCalendarGroup {
  id: number
  name: string
  timezone: string
  logoUpdatedAt: Date | null
}

/** Игра в общем календаре: без цен, платежей и состава, только своя запись. */
export interface PlayerCalendarEvent {
  id: number
  organizationId: number
  title: string
  status: string
  startsAt: Date
  endsAt: Date
  capacity: number
  /** Занято мест (SUM(seats) записей в составе); свободно = capacity − taken. */
  taken: number
  venue: { name: string } | null
  locationText: string | null
  myBooking: { id: number; status: string; waitPos: number | null; waitlistSeats: number } | null
}

/**
 * Общий календарь игрока (23.2.2, M-10): игры всех его групп одним ответом. Группа попадает в
 * ответ, только если участие игрока `active`, а сама группа действует (не приостановлена, не
 * архивна и не удалена): те же условия, что у `resolveTenant` для маршрутов группы. События — те же,
 * что видит игрок в списке группы: без черновиков. Отменённое событие входит, только если у игрока
 * есть запись на него в любом статусе (23.2.4): запись отменяется вместе с событием, а различить «отменил сам» без схемы нельзя;
 * статус события в ответе (`status: 'cancelled'`) — клиент показывает такую игру приглушённой.
 */
export const playerCalendarService = {
  async list(
    ctx: ServiceContext,
    query: unknown,
  ): Promise<{ groups: PlayerCalendarGroup[]; events: PlayerCalendarEvent[] }> {
    const range = PlayerCalendarQuery.parse(query)
    const db = getDb(ctx)
    const memberships = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.userId, ctx.userId), eq(organizationMembers.status, 'active')),
      )
    if (memberships.length === 0) return { groups: [], events: [] }
    const groups = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        timezone: organizations.defaultTimezone,
        logoUpdatedAt: organizations.logoUpdatedAt,
      })
      .from(organizations)
      .where(
        and(
          inArray(
            organizations.id,
            memberships.map((m) => m.organizationId),
          ),
          eq(organizations.status, 'active'),
          isNull(organizations.deletedAt),
        ),
      )
      .orderBy(asc(organizations.id))
    if (groups.length === 0) return { groups: [], events: [] }

    const nextDay = new Date(Date.parse(`${range.to}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10)
    // границы дней — по поясу каждой группы; один запрос на все группы
    const perGroup = groups.map((g) =>
      and(
        eq(events.organizationId, g.id),
        gte(events.startsAt, zonedInputToDate(`${range.from}T00:00`, g.timezone)),
        lt(events.startsAt, zonedInputToDate(`${nextDay}T00:00`, g.timezone)),
      ),
    )
    const rows = await db
      .select({
        id: events.id,
        organizationId: events.organizationId,
        title: events.title,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        capacity: events.capacity,
        locationText: events.locationText,
      })
      .from(events)
      .where(
        and(
          or(...perGroup),
          ne(events.status, 'draft'),
          // отменённое событие остаётся, только если у игрока есть запись на него в любом статусе (23.2.4)
          or(
            ne(events.status, 'cancelled'),
            inArray(
              events.id,
              db
                .select({ id: bookings.eventId })
                .from(bookings)
                .where(eq(bookings.userId, ctx.userId)),
            ),
          ),
        ),
      )
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(MAX_PLAYER_CALENDAR_EVENTS)
    const stats = await eventService.statsFor(
      ctx,
      rows.map((r) => r.id),
    )
    return {
      groups,
      events: rows.map((r) => {
        const s = stats.get(r.id)!
        return {
          ...r,
          taken: s.taken,
          venue: s.venue ? { name: s.venue.name } : null,
          myBooking: s.myBooking
            ? {
                id: s.myBooking.id,
                status: s.myBooking.status,
                waitPos: s.myBooking.waitPos,
                waitlistSeats: s.myBooking.waitlistSeats,
              }
            : null,
        }
      }),
    }
  },
}
