/**
 * Окно записи события в параметрах карточки (20.5.6, 20.3.1): время открытия (`bookingOpensAt`) и
 * автозакрытие «за N часов до начала» (`closeBeforeMinutes`). Автозакрытие показываем только при
 * включённом планировщике (`capabilities.eventScheduler`): без него запись закрывает организатор.
 */
import { formatEventDate, formatTime } from '@volley-time/shared'

export interface BookingWindowEvent {
  startsAt: string | Date
  bookingOpensAt?: string | Date | null
  closeBeforeMinutes?: number | null
  /** Метка 20.3.1: запись ведёт организатор, планировщик её не закрывает. */
  manualClose?: boolean
}

export const closeBeforeLabel = (minutes: number): string => `за ${Math.round(minutes / 60)} ч`

export function bookingWindowOf(
  event: BookingWindowEvent,
  tz: string,
  schedulerOn: boolean,
  now: Date = new Date(),
): { opens: string; closes: string | null } {
  const opensAt = event.bookingOpensAt ? new Date(event.bookingOpensAt) : null
  const opens =
    opensAt === null
      ? 'открыта с публикации'
      : `${now < opensAt ? 'откроется' : 'открылась'} ${formatEventDate(opensAt, tz)}`
  const minutes = event.closeBeforeMinutes
  const closes = !schedulerOn
    ? null
    : event.manualClose
      ? 'закрытие вручную'
      : minutes
        ? `${closeBeforeLabel(minutes)} до начала (в ${formatTime(
            new Date(new Date(event.startsAt).getTime() - minutes * 60_000),
            tz,
          )})`
        : null
  return { opens, closes }
}
