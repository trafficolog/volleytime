import {
  and,
  bookings,
  db as defaultDb,
  eq,
  events,
  gt,
  inArray,
  isNotNull,
  lte,
  organizationMembers,
  scheduledJobs,
  sql,
} from '@volley-time/db'

import type { NotificationType } from '../notifier/templates'

import type { NotifyJobPayload } from './journal'

const H = 3600_000
/** Окно, в котором ещё имеет смысл сообщать об открытии записи (пропуск при простое планировщика). */
const OPENED_STALE_MS = 24 * H

interface Row {
  userId: number
  eventId: number
  organizationId: number
  title: string
  startsAt: Date
}

async function enqueueRows(
  type: NotificationType,
  rows: Row[],
  now: Date,
  check: (r: Row) => NotifyJobPayload['check'],
): Promise<number> {
  if (rows.length === 0) return 0
  const inserted = await defaultDb
    .insert(scheduledJobs)
    .values(
      rows.map((r) => ({
        kind: type,
        dedupKey: `${type}:event:${r.eventId}:user:${r.userId}`,
        organizationId: r.organizationId,
        eventId: r.eventId,
        runAt: now,
        payload: {
          userId: r.userId,
          params: {
            eventTitle: r.title,
            eventDate: r.startsAt.toISOString(),
            organizationId: r.organizationId,
            eventId: r.eventId,
          },
          check: check(r),
        } satisfies NotifyJobPayload,
      })),
    )
    .onConflictDoNothing({ target: scheduledJobs.dedupKey })
    .returning({ id: scheduledJobs.id })
  return inserted.length
}

/** Ключ уже поставленной задачи этого типа — чтобы не перебирать уже обработанных получателей. */
const notQueued = (type: NotificationType) =>
  sql`NOT EXISTS (SELECT 1 FROM ${scheduledJobs} j WHERE j.dedup_key =
    ${type}::text || ':event:' || ${events.id} || ':user:' || ${bookings.userId})`

/**
 * Напоминания 24 ч и 2 ч (20.3.1): игрокам состава (`confirmed`/`pending_payment`, не очередь и не
 * отменённые) неотменённого события. Окно 24 ч — [начало − 24 ч, начало − 2 ч), окно 2 ч —
 * [начало − 2 ч, начало): при позднем запуске не приходят оба сразу. Запись, сделанная уже внутри
 * окна, напоминание этого окна не получает (игрок только что записался). Интервалы — абсолютное
 * время (timestamptz); дата в тексте — в часовом поясе группы (notifier). Одно напоминание типа на
 * событие и игрока: ключ `<type>:event:<id>:user:<id>`.
 */
export async function enqueueReminders(now: Date): Promise<number> {
  let total = 0
  for (const [type, before, until] of [
    ['reminder_24h', 24 * H, 2 * H],
    ['reminder_2h', 2 * H, 0],
  ] as const) {
    const rows = await defaultDb
      .select({
        userId: bookings.userId,
        eventId: events.id,
        organizationId: events.organizationId,
        title: events.title,
        startsAt: events.startsAt,
      })
      .from(bookings)
      .innerJoin(events, eq(events.id, bookings.eventId))
      .where(
        and(
          inArray(events.status, ['published', 'closed']),
          lte(events.startsAt, new Date(now.getTime() + before)),
          gt(events.startsAt, new Date(now.getTime() + until)),
          inArray(bookings.status, ['confirmed', 'pending_payment']),
          sql`${bookings.bookedAt} <= ${events.startsAt} - make_interval(secs => ${before / 1000})`,
          notQueued(type),
        ),
      )
      .limit(1000)
    total += await enqueueRows(type, rows, now, (r) => ({
      kind: 'roster',
      eventId: r.eventId,
      userId: r.userId,
    }))
  }
  return total
}

/**
 * «Запись открыта» (20.3.1, D-09): при наступлении `booking_opens_at` — каждому активному участнику
 * группы, один раз на событие. Опоздание больше суток (простой планировщика) не рассылается.
 */
export async function enqueueBookingOpened(now: Date): Promise<number> {
  const rows = await defaultDb
    .select({
      userId: organizationMembers.userId,
      eventId: events.id,
      organizationId: events.organizationId,
      title: events.title,
      startsAt: events.startsAt,
    })
    .from(events)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, events.organizationId),
        eq(organizationMembers.status, 'active'),
      ),
    )
    .where(
      and(
        eq(events.status, 'published'),
        isNotNull(events.bookingOpensAt),
        lte(events.bookingOpensAt, now),
        gt(events.bookingOpensAt, new Date(now.getTime() - OPENED_STALE_MS)),
        gt(events.startsAt, now),
        sql`NOT EXISTS (SELECT 1 FROM ${scheduledJobs} j WHERE j.dedup_key =
          'booking_opened:event:' || ${events.id} || ':user:' || ${organizationMembers.userId})`,
      ),
    )
    .limit(5000)
  return enqueueRows('booking_opened', rows, now, (r) => ({
    kind: 'event_open',
    eventId: r.eventId,
  }))
}
