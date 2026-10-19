import {
  and,
  bookings,
  eq,
  events,
  inArray,
  organizationMembers,
  organizations,
  sql,
  venues,
} from '@volley-time/db'
import { quoteEventPrice, type EventPriceQuote } from '@volley-time/shared'

import { bookingService } from '../bookings/service'
import { OCCUPYING_STATUSES, takenSeatsSql } from '../bookings/seats'
import { getDb, systemContext, type ServiceContext } from '../shared/context'

import type { EventPriceQuoteView } from './pricing-read-model'

/** Идентификатор публичной страницы: 12 hex-символов, выдаёт БД (миграция 0030). */
export const PUBLIC_SLUG_RE = /^[0-9a-f]{12}$/

/** Записавшиеся игроки (COUNT) — не путать с занятыми местами (SUM seats). */
const playersSql = sql<number>`count(*) FILTER (WHERE ${inArray(bookings.status, [...OCCUPYING_STATUSES])})::int`

/** Меньше игроков — инициалы скрыты, остаётся счётчик (решение владельца 2026-10-19). */
export const MIN_INITIALS_PLAYERS = 3

/** Сколько инициалов показывает публичная страница (остальные — счётчиком «и ещё N»). */
const MAX_INITIALS = 5

export interface PublicEventView {
  slug: string
  event: {
    title: string
    description: string | null
    status: 'published' | 'closed' | 'finished' | 'cancelled'
    startsAt: string
    endsAt: string
    /** Место: название площадки или текст места; адрес — только у площадки. */
    place: { name: string | null; address: string | null }
    capacity: number
    /** Занятые места (SUM seats) и число записавшихся (COUNT) — разные величины. */
    taken: number
    players: number
    /** «Мест нет» — по занятости события, а не по цене (`seatCount` ограничен вместимостью). */
    full: boolean
    currency: string
    joinMode: 'open' | 'invite'
    bookingOpensAt: string | null
  }
  group: { name: string; city: string | null; timezone: string; memberCount: number }
  /** Цена для одного места — тот же расчёт, что `GET …/events/{id}/price`; у отменённого — null. */
  price: EventPriceQuoteView | null
  /** Только счётчики и инициалы: имена, аватары, ники, уровни и оплаты на публичную страницу не попадают. */
  roster: { initials: string[]; more: number }
  /** Параметр запуска бота (`event_<id>`); ссылку на бота собирает маршрут. */
  startParam: string
  /** Разрешено ли индексирование: `seoIndex` группы и событие не «по приглашению» и не отменено. */
  indexable: boolean
}

/** Инициалы до двух букв: «Никита Петров» → «НП», «Олег» → «О»; пустое имя — «·». */
export function initialsOf(name: string | null | undefined): string {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]!.toLocaleUpperCase('ru'))
  return letters.length > 0 ? letters.join('') : '·'
}

/**
 * Публичное чтение события по slug без авторизации (20.6.1, P-17). Скрытое — черновик, группа не
 * `active`, неверный или неизвестный slug — неотличимо: `null`. Цена считается `quoteEventPrice`
 * напрямую для одного места игрока без брони (то же, что `GET …/events/{id}/price` для не
 * записавшегося участника); состав читается без уровней игроков (решение владельца 2026-10-14).
 */
export async function readPublicEvent(
  slug: string,
  ctx: ServiceContext = systemContext(),
): Promise<PublicEventView | null> {
  if (!PUBLIC_SLUG_RE.test(slug)) return null
  const db = getDb(ctx)
  const [row] = await db
    .select({
      event: events,
      org: {
        id: organizations.id,
        name: organizations.name,
        city: organizations.city,
        timezone: organizations.defaultTimezone,
        status: organizations.status,
        seoIndex: organizations.seoIndex,
        subscriptionsEnabled: organizations.subscriptionsEnabled,
      },
      venueName: venues.name,
      venueAddress: venues.address,
    })
    .from(events)
    .innerJoin(organizations, eq(organizations.id, events.organizationId))
    .leftJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.publicSlug, slug))
    .limit(1)
  if (!row || row.event.status === 'draft' || row.org.status !== 'active') return null
  const { event: ev, org } = row
  const status = ev.status as PublicEventView['event']['status']

  const [counts] = await db
    .select({ taken: takenSeatsSql, players: playersSql })
    .from(bookings)
    .where(eq(bookings.eventId, ev.id))
  const [members] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.status, 'active')),
    )

  const taken = counts?.taken ?? 0
  const players = counts?.players ?? 0
  // инициалы (решение владельца 2026-10-19): от MIN_INITIALS_PLAYERS игроков, не «по приглашению»,
  // не после окончания события; иначе только счётчик (по малому составу инициалы опознают человека)
  const ended = status === 'finished' || ev.endsAt <= new Date()
  const showInitials = ev.joinMode === 'open' && !ended && players >= MIN_INITIALS_PLAYERS
  const roster = showInitials ? await bookingService.publicRoster(ctx, org.id, ev.id) : []

  return {
    slug: ev.publicSlug,
    event: {
      title: ev.title,
      description: ev.description,
      status,
      startsAt: ev.startsAt.toISOString(),
      endsAt: ev.endsAt.toISOString(),
      place: {
        name: row.venueName ?? ev.locationText,
        address: row.venueAddress ?? null,
      },
      capacity: ev.capacity,
      taken,
      players,
      full: taken >= ev.capacity,
      currency: ev.currency,
      joinMode: ev.joinMode,
      bookingOpensAt: ev.bookingOpensAt?.toISOString() ?? null,
    },
    group: { name: org.name, city: org.city, timezone: org.timezone, memberCount: members?.n ?? 0 },
    price: status === 'cancelled' ? null : quote(ev, org.subscriptionsEnabled, taken),
    roster: {
      initials: roster.slice(0, MAX_INITIALS).map((r) => initialsOf(r.user.name)),
      more: showInitials ? Math.max(0, players - MAX_INITIALS) : 0,
    },
    startParam: `event_${ev.id}`,
    indexable: org.seoIndex && ev.joinMode === 'open' && status !== 'cancelled',
  }
}

function quote(
  ev: typeof events.$inferSelect,
  subscriptionsEnabled: boolean,
  taken: number,
): EventPriceQuoteView {
  const base: EventPriceQuote =
    ev.priceMode === 'fixed'
      ? quoteEventPrice({ mode: 'fixed', price: ev.price, seats: 1, subscriptionsEnabled })
      : quoteEventPrice({
          mode: 'split',
          targetAmount: ev.targetAmount!,
          capacity: ev.capacity,
          // занятость выше вместимости (уменьшенная вместимость) не должна ронять расчёт
          takenSeats: Math.min(taken, ev.capacity),
          mySeats: 0,
          seats: 1,
          settled:
            ev.pricingSettledAt !== null
              ? { participantCount: ev.pricingParticipantCount!, myAllocatedAmount: null }
              : null,
        })
  return { ...base, currency: ev.currency }
}
