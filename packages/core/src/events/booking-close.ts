import type { Event } from '@volley-time/db'

import { schedulerEnabled } from '../scheduler/capability'

type CloseFields = Pick<
  Event,
  'status' | 'startsAt' | 'closeBeforeMinutes' | 'updatedAt' | 'bookingOpensAt'
>

/** Момент закрытия записи: начало − `close_before_minutes` (20.3.1, решение владельца 2026-10-16). */
export function closeMomentOf(event: Pick<Event, 'startsAt' | 'closeBeforeMinutes'>): Date {
  return new Date(event.startsAt.getTime() - event.closeBeforeMinutes * 60_000)
}

/**
 * Запись события закрывает планировщик (ревью PR #150, I1): событие опубликовано и было открыто до
 * момента закрытия — последнее изменение события (создание, публикация, перенос, переоткрытие,
 * смена срока) раньше этого момента, и время открытия записи не позже него. Событие, опубликованное,
 * созданное, перенесённое или переоткрытое уже после момента закрытия, ведёт организатор.
 */
export function isAutoCloseEligible(event: CloseFields): boolean {
  const closeAt = closeMomentOf(event)
  return (
    event.status === 'published' &&
    event.updatedAt < closeAt &&
    (event.bookingOpensAt === null || event.bookingOpensAt <= closeAt)
  )
}

/**
 * Запись закрыта по расписанию уже с момента закрытия, не дожидаясь прохода планировщика: запись,
 * добавление мест и принятие предложения после этого момента отклоняются. Только при включённом
 * планировщике и для событий, которые он закрывает.
 */
export function isBookingClosedBySchedule(event: CloseFields, now = new Date()): boolean {
  return schedulerEnabled() && isAutoCloseEligible(event) && now >= closeMomentOf(event)
}
