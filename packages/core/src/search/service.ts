import {
  and,
  asc,
  bookings,
  desc,
  eq,
  events,
  inArray,
  or,
  organizationMembers,
  payments,
  sql,
  subscriptionPlans,
  subscriptions,
  users,
  venues,
  type Event,
  type OrganizationMember,
  type Payment,
} from '@volley-time/db'

import { getDb, type ServiceContext } from '../shared/context'

import {
  SEARCH_GROUP_LIMIT,
  isSearchQueryValid,
  normalizeSearchQuery,
  stripAt,
  toContainsPattern,
} from './query'

export interface SearchPlayerHit {
  memberId: number
  userId: number
  name: string | null
  telegramUsername: string | null
  image: string | null
  role: OrganizationMember['role']
  status: OrganizationMember['status']
}

export interface SearchEventHit {
  id: number
  title: string
  startsAt: Date
  status: Event['status']
  venueName: string | null
}

export interface SearchPaymentHit {
  id: number
  status: Payment['status']
  amount: number
  currency: string
  createdAt: Date
  user: { id: number; name: string | null; telegramUsername: string | null }
  event: { id: number; title: string } | null
  planName: string | null
}

export interface SearchGroup<T> {
  items: T[]
  /** Есть ещё совпадения сверх показанных. */
  more: boolean
}

export interface CabinetSearchResult {
  query: string
  /** `false` — запрос короче минимума: ничего не искали. */
  searched: boolean
  players: SearchGroup<SearchPlayerHit>
  events: SearchGroup<SearchEventHit>
  /** `null` — тип недоступен роли (платежи видят только управляющие). */
  payments: SearchGroup<SearchPaymentHit> | null
}

export interface SearchScope {
  /** owner/organizer: черновики, заявки/гости и платежи. */
  isManager: boolean
}

const empty = <T>(): SearchGroup<T> => ({ items: [], more: false })

function group<T>(rows: T[]): SearchGroup<T> {
  return { items: rows.slice(0, SEARCH_GROUP_LIMIT), more: rows.length > SEARCH_GROUP_LIMIT }
}

/**
 * Поиск кабинета (20.5.2, P-13): игроки, события и платежи одной группы по подстроке без учёта регистра.
 * Права: игрок видит активных участников и опубликованные события; управляющий — также заявки/гостей,
 * черновики и платежи. Email, телефон, Telegram id и уровень в выдачу не попадают.
 * Все выборки сужены `organization_id` группы из пути; соединённые строки перепроверяются на группу.
 */
export const searchService = {
  async search(
    ctx: ServiceContext,
    orgId: number,
    scope: SearchScope,
    rawQuery: string,
  ): Promise<CabinetSearchResult> {
    const query = normalizeSearchQuery(rawQuery)
    if (!isSearchQueryValid(query)) {
      return {
        query,
        searched: false,
        players: empty(),
        events: empty(),
        payments: scope.isManager ? empty() : null,
      }
    }

    const db = getDb(ctx)
    const pattern = toContainsPattern(query)
    const userPattern = toContainsPattern(stripAt(query) || query)
    const like = (col: unknown, p: string) => sql`${col} ILIKE ${p} ESCAPE '\\'`
    const limit = SEARCH_GROUP_LIMIT + 1

    const playerRows = db
      .select({
        memberId: organizationMembers.id,
        userId: users.id,
        name: users.name,
        telegramUsername: users.telegramUsername,
        image: users.image,
        role: organizationMembers.role,
        status: organizationMembers.status,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          scope.isManager
            ? inArray(organizationMembers.status, ['active', 'pending', 'guest'])
            : eq(organizationMembers.status, 'active'),
          or(like(users.name, pattern), like(users.telegramUsername, userPattern)),
        ),
      )
      .orderBy(asc(users.name), asc(organizationMembers.id))
      .limit(limit)

    const eventRows = db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        status: events.status,
        venueName: venues.name,
      })
      .from(events)
      .leftJoin(venues, and(eq(venues.id, events.venueId), eq(venues.organizationId, orgId)))
      .where(
        and(
          eq(events.organizationId, orgId),
          scope.isManager ? undefined : sql`${events.status} <> 'draft'`,
          or(like(events.title, pattern), like(venues.name, pattern)),
        ),
      )
      .orderBy(desc(events.startsAt), desc(events.id))
      .limit(limit)

    const paymentRows = scope.isManager
      ? db
          .select({
            id: payments.id,
            status: payments.status,
            amount: payments.amount,
            currency: payments.currency,
            createdAt: payments.createdAt,
            user: { id: users.id, name: users.name, telegramUsername: users.telegramUsername },
            eventId: events.id,
            eventTitle: events.title,
            planName: subscriptionPlans.name,
          })
          .from(payments)
          .innerJoin(users, eq(users.id, payments.userId))
          .leftJoin(
            bookings,
            and(eq(bookings.id, payments.bookingId), eq(bookings.organizationId, orgId)),
          )
          .leftJoin(events, and(eq(events.id, bookings.eventId), eq(events.organizationId, orgId)))
          .leftJoin(
            subscriptions,
            and(
              eq(subscriptions.id, payments.subscriptionId),
              eq(subscriptions.organizationId, orgId),
            ),
          )
          .leftJoin(
            subscriptionPlans,
            and(
              eq(subscriptionPlans.id, subscriptions.planId),
              eq(subscriptionPlans.organizationId, orgId),
            ),
          )
          .where(
            and(
              eq(payments.organizationId, orgId),
              or(
                like(users.name, pattern),
                like(users.telegramUsername, userPattern),
                like(events.title, pattern),
                like(subscriptionPlans.name, pattern),
              ),
            ),
          )
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(limit)
      : null

    const [players, evs, pays] = await Promise.all([playerRows, eventRows, paymentRows])
    return {
      query,
      searched: true,
      players: group(players),
      events: group(evs),
      payments: pays
        ? group(
            pays.map((p): SearchPaymentHit => ({
              id: p.id,
              status: p.status,
              amount: p.amount,
              currency: p.currency,
              createdAt: p.createdAt,
              user: p.user,
              event: p.eventId !== null ? { id: p.eventId, title: p.eventTitle! } : null,
              planName: p.planName,
            })),
          )
        : null,
    }
  },
}
