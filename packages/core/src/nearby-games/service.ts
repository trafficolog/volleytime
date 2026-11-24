import {
  and,
  asc,
  bookings,
  eq,
  events,
  gt,
  inArray,
  isNull,
  or,
  organizationMembers,
  organizations,
  sql,
  venues,
} from '@volley-time/db'
import { cityKey } from '@volley-time/shared'
import { z } from 'zod'

import { takenSeatsSql } from '../bookings/seats'
import { publicGroup } from '../group-page/public'
import { LevelCode } from '../levels/schemas'
import { getDb, type ServiceContext } from '../shared/context'

/** Максимум игр в одном ответе; дальше — `offset` («Показать ещё»). */
export const MAX_NEARBY_GAMES_LIMIT = 50
const DEFAULT_NEARBY_GAMES_LIMIT = 20

export const NearbyGamesQuery = z.object({
  /** Город каталога: без учёта регистра и лишних пробелов, как у `/volleyball/<город>`. */
  city: z.string().trim().min(1).max(100),
  /** «Мой уровень»: игры этого уровня и игры для любого уровня (`level IS NULL`). */
  level: LevelCode.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_NEARBY_GAMES_LIMIT)
    .default(DEFAULT_NEARBY_GAMES_LIMIT),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
})
export type NearbyGamesQuery = z.input<typeof NearbyGamesQuery>

/**
 * Игра чужой группы в ленте: только публичные поля (как на публичной странице группы), без цен,
 * состава, оплат и владельца.
 */
export interface NearbyGame {
  id: number
  title: string
  startsAt: string
  endsAt: string
  level: string | null
  place: { name: string | null; address: string | null }
  capacity: number
  /**
   * Цена места: только у события с фиксированной ценой (как на публичной странице события);
   * у «складчины» цена зависит от числа игроков, поэтому 
ull.
   */
  price: { amount: number; currency: string } | null
  /** Занято мест (SUM seats); свободно = capacity − taken. */
  taken: number
  full: boolean
  /** Публичная страница события `/e/<publicSlug>`. */
  publicSlug: string
  group: {
    id: number
    slug: string
    name: string
    city: string | null
    district: string | null
    logoUpdatedAt: string | null
    timezone: string
  }
}

export interface NearbyGamesPage {
  games: NearbyGame[]
  hasMore: boolean
}

/**
 * Открытые игры рядом (30.3.3, M-32): ближайшие события других публичных групп города. Событие
 * в ленте, только если оно опубликовано, ещё не началось, открыто для записи (`joinMode = open`:
 * «по приглашению» не попадают никогда), а группа публична — те же условия, что у публичной
 * страницы группы (`publicGroup`: страница включена, группа активна и не удалена, root не скрыл).
 * Группы, где игрок активный участник, исключены: лента про чужие группы. Запись выполняется по
 * правилам группы на её странице; сервис ничего не бронирует. Схему БД не меняет.
 */
export const nearbyGamesService = {
  async list(ctx: ServiceContext, query: unknown, now = new Date()): Promise<NearbyGamesPage> {
    const q = NearbyGamesQuery.parse(query)
    const db = getDb(ctx)
    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        level: events.level,
        capacity: events.capacity,
        priceMode: events.priceMode,
        price: events.price,
        currency: events.currency,
        publicSlug: events.publicSlug,
        locationText: events.locationText,
        venueName: venues.name,
        venueAddress: venues.address,
        orgId: organizations.id,
        orgSlug: organizations.slug,
        orgName: organizations.name,
        orgCity: organizations.city,
        orgDistrict: organizations.district,
        orgLogoUpdatedAt: organizations.logoUpdatedAt,
        orgTimezone: organizations.defaultTimezone,
      })
      .from(events)
      .innerJoin(organizations, eq(organizations.id, events.organizationId))
      .leftJoin(venues, eq(venues.id, events.venueId))
      .where(
        and(
          publicGroup,
          sql`lower(regexp_replace(btrim(${organizations.city}), '\\s+', ' ', 'g')) = ${cityKey(q.city)}`,
          eq(events.status, 'published'),
          eq(events.joinMode, 'open'),
          gt(events.startsAt, now),
          q.level ? or(isNull(events.level), eq(events.level, q.level)) : undefined,
          sql`NOT EXISTS (SELECT 1 FROM ${organizationMembers} om
            WHERE om.organization_id = ${events.organizationId}
              AND om.user_id = ${ctx.userId} AND om.status = 'active')`,
        ),
      )
      .orderBy(asc(events.startsAt), asc(events.id))
      .limit(q.limit + 1)
      .offset(q.offset)
    const page = rows.slice(0, q.limit)
    const taken = new Map<number, number>()
    if (page.length > 0)
      for (const r of await db
        .select({ eventId: bookings.eventId, taken: takenSeatsSql })
        .from(bookings)
        .where(
          inArray(
            bookings.eventId,
            page.map((r) => r.id),
          ),
        )
        .groupBy(bookings.eventId))
        taken.set(r.eventId, r.taken)
    return {
      hasMore: rows.length > q.limit,
      games: page.map((r) => {
        const seats = taken.get(r.id) ?? 0
        return {
          id: r.id,
          title: r.title,
          startsAt: r.startsAt.toISOString(),
          endsAt: r.endsAt.toISOString(),
          level: r.level,
          place: { name: r.venueName ?? r.locationText, address: r.venueAddress ?? null },
          capacity: r.capacity,
          price: r.priceMode === 'fixed' ? { amount: r.price, currency: r.currency } : null,
          taken: seats,
          full: seats >= r.capacity,
          publicSlug: r.publicSlug,
          group: {
            id: r.orgId,
            slug: r.orgSlug,
            name: r.orgName,
            city: r.orgCity?.trim().replace(/\s+/g, ' ') ?? null,
            district: r.orgDistrict,
            logoUpdatedAt: r.orgLogoUpdatedAt?.toISOString() ?? null,
            timezone: r.orgTimezone,
          },
        }
      }),
    }
  },
}
