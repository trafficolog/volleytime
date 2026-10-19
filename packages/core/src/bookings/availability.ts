import { and, bookings, eq, type Event } from '@volley-time/db'

import { isBookingClosedBySchedule } from '../events/booking-close'
import { schedulerEnabled } from '../scheduler/capability'
import { getDb, type ServiceContext } from '../shared/context'

import { noOpenOfferSql, reservedSeats } from './offers'
import { inQueueSql, queuedSeatsSql } from './seats'

export interface BookingAvailability {
  /** Свободные места для новой записи — по ним Mini App решает, нужна ли очередь (20.4.5). */
  freeSeats: number
  /** Запись закрыта по расписанию (с учётом метки ручного закрытия) — решает сервер, не часы клиента. */
  bookingClosed: boolean
}

/**
 * Доступность записи для карточки события игрока (20.4.5). Свободно = вместимость − занятые и
 * удерживаемые предложениями места; при включённом планировщике свободное место уходит очереди,
 * поэтому вычитаются и места очереди БЕЗ активного предложения (то же условие, что
 * `noOpenOfferSql`): места очереди с предложением уже учтены в удерживаемых.
 */
export async function readBookingAvailability(
  ctx: ServiceContext,
  event: Pick<
    Event,
    'id' | 'capacity' | 'status' | 'startsAt' | 'closeBeforeMinutes' | 'bookingOpensAt'
  >,
): Promise<BookingAvailability> {
  const db = getDb(ctx)
  const reserved = await reservedSeats(db, event.id)
  let queuedWithoutOffer = 0
  if (schedulerEnabled()) {
    const [row] = await db
      .select({ queued: queuedSeatsSql })
      .from(bookings)
      .where(and(eq(bookings.eventId, event.id), inQueueSql, noOpenOfferSql))
    queuedWithoutOffer = row?.queued ?? 0
  }
  return {
    freeSeats: Math.max(0, event.capacity - reserved - queuedWithoutOffer),
    bookingClosed: await isBookingClosedBySchedule(db, event),
  }
}
