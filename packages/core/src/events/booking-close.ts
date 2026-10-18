import { and, eq, scheduledJobs, sql, type DbOrTx, type Event } from '@volley-time/db'

import { schedulerEnabled } from '../scheduler/capability'
import { getDb, type ServiceContext } from '../shared/context'

type CloseFields = Pick<Event, 'status' | 'startsAt' | 'closeBeforeMinutes' | 'bookingOpensAt'>

/** Момент закрытия записи: начало − `close_before_minutes` (20.3.1, решение владельца 2026-10-16). */
export function closeMomentOf(event: Pick<Event, 'startsAt' | 'closeBeforeMinutes'>): Date {
  return new Date(event.startsAt.getTime() - event.closeBeforeMinutes * 60_000)
}

/** Ключ метки журнала «запись события ведёт организатор» (открыта уже после момента закрытия). */
export const manualCloseKey = (eventId: number) => `event.manual_close:event:${eventId}`

/** SQL: у события нет метки ручного закрытия (`id` — выражение id события). */
export const noManualCloseSql = (eventId: unknown) =>
  sql`NOT EXISTS (SELECT 1 FROM ${scheduledJobs} mc
    WHERE mc.dedup_key = 'event.manual_close:event:' || ${eventId})`

/**
 * Событие стало опубликованным и открытым (создание опубликованным, публикация черновика,
 * переоткрытие) или его момент закрытия сдвинут (перенос начала, смена срока, в том числе правкой
 * серии) так, что уже наступил, — его запись ведёт организатор: метка в журнале, без отказа.
 * При выключенном планировщике метка ни на что не влияет (поведение R0.7).
 * Метка держится, пока момент закрытия в прошлом; перенос, после которого момент закрытия снова в
 * будущем, её снимает. Последующие правки (название, места) право планировщика не меняют
 * (follow-up 20.3.1: правило не зависит от последнего `updated_at`). Под lock события.
 */
export async function syncManualCloseMark(
  db: DbOrTx,
  event: Pick<Event, 'id' | 'status' | 'startsAt' | 'closeBeforeMinutes'>,
  opts: { becameOpen: boolean; now?: Date },
): Promise<void> {
  const now = opts.now ?? new Date()
  if (closeMomentOf(event) > now) {
    await db.delete(scheduledJobs).where(eq(scheduledJobs.dedupKey, manualCloseKey(event.id)))
    return
  }
  if (opts.becameOpen && event.status === 'published')
    await db
      .insert(scheduledJobs)
      .values({
        kind: 'event.manual_close',
        dedupKey: manualCloseKey(event.id),
        eventId: event.id,
        status: 'skipped',
        runAt: now,
        completedAt: now,
      })
      .onConflictDoNothing({ target: scheduledJobs.dedupKey })
}

async function hasManualClose(db: DbOrTx, eventId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: scheduledJobs.id })
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.dedupKey, manualCloseKey(eventId))))
  return row !== undefined
}

/** Метка «запись ведёт организатор» для карточки события в кабинете (20.5.6). */
export async function readManualClose(ctx: ServiceContext, eventId: number): Promise<boolean> {
  return hasManualClose(getDb(ctx), eventId)
}

/**
 * Без учёта метки: событие опубликовано, и запись открывается не позже момента закрытия.
 * Право планировщика закрыть запись — это условие и отсутствие метки ручного закрытия.
 */
export function isAutoCloseCandidate(event: CloseFields): boolean {
  return (
    event.status === 'published' &&
    (event.bookingOpensAt === null || event.bookingOpensAt <= closeMomentOf(event))
  )
}

/**
 * Запись закрыта по расписанию уже с момента закрытия, не дожидаясь прохода планировщика: запись,
 * добавление мест и принятие предложения после этого момента отклоняются. Только при включённом
 * планировщике и для событий, которые он закрывает (без метки ручного закрытия).
 */
export async function isBookingClosedBySchedule(
  db: DbOrTx,
  event: CloseFields & Pick<Event, 'id'>,
  now = new Date(),
): Promise<boolean> {
  return (
    schedulerEnabled() &&
    isAutoCloseCandidate(event) &&
    now >= closeMomentOf(event) &&
    !(await hasManualClose(db, event.id))
  )
}
